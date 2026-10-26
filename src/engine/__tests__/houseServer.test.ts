import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The house server (server/house-server.cjs), started for real on a spare
// port with an empty data folder.

const PORT = 18000 + Math.floor(Math.random() * 2000);
const BASE = `http://127.0.0.1:${PORT}/api`;
let proc: ChildProcess;
let dataDir: string;

const alice = { playerId: "alice0000000000000", secret: "alice-secret-0000000000" };
const bob = { playerId: "bob00000000000000000", secret: "bob-secret-000000000000" };
const CODE = "RRH1.abcDEF123_-";

async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "house-server-"));
  proc = spawn(process.execPath, ["server/house-server.cjs"], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: "ignore" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("house server didn't start");
});

afterAll(() => {
  proc?.kill();
  rmSync(dataDir, { recursive: true, force: true });
});

describe("house server", () => {
  it("lists a house, updates it in place, and checks the secret", async () => {
    const first = await api("/houses", "POST", { ...alice, name: "Alice", code: CODE });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ name: "Alice", code: CODE, likes: 0, mine: true });
    const again = await api("/houses", "POST", { ...alice, name: "Alice B", code: "RRH1.zzz" });
    expect(again.body.id).toBe(first.body.id);
    expect(again.body.name).toBe("Alice B");
    const thief = await api("/houses", "POST", { playerId: alice.playerId, secret: "wrong-secret-000000", name: "X", code: CODE });
    expect(thief.status).toBe(403);
    expect((await api("/houses", "POST", { ...alice, name: "A", code: "<script>" })).status).toBe(400);
  });

  it("likes count once per player, never your own, and rank both lists", async () => {
    const { body: house } = await api("/houses", "POST", { ...alice, name: "Alice", code: CODE });
    expect((await api(`/houses/${house.id}/like`, "POST", alice)).status).toBe(400);
    await api(`/houses/${house.id}/like`, "POST", bob);
    const liked = await api(`/houses/${house.id}/like`, "POST", bob);
    expect(liked.body).toMatchObject({ likes: 1, likesWeek: 1, likedByMe: true });
    const top = await api(`/houses/top?period=week&player=${bob.playerId}`);
    expect(top.body.houses[0]).toMatchObject({ id: house.id, likesWeek: 1, likedByMe: true });
    expect(top.body.houses[0].code).toBeUndefined();
    const unliked = await api(`/houses/${house.id}/like`, "DELETE", bob);
    expect(unliked.body.likes).toBe(0);
    expect((await api("/houses/top?period=week")).body.houses).toEqual([]);
  });

  it("removing a listing takes it and its likes away", async () => {
    const { body: house } = await api("/houses", "POST", { ...bob, name: "Bob", code: CODE });
    await api("/houses/mine", "DELETE", bob);
    expect((await api(`/houses/${house.id}`)).status).toBe(404);
  });
});
