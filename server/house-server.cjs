// The house server (Player House, Phase 5): shared houses, likes and the
// most-liked lists, plus (optionally) the game itself as static files.
// Plain Node (CommonJS, so hosts like DirectAdmin / LiteSpeed can start it
// directly), no dependencies: `node server/house-server.cjs`. Settings
// come from environment variables (see docs/SERVER.md):
//
//   PORT          port to listen on (default 8787; DirectAdmin's Node.js
//                 app manager usually sets it)
//   DATA_DIR      where houses.json is kept (default ./data next to this file)
//   STATIC_DIR    a built game folder to serve (e.g. ../dist); optional
//   CORS_ORIGIN   allowed browser origin(s), comma separated, or * (default *)
//
// Storage is one JSON file, written atomically a moment after each change.
// Fine for thousands of houses; swap the Store class for a database later.
//
// Players have no accounts: the game makes a random playerId and secret on
// first use. The first request from a playerId registers its secret (kept
// only as a SHA-256 hash); later writes must present the same secret.

"use strict";

const { createServer } = require("node:http");
const { createHash, randomBytes, timingSafeEqual } = require("node:crypto");
const { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, statSync, createReadStream } = require("node:fs");
const { extname, join, normalize, resolve, sep } = require("node:path");

const HERE = __dirname;
const PORT = Number(process.env.PORT) || 8787;
const DATA_DIR = resolve(process.env.DATA_DIR || join(HERE, "data"));
const STATIC_DIR = process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : null;
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim()).filter(Boolean);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY = 32 * 1024;
const MAX_CODE = 20_000;
const MAX_NAME = 24;
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const HOUSE_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
const CODE_RE = /^RRH[01]\.[A-Za-z0-9_-]+$/;

// ── Storage ──

class Store {
  constructor(dir) {
    this.file = join(dir, "houses.json");
    mkdirSync(dir, { recursive: true });
    this.data = { players: {}, houses: {}, likes: {} };
    if (existsSync(this.file)) {
      try {
        const loaded = JSON.parse(readFileSync(this.file, "utf8"));
        this.data = { players: loaded.players ?? {}, houses: loaded.houses ?? {}, likes: loaded.likes ?? {} };
      } catch (e) {
        console.error(`Couldn't read ${this.file}; starting empty and keeping the old file aside.`, e);
        renameSync(this.file, `${this.file}.broken-${Date.now()}`);
      }
    }
    this.timer = null;
  }

  /** Writes a moment after the last change, via a temp file and rename. */
  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(this.data));
      renameSync(tmp, this.file);
    }, 500);
  }

  flush() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
    writeFileSync(this.file, JSON.stringify(this.data));
  }
}

const store = new Store(DATA_DIR);
const hash = (s) => createHash("sha256").update(s).digest("hex");

/** Checks a player's secret, registering it the first time. */
function authenticate(playerId, secret) {
  if (typeof playerId !== "string" || !ID_RE.test(playerId) || typeof secret !== "string" || !ID_RE.test(secret)) return false;
  const known = store.data.players[playerId];
  const h = hash(secret);
  if (!known) {
    store.data.players[playerId] = { secretHash: h, createdAt: Date.now() };
    store.save();
    return true;
  }
  const a = Buffer.from(known.secretHash, "hex");
  const b = Buffer.from(h, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function cleanName(name) {
  if (typeof name !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME).trim();
}

function likeCounts(houseId, now = Date.now()) {
  const likes = store.data.likes[houseId] ?? {};
  let all = 0;
  let week = 0;
  for (const at of Object.values(likes)) {
    all++;
    if (now - at < WEEK_MS) week++;
  }
  return { likes: all, likesWeek: week };
}

function houseOut(house, playerId) {
  return {
    id: house.id,
    name: house.name,
    code: house.code,
    updatedAt: house.updatedAt,
    ...likeCounts(house.id),
    likedByMe: !!(playerId && store.data.likes[house.id]?.[playerId]),
    mine: !!(playerId && house.ownerId === playerId),
  };
}

function newHouseId() {
  for (;;) {
    const id = randomBytes(6).toString("base64url");
    if (!store.data.houses[id]) return id;
  }
}

// ── Rate limits: per IP, per minute ──

const hits = new Map();
function rateLimited(ip, write) {
  const now = Date.now();
  const key = `${ip}:${write ? "w" : "r"}`;
  const limit = write ? 30 : 240;
  const entry = hits.get(key);
  if (!entry || now - entry.start > 60_000) {
    hits.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of hits) if (now - v.start > 60_000) hits.delete(k);
}, 60_000).unref();

// ── HTTP ──

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (CORS_ORIGINS.includes("*")) return { "Access-Control-Allow-Origin": "*" };
  if (origin && CORS_ORIGINS.includes(origin)) return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  return {};
}

