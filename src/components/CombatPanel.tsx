import { useEffect, useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getEnemy } from "../content/enemies";
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
  hit: "#b91c1c", // red — real damage, matches OSRS
  block: "#2563eb", // blue — landed but rolled 0
  miss: "#9ca3af", // gray — didn't land at all
};

/** The fight UI for a combatEncounter amenity. Auto-resolves via the
 *  engine's own tick — this component doesn't drive combat, it just
 *  reflects state.activeCombatSession and offers the optional interactive
 *  "Attack Now" override plus Flee. */
export default function CombatPanel({ enemyId }: { enemyId: string }) {
  const { engine, state } = useGame();
  const [, forceTick] = useState(0);
  const [splats, setSplats] = useState<ActiveSplat[]>([]);
  const lastLogLengthRef = useRef(0);
  const enemy = getEnemy(enemyId);

  useEffect(() => {
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const session = state.activeCombatSession;

  // Spawns a hitsplat for every log entry that's new since the last render.
  // "attacker: player" means the PLAYER dealt it, so it floats over the
  // ENEMY's bar (and vice versa) — same as OSRS showing a splat on whoever
  // got hit, not whoever swung.
  useEffect(() => {
    if (!session) {
      lastLogLengthRef.current = 0;
      return;
    }
    const newEntries = session.log.slice(lastLogLengthRef.current);
    lastLogLengthRef.current = session.log.length;
    if (newEntries.length === 0) return;

    const newSplats: ActiveSplat[] = newEntries.map((entry, i) => ({
      id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      side: entry.attacker === "player" ? "enemy" : "player",
      outcome: entry.outcome,
      damage: entry.damage,
    }));
    setSplats((prev) => [...prev, ...newSplats]);

    const timer = setTimeout(() => {
      setSplats((prev) => prev.filter((s) => !newSplats.some((n) => n.id === s.id)));
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.log.length]);

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
    return (
      <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong>⚔️ {enemy.name}</strong>
          {enemy.isBoss && <span style={{ fontSize: 11, color: "#b8860b" }}>Boss</span>}
        </div>
        <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>Max HP: {enemy.maxHp}</p>
        <button
          onClick={() => {
            const bonuses = getEquipmentBonuses(state);
            engine.startCombat(enemy, bonuses);
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
    <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: 8 }}>
      <style>{`
        @keyframes hitsplatFloat {
          0% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -24px); }
        }
      `}</style>

      <strong>⚔️ Fighting {session.enemyName}</strong>

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

      <p style={{ fontSize: 12, color: "#666", margin: "6px 0 0" }}>
        Your next attack: {nextPlayerAttackSeconds}s (every {(session.playerAttackSpeedMs / 1000).toFixed(1)}
        s) — {session.enemyName}'s next attack: {nextEnemyAttackSeconds}s (every{" "}
        {(session.enemyAttackSpeedMs / 1000).toFixed(1)}s)
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={() => engine.attackNow()}>Attack Now</button>
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
          border: "1px solid #eee",
          borderRadius: 4,
          padding: "4px 6px",
          display: "flex",
          flexDirection: "column-reverse", // newest at top
        }}
      >
        {session.log.length === 0 && <span style={{ color: "#999" }}>No attacks yet.</span>}
        {session.log.map((entry, i) => (
          <div key={i} style={{ display: "flex", gap: 6, lineHeight: 1.5 }}>
            <span
              style={{ width: 12, fontWeight: 700, color: entry.attacker === "player" ? "#1a5fa8" : "#b91c1c" }}
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