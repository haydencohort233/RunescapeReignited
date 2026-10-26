import type { GameEngine } from "../engine/gameEngine";
import type { OnlineIdentity } from "../engine/types";

// The house server's client (server/house-server.cjs): listing your house,
// likes and the most-liked lists. Online features only show when the server
// answers; the claude.ai test link has none, so it gets share codes only.
//
// Where the server is: VITE_HOUSE_API at build time (a full URL, e.g.
// https://example.com/api), else /api on the page's own site, which is how
// it works when the server also serves the game.

const API = (import.meta.env.VITE_HOUSE_API as string | undefined)?.replace(/\/+$/, "") || "/api";

/** A listed house as the server describes it. */
export interface ListedHouse {
  id: string;
  name: string;
  /** Only when fetched one at a time (lists leave it out). */
  code?: string;
  likes: number;
  likesWeek: number;
  likedByMe: boolean;
  mine: boolean;
  updatedAt: number;
}

export class HouseServerError extends Error {}

/** The name a house is shared under. Until the intro adds player names
 *  (on hold), everyone is "Adventurer" (decided Oct 24: player name only). */
export function playerName(engine: GameEngine): string {
  void engine;
  return "Adventurer";
}

/** "Adventurer's House". */
export function houseTitle(name: string): string {
  return `${name || "Adventurer"}'s House`;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new HouseServerError("Can't reach the house server.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HouseServerError(typeof body.error === "string" ? body.error : "The house server said no.");
  return body as T;
}

let available: Promise<boolean> | null = null;

/** Whether the house server answers here. Asked once per page load. */
export function houseServerAvailable(): Promise<boolean> {
  available ??= (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${API}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) return false;
      const body = await res.json().catch(() => null);
      return body?.ok === true;
    } catch {
      return false;
    }
  })();
  return available;
}

function randomId(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** This save's identity, made (and saved) the first time it's needed. */
export function onlineIdentity(engine: GameEngine): OnlineIdentity {
  const existing = engine.getOnlineIdentity();
  if (existing) return existing;
  const identity: OnlineIdentity = { playerId: randomId(16), secret: randomId(24), houseId: null };
  engine.setOnlineIdentity(identity);
  return identity;
}

/** Online house actions happen at your house portal (decided Oct 26). */
function requireHome(engine: GameEngine): void {
  if (!engine.isAtHouse()) throw new HouseServerError("Go to your house portal to do that.");
}

function auth(engine: GameEngine) {
  const { playerId, secret } = onlineIdentity(engine);
  return { playerId, secret };
}

/** Lists your house (or updates it) with this code; remembers its id. */
export async function listMyHouse(engine: GameEngine, name: string, code: string): Promise<ListedHouse> {
  requireHome(engine);
  const house = await call<ListedHouse>("/houses", { method: "POST", body: JSON.stringify({ ...auth(engine), name, code }) });
  engine.setListedHouseId(house.id);
  return house;
}

export async function unlistMyHouse(engine: GameEngine): Promise<void> {
  requireHome(engine);
  await call("/houses/mine", { method: "DELETE", body: JSON.stringify(auth(engine)) });
  engine.setListedHouseId(null);
}

export function getListedHouse(engine: GameEngine, id: string): Promise<ListedHouse> {
  const player = engine.getOnlineIdentity()?.playerId;
  return call<ListedHouse>(`/houses/${encodeURIComponent(id)}${player ? `?player=${player}` : ""}`);
}

export async function topHouses(engine: GameEngine, period: "all" | "week"): Promise<ListedHouse[]> {
  const player = engine.getOnlineIdentity()?.playerId;
  const { houses } = await call<{ houses: ListedHouse[] }>(`/houses/top?period=${period}&limit=20${player ? `&player=${player}` : ""}`);
  return houses;
}

export async function likeHouse(engine: GameEngine, id: string, like: boolean): Promise<ListedHouse> {
  requireHome(engine);
  return call<ListedHouse>(`/houses/${encodeURIComponent(id)}/like`, { method: like ? "POST" : "DELETE", body: JSON.stringify(auth(engine)) });
}