function send(req, res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...corsHeaders(req),
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        fail(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        ok(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        fail(new Error("bad_json"));
      }
    });
    req.on("error", fail);
  });
}

async function api(req, res, url) {
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const method = req.method;
  const ip = (req.headers["x-forwarded-for"]?.split(",")[0] ?? req.socket.remoteAddress ?? "?").trim();
  const write = method !== "GET";
  if (rateLimited(ip, write)) return send(req, res, 429, { error: "Too many requests. Try again in a minute." });

  // GET /api/health
  if (method === "GET" && parts[0] === "health") return send(req, res, 200, { ok: true });

  // GET /api/houses/top?period=all|week&limit=20&player=<id>
  if (method === "GET" && parts[0] === "houses" && parts[1] === "top") {
    const period = url.searchParams.get("period") === "week" ? "week" : "all";
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const player = url.searchParams.get("player");
    const key = period === "week" ? "likesWeek" : "likes";
    const list = Object.values(store.data.houses)
      .map((h) => houseOut(h, player))
      .filter((h) => h[key] > 0 || period === "all")
      .sort((a, b) => b[key] - a[key] || b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map(({ code: _code, ...rest }) => rest);
    return send(req, res, 200, { houses: list });
  }

  // GET /api/houses/<id>?player=<id>
  if (method === "GET" && parts[0] === "houses" && parts.length === 2) {
    const house = HOUSE_ID_RE.test(parts[1]) ? store.data.houses[parts[1]] : undefined;
    if (!house) return send(req, res, 404, { error: "No house with that id." });
    return send(req, res, 200, houseOut(house, url.searchParams.get("player")));
  }

  if (!write) return send(req, res, 404, { error: "Not found." });

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(req, res, e.message === "too_large" ? 413 : 400, { error: "Bad request." });
  }
  if (!authenticate(body.playerId, body.secret)) return send(req, res, 403, { error: "That id and secret don't match." });
  const playerId = body.playerId;

  // POST /api/houses  { playerId, secret, name, code }  -> list or update your house
  if (method === "POST" && parts[0] === "houses" && parts.length === 1) {
    const code = typeof body.code === "string" ? body.code.replace(/\s+/g, "") : "";
    if (!CODE_RE.test(code) || code.length > MAX_CODE) return send(req, res, 400, { error: "That isn't a house code." });
    const now = Date.now();
    let house = Object.values(store.data.houses).find((h) => h.ownerId === playerId);
    if (!house) {
      house = { id: newHouseId(), ownerId: playerId, createdAt: now };
      store.data.houses[house.id] = house;
    }
    Object.assign(house, { name: cleanName(body.name) || "Adventurer", code, updatedAt: now });
    store.save();
    return send(req, res, 200, houseOut(house, playerId));
  }

  // DELETE /api/houses/mine  { playerId, secret }  -> unlist your house
  if (method === "DELETE" && parts[0] === "houses" && parts[1] === "mine") {
    const house = Object.values(store.data.houses).find((h) => h.ownerId === playerId);
    if (house) {
      delete store.data.houses[house.id];
      delete store.data.likes[house.id];
      store.save();
    }
    return send(req, res, 200, { ok: true });
  }

  // POST|DELETE /api/houses/<id>/like  { playerId, secret }
  if ((method === "POST" || method === "DELETE") && parts[0] === "houses" && parts[2] === "like") {
    const house = HOUSE_ID_RE.test(parts[1]) ? store.data.houses[parts[1]] : undefined;
    if (!house) return send(req, res, 404, { error: "No house with that id." });
    if (house.ownerId === playerId) return send(req, res, 400, { error: "You can't like your own house." });
    const likes = (store.data.likes[house.id] ??= {});
    if (method === "POST") likes[playerId] ??= Date.now();
    else delete likes[playerId];
    store.save();
    return send(req, res, 200, houseOut(house, playerId));
  }

  return send(req, res, 404, { error: "Not found." });
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

/** Serves the built game, with index.html for any path that isn't a file. */
function serveStatic(req, res, url) {
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "");
  let file = resolve(STATIC_DIR, path);
  if (!file.startsWith(STATIC_DIR + sep) && file !== STATIC_DIR) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(STATIC_DIR, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  const isHtml = extname(file) === ".html";
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": isHtml ? "no-cache" : "public, max-age=86400",
  });
  createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      ...corsHeaders(req),
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }
  try {
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (STATIC_DIR && (req.method === "GET" || req.method === "HEAD")) return serveStatic(req, res, url);
    send(req, res, 404, { error: "Not found." });
  } catch (e) {
    console.error(e);
    send(req, res, 500, { error: "Something went wrong." });
  }
});

server.listen(PORT, () => {
  console.log(`House server on port ${PORT}. Data: ${DATA_DIR}${STATIC_DIR ? `. Game: ${STATIC_DIR}` : ""}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    store.flush();
    process.exit(0);
  });
}
