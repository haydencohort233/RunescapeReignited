import { useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { ITEM_CATALOG } from "../content/items";
import { SKILL_CATALOG } from "../content/skills";
import { MAX_LEVEL } from "../engine/xpCurve";

export default function SettingsPanel() {
  const { engine, state, autosaveMs, actions } = useGame();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [spawnItemId, setSpawnItemId] = useState(ITEM_CATALOG[0].id);
  const [levelInputs, setLevelInputs] = useState<Record<string, number>>({});

  return (
    <section style={{ fontSize: 14, maxWidth: 480 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Settings</h2>

      <div style={{ marginBottom: 12 }}>
        <label>
          Autosave every{" "}
          <select value={autosaveMs} onChange={(e) => actions.setAutosaveMs(Number(e.target.value))}>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={60000}>60s</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={actions.saveNow}>Save Now</button>
        <button onClick={actions.exportSave}>Export Save</button>
        <button onClick={() => importInputRef.current?.click()}>Import Save</button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) actions.importSave(file);
            e.target.value = "";
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button onClick={() => actions.clearResource("gp")}>Clear GP</button>
        <button onClick={() => actions.clearResource("wood")}>Clear Wood</button>
        <button onClick={actions.clearAllResources}>Clear All Resources</button>
        <button
          onClick={() => {
            if (window.confirm("This wipes your entire save. Are you sure?")) {
              actions.resetAll();
            }
          }}
          style={{ color: "#b91c1c" }}
        >
          Clear Save Data
        </button>
      </div>

      <h3 style={{ fontSize: 15 }}>Dev Tools</h3>
      <p style={{ fontSize: 12, color: "#888", marginTop: -4 }}>
        Bypasses unlock conditions and cost checks won't stop you — this list is generated from
        whatever producers are currently registered, so it automatically covers new buildings as
        they're added to the content catalog.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.values(state.producers).map((producer) => (
          <div key={producer.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ minWidth: 120 }}>
              {producer.name} (x{producer.quantity})
            </span>
            {[1, 5, 25].map((n) => (
              <button
                key={n}
                onClick={() => engine.purchaseProducer(producer.id, n, { bypassUnlock: true })}
              >
                +{n}
              </button>
            ))}
          </div>
        ))}
      </div>

      <button style={{ marginTop: 8 }} onClick={() => engine.devForceJobBoardReset()}>
        Force Job Board Reset
      </button>

      <h3 style={{ fontSize: 15, marginTop: 16 }}>Combat</h3>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 13 }}>
          HP: {Math.ceil(engine.getCurrentHp())}/{engine.getMaxHp()} (Combat Level {engine.getCombatLevel()})
        </span>
        <button onClick={() => engine.devSetCurrentHp(engine.getMaxHp())}>Heal to Full</button>
        <button onClick={() => engine.devSetCurrentHp(engine.getCurrentHp() - 5)}>Take 5 Damage</button>
      </div>

      <h3 style={{ fontSize: 15, marginTop: 16 }}>Spawn Item</h3>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={spawnItemId} onChange={(e) => setSpawnItemId(e.target.value)}>
          {ITEM_CATALOG.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {[1, 5, 25].map((n) => (
          <button
            key={n}
            onClick={() => {
              const def = ITEM_CATALOG.find((i) => i.id === spawnItemId);
              if (def) engine.addItem(def.id, n, { stackable: def.stackable, unique: def.unique });
            }}
          >
            +{n}
          </button>
        ))}
      </div>

      <h3 style={{ fontSize: 15, marginTop: 16 }}>Set Skill Level</h3>
      <p style={{ fontSize: 12, color: "#888", marginTop: -4 }}>
        Sets XP to the exact threshold for that level — useful for testing things like Agility's
        effect on travel speed without grinding.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {SKILL_CATALOG.map((skill) => (
          <div key={skill.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ minWidth: 100 }}>
              {skill.name} (lvl {engine.getSkillLevel(skill.id)})
            </span>
            <input
              type="number"
              min={1}
              max={MAX_LEVEL}
              value={levelInputs[skill.id] ?? engine.getSkillLevel(skill.id)}
              onChange={(e) =>
                setLevelInputs((prev) => ({ ...prev, [skill.id]: Number(e.target.value) }))
              }
              style={{ width: 60 }}
            />
            <button
              onClick={() => engine.setSkillLevel(skill.id, levelInputs[skill.id] ?? 1)}
            >
              Set
            </button>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 15, marginTop: 16 }}>Notification History</h3>
      <p style={{ fontSize: 12, color: "#888", marginTop: -4 }}>
        Everything that's happened, including notifications that got replaced or auto-dismissed —
        most recent first.
      </p>
      <div
        style={{
          maxHeight: 240,
          overflowY: "auto",
          border: "1px solid #ddd",
          borderRadius: 6,
          padding: 8,
        }}
      >
        {engine.notifications.getHistory().map((n) => (
          <div
            key={n.id}
            style={{
              fontSize: 12,
              padding: "3px 0",
              borderBottom: "1px solid #f0f0f0",
              color: n.severity === "error" ? "#b91c1c" : n.severity === "warning" ? "#92400e" : "#333",
            }}
          >
            <span style={{ color: "#999" }}>{new Date(n.timestamp).toLocaleTimeString()}</span>{" "}
            {n.message}
          </div>
        ))}
      </div>
    </section>
  );
}