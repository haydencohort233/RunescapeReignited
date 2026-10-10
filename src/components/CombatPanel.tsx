import { useEffect, useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getEnemy } from "../content/enemies";
import { getActiveCombat } from "../engine/activeAction";
import { ITEM_CATALOG } from "../content/items";
import { getEquipmentBonuses } from "../content/combatStats";
import { enemyImagePath } from "../content/assetPaths";
import HpBar from "./HpBar";
import Hitsplat from "./Hitsplat";
import GameImage from "./GameImage";

interface ActiveSplat {
  id: string;
  side: "player" | "enemy"; // which HP bar this floats over
  outcome: "miss" | "block" | "hit";
  damage: number;
}

const SPLAT_COLOR: Record<ActiveSplat["outcome"], string> = {
  hit: "var(--splat-hit)", // red — real damage, matches OSRS
  block: "var(--splat-block)", // blue — landed but rolled 0
  miss: "var(--splat-miss)", // gray — didn't land at all
};

/** The fight UI for a combatEncounter amenity. Auto-resolves via the
 *  engine's own tick — this component doesn't drive combat, it just
 *  reflects state.activeCombatSession and offers the optional interactive
 *  "Attack Now" override plus Flee. */
export default function CombatPanel({ enemyId }: { enemyId: string }) {
  const { engine, state, actions } = useGame();
  const [splats, setSplats] = useState<ActiveSplat[]>([]);
  const [keepFighting, setKeepFighting] = useState(false);
  const [autoEatItemId, setAutoEatItemId] = useState("");
  const lastLogCountRef = useRef(0);
  const splatTimersRef = useRef(new Set<number>());
  const enemy = getEnemy(enemyId);

  const session = getActiveCombat(state);

  // Spawns a hitsplat for every log entry that's new since the last render.
  // "attacker: player" means the PLAYER dealt it, so it floats over the
  // ENEMY's bar (and vice versa) — same as OSRS showing a splat on whoever
  // got hit, not whoever swung. The log itself is capped at 20 entries, so
  // its length stops changing; logCount keeps counting.
  const logCount = session ? (session.logCount ?? session.log.length) : 0;
  useEffect(() => {
    if (!session) {
      lastLogCountRef.current = 0;
      return;
    }
    const newCount = Math.min(logCount - lastLogCountRef.current, session.log.length);
    lastLogCountRef.current = logCount;
    if (newCount <= 0) return;
    const newEntries = session.log.slice(-newCount);

    const newSplats: ActiveSplat[] = newEntries.map((entry, i) => ({
      id: `${entry.timestamp}-${logCount}-${i}`,
      side: entry.attacker === "player" ? "enemy" : "player",
      outcome: entry.outcome,
      damage: entry.damage,
    }));
    setSplats((prev) => [...prev, ...newSplats]);

    // Not cleared when the next batch arrives: each batch removes itself
    // after its own animation. (Cancelling it on re-run left splats stuck
    // whenever two attacks landed within a second.)
    const timer = window.setTimeout(() => {
      splatTimersRef.current.delete(timer);
      setSplats((prev) => prev.filter((s) => !newSplats.some((n) => n.id === s.id)));
    }, 1000);
    splatTimersRef.current.add(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logCount]);

  useEffect(() => {
    const timers = splatTimersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  if (!enemy) return null;

  const fightingThisEnemy = session?.enemyId === enemyId;

  const nextPlayerAttackSeconds = session
    ? Math.max(
        0,
        Math.ceil(
          (session.playerStartedAt + (session.playerAttacksResolved + 1) * session.playerAttackSpeedMs -
            Date.now()) /
            1000
        )
      )
    : 0;
  const nextEnemyAttackSeconds = session
    ? Math.max(
        0,
        Math.ceil(
          (session.enemyStartedAt + (session.enemyAttacksResolved + 1) * session.enemyAttackSpeedMs -
            Date.now()) /
            1000
        )
      )
    : 0;

  if (!fightingThisEnemy) {
    const foods = ITEM_CATALOG.filter((def) => def.healAmount && engine.getOwnedCount(def.id) >= 1);
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>⚔️ {enemy.name}</strong>
          {enemy.isBoss && <span style={{ fontSize: 11, color: "var(--gold)" }}>Boss</span>}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0" }}>Max HP: {enemy.maxHp}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 12, marginBottom: 6 }}>
          <label>
            <input
              type="checkbox"
              checked={keepFighting}
              onChange={(e) => setKeepFighting(e.target.checked)}
            />{" "}
            Keep fighting
          </label>
          <label>
            Auto-eat{" "}
            <select value={autoEatItemId} onChange={(e) => setAutoEatItemId(e.target.value)}>
              <option value="">None</option>
              {foods.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name} (x{Math.floor(engine.getOwnedCount(def.id))})
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={() => {
            const bonuses = getEquipmentBonuses(state);
            engine.startCombat(enemy, bonuses, {
              autoRepeat: keepFighting,
              autoEatItemId: autoEatItemId || undefined,
            });
          }}
        >
          Fight
        </button>
      </div>
    );
  }

  const renderSplats = (side: "player" | "enemy") =>
    splats
      .filter((s) => s.side === side)
      .map((s, i) => (
        <Hitsplat key={s.id} outcome={s.outcome} damage={s.damage} offsetIndex={i} />
      ));

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 8 }}>
      <style>{`
        @keyframes hitsplatFloat {
          0% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -24px); }
        }
      `}</style>

      <strong>⚔️ Fighting {session.enemyName}</strong>
      {session.autoRepeat && (
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {" "}
          — {session.kills} killed this trip
          {session.autoEatItemId &&
            `, auto-eating ${ITEM_CATALOG.find((d) => d.id === session.autoEatItemId)?.name ?? session.autoEatItemId}`}
        </span>
      )}

      <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
        <GameImage
          src={enemyImagePath(
            session.enemyName,
            session.enemyMaxHp > 0 ? (session.enemyCurrentHp / session.enemyMaxHp) * 100 : 0,
            enemy.degradeStages
          )}
          alt={session.enemyName}
          style={{ width: 96, height: 96 }}
          fallback={
            <div
              style={{
                width: 96,
                height: 96,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
              }}
            >
              ⚔️
            </div>
          }
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
        <div style={{ position: "relative" }}>
          {renderSplats("player")}
          <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="You" />
        </div>
        <div style={{ position: "relative" }}>
          {renderSplats("enemy")}
          <HpBar current={session.enemyCurrentHp} max={session.enemyMaxHp} label={session.enemyName} />
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 0" }}>
        Your next attack: {nextPlayerAttackSeconds}s (every {(session.playerAttackSpeedMs / 1000).toFixed(1)}
        s) — {session.enemyName}'s next attack: {nextEnemyAttackSeconds}s (every{" "}
        {(session.enemyAttackSpeedMs / 1000).toFixed(1)}s)
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={() => {
            engine.attackNow();
            actions.refresh();
          }}
        >
          Attack Now
        </button>
        {session.canFlee && <button onClick={() => engine.fleeCombat()}>Flee</button>}
      </div>

      {/* Compact log: fixed-width columns, tight rows, small font — fits far
          more history in the same space than a full sentence per line did. */}
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          fontFamily: "monospace",
          maxHeight: 140,
          overflowY: "auto",
          border: "1px solid var(--border-subtle)",
          borderRadius: 4,
          padding: "4px 6px",
          display: "flex",
          flexDirection: "column-reverse", // newest at top
        }}
      >
        {session.log.length === 0 && <span style={{ color: "var(--text-faint)" }}>No attacks yet.</span>}
        {session.log.map((entry, i) => (
          <div key={i} style={{ display: "flex", gap: 6, lineHeight: 1.5 }}>
            <span
              style={{ width: 12, fontWeight: 700, color: entry.attacker === "player" ? "var(--info)" : "var(--danger)" }}
            >
              {entry.attacker === "player" ? "Y" : "E"}
            </span>
            <span style={{ color: SPLAT_COLOR[entry.outcome], minWidth: 44 }}>
              {entry.outcome === "miss" ? "miss" : entry.outcome === "block" ? "block" : `hit ${entry.damage}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}