import { useRef, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { ITEM_CATALOG } from "../content/items";
import { SKILL_CATALOG } from "../content/skills";
import { MAX_LEVEL } from "../engine/xpCurve";
import { BUILDING_CATALOG } from "../content/buildings";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../lib/theme";
import { Page, Section } from "./ui/Page";
import { requestConfirm } from "../lib/dialog";

export default function SettingsPanel() {
  const { engine, autosaveMs, actions } = useGame();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [spawnItemId, setSpawnItemId] = useState(ITEM_CATALOG[0].id);
  const [levelInputs, setLevelInputs] = useState<Record<string, number>>({});
  const [theme, setTheme] = useState<ThemeChoice>(getThemeChoice);
  const [pastedSave, setPastedSave] = useState("");

  // Dev actions don't all notify, so re-render explicitly afterwards.
  const dev = (fn: () => void) => () => {
    fn();
    actions.refresh();
  };

  return (
    <Page title="Settings">
      <Section title="Display">
        <div className="card">
          <label className="row row-between">
            <span>Theme</span>
            <select
              id="theme"
              value={theme}
              onChange={(e) => {
                const choice = e.target.value as ThemeChoice;
                setTheme(choice);
                setThemeChoice(choice);
              }}
            >
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="Save data">
        <div className="card">
          <label className="row row-between">
            <span>Autosave every</span>
            <select id="autosave" value={autosaveMs} onChange={(e) => actions.setAutosaveMs(Number(e.target.value))}>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={30000}>30s</option>
              <option value={60000}>60s</option>
            </select>
          </label>
          <div className="btn-row">
            <button type="button" className="btn" onClick={actions.saveNow}>
              Save now
            </button>
            <button type="button" className="btn" onClick={actions.exportSave}>
              Export save
            </button>
            <button type="button" className="btn" onClick={() => importInputRef.current?.click()}>
              Import save file
            </button>
            <input
              id="import-save"
              ref={importInputRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) actions.importSave(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="stack-sm">
            <label className="text-muted" htmlFor="paste-save">
              Or paste an exported save:
            </label>
            <textarea
              id="paste-save"
              className="dialog-text"
              style={{ minHeight: 60 }}
              value={pastedSave}
              onChange={(e) => setPastedSave(e.target.value)}
            />
            <div className="btn-row">
              <button
                type="button"
                className="btn"
                disabled={!pastedSave.trim()}
                onClick={() => {
                  actions.importSaveText(pastedSave);
                  setPastedSave("");
                }}
              >
                Import pasted save
              </button>
            </div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-danger" onClick={() => actions.clearResource("gp")}>
              Clear GP
            </button>
            <button type="button" className="btn btn-danger" onClick={() => actions.clearResource("wood")}>
              Clear wood
            </button>
            <button type="button" className="btn btn-danger" onClick={actions.clearAllResources}>
              Clear all resources
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void requestConfirm("This wipes your entire save and can't be undone. Delete it?", {
                  confirmLabel: "Delete save",
                  danger: true,
                }).then((ok) => ok && actions.resetAll());
              }}
            >
              Delete save
            </button>
          </div>
        </div>
      </Section>

      <Section title="Dev tools">
        <div className="card">
          <p className="text-muted">Buildings — ignores unlock requirements, still costs resources.</p>
          {BUILDING_CATALOG.filter((b) => b.baseCost).map((building) => (
            <div key={building.id} className="row row-between">
              <span>
                {building.name} <span className="text-faint">x{engine.getBuildingQuantity(building.id)}</span>
              </span>
              <span className="btn-row">
                {[1, 5, 25].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="btn"
                    onClick={() => engine.purchaseBuilding(building.id, n, { bypassUnlock: true })}
                  >
                    +{n}
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() =>
                engine.addModifier({
                  id: "buff-woodcutting-frenzy",
                  source: "buff",
                  target: "wood",
                  type: "multiplicative",
                  value: 2,
                  expiresAt: Date.now() + 30_000,
                  label: "Woodcutting Frenzy (x2 wood, 30s)",
                })
              }
            >
              Grant 30s wood x2 buff
            </button>
            <button type="button" className="btn" onClick={() => engine.devForceJobBoardReset()}>
              Force job board reset
            </button>
          </div>
          <div className="row row-between">
            <span>
              HP {Math.ceil(engine.getCurrentHp())}/{engine.getMaxHp()}{" "}
              <span className="text-faint">· combat level {engine.getCombatLevel()}</span>
            </span>
            <span className="btn-row">
              <button type="button" className="btn" onClick={dev(() => engine.devSetCurrentHp(engine.getMaxHp()))}>
                Heal to full
              </button>
              <button type="button" className="btn" onClick={dev(() => engine.devSetCurrentHp(engine.getCurrentHp() - 5))}>
                Take 5 damage
              </button>
            </span>
          </div>
          <div className="row row-between">
            <select id="spawn-item" value={spawnItemId} onChange={(e) => setSpawnItemId(e.target.value)}>
              {ITEM_CATALOG.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <span className="btn-row">
              {[1, 5, 25].map((n) => (
                <button key={n} type="button" className="btn" onClick={dev(() => engine.addItem(spawnItemId, n))}>
                  +{n}
                </button>
              ))}
            </span>
          </div>
        </div>

        <div className="card">
          <p className="text-muted">Set a skill to the exact XP for a level.</p>
          {SKILL_CATALOG.map((skill) => (
            <div key={skill.id} className="row row-between">
              <span>
                {skill.name} <span className="text-faint">level {engine.getSkillLevel(skill.id)}</span>
              </span>
              <span className="btn-row">
                <input
                  id={`set-level-${skill.id}`}
                  type="number"
                  min={1}
                  max={MAX_LEVEL}
                  value={levelInputs[skill.id] ?? engine.getSkillLevel(skill.id)}
                  onChange={(e) => setLevelInputs((prev) => ({ ...prev, [skill.id]: Number(e.target.value) }))}
                  style={{ width: 64 }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={dev(() => engine.setSkillLevel(skill.id, levelInputs[skill.id] ?? 1))}
                >
                  Set
                </button>
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Notification history">
        <div className="card history-log">
          {engine.notifications.getHistory().map((n) => (
            <div
              key={n.id}
              className={`data-row text-small${n.severity === "error" ? " text-danger" : ""}`}
            >
              <span>{n.message}</span>
              <span className="text-faint">{new Date(n.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </Section>
    </Page>
  );
}
