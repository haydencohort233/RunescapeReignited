import { useState, type ReactNode } from "react";
import { useGame } from "../../engine/GameEngineContext";
import type { CraftingRecipe, NpcDefinition, ServantDefinition, StationType } from "../../engine/types";
import { formatDuration } from "../../engine/format";
import { RECIPE_CATALOG } from "../../content/recipes";
import { requestConfirm } from "../../lib/dialog";
import { GpAmount, ItemChip, SkillIcon } from "../ui/GameIcons";
import { Modal } from "../ui/Modal";

const DEPOSITS = [1_000, 10_000, 100_000];

/** Time per item: tenths of a second under 10 s ("4.8s"), else as usual. */
function formatEach(ms: number): string {
  return ms < 10_000 ? `${(ms / 1000).toFixed(1).replace(/\.0$/, "")}s` : formatDuration(ms);
}

/** "20% of your speed · 1 GP/s while working · orders up to 500". */
function ServantTerms({ def }: { def: ServantDefinition }) {
  return (
    <span className="text-small text-muted">
      {Math.round(def.rateShare * 100)}% of your speed · {def.wagePerSecond} GP/s while working · orders up to {def.orderLimit.toLocaleString()}
    </span>
  );
}

/** One servant tier as a row: who they are and what they need. */
function ServantRow({ def, children }: { def: ServantDefinition; children?: ReactNode }) {
  return (
    <div className="servant-row">
      <span className="servant-portrait" aria-hidden="true">
        {def.portrait}
      </span>
      <div className="servant-row-text">
        <strong>{def.name}</strong>
        <span className="text-small">{def.description}</span>
        <ServantTerms def={def} />
      </div>
      {children}
    </div>
  );
}

/**
 * The Servants' Guild: every tier with its Construction level and terms,
 * and a Hire button. The engine checks the rules (place, level, GP, one
 * servant at a time).
 */
export function ServantHirePanel({ npc }: { npc: NpcDefinition }) {
  const { engine, state, actions } = useGame();
  const hired = engine.getHiredServant();
  return (
    <div className="stack-sm">
      <h4 className="section-title">Hire a servant</h4>
      <p className="text-small text-muted">
        Servants work the facilities in your house while you do other things, and you can't use a facility while they do. Wages come out of their coin pouch only while they work. One servant at a time.
      </p>
      {engine.getServantDefinitions().map((def) => {
        const blocker = engine.getServantHireBlocker(npc, def.id);
        const isHired = hired?.id === def.id;
        return (
          <ServantRow key={def.id} def={def}>
            <div className="servant-row-action">
              {isHired ? (
                <span className="tag tag-success">Hired</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!!blocker}
                  title={blocker ?? undefined}
                  onClick={() => {
                    engine.hireServant(npc, def.id);
                    actions.refresh();
                  }}
                >
                  Hire (<GpAmount amount={def.hireCostGp} size={14} bare />)
                </button>
              )}
              <span className={`text-small ${engine.getSkillLevel("construction") >= def.levelRequired ? "text-success" : "text-danger"}`}>
                Construction {def.levelRequired}
              </span>
            </div>
          </ServantRow>
        );
      })}
      {state.servant && !hired && <p className="text-small text-warning">Your servant is gone from the guild's books.</p>}
    </div>
  );
}

/** Recipes the servant can work: those at a facility standing in the house. */
function workableRecipes(placed: Set<StationType>): CraftingRecipe[] {
  return RECIPE_CATALOG.filter((r) => r.station && placed.has(r.station));
}

/**
 * The servant's panel, from the Servant button in the house: who they are,
 * their coin pouch (Deposit GP), the order they're working with its
 * progress and time left, or a picker to give a new one.
 */
export function ServantPanel({ onClose }: { onClose: () => void }) {
  const { engine, state, actions } = useGame();
  const servant = state.servant;
  const def = engine.getHiredServant();

  return (
    <Modal title={def ? `Your ${def.name}` : "Servants"} onClose={onClose}>
      {!servant || !def ? (
        <div className="stack-sm">
          <p className="empty-state">You don't have a servant. Hire one at the Servants' Guild in Draynor Village.</p>
          {engine.getServantDefinitions().map((d) => (
            <ServantRow key={d.id} def={d}>
              <span className={`text-small ${engine.getSkillLevel("construction") >= d.levelRequired ? "text-success" : "text-danger"}`}>Construction {d.levelRequired}</span>
            </ServantRow>
          ))}
        </div>
      ) : (
        <div className="stack-sm">
          <ServantRow def={def} />
          <CoinPouch />
          {servant.order ? <OrderProgress /> : <OrderPicker />}
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                const ok = await requestConfirm(`Dismiss your ${def.name}? Their coin pouch and any unused materials come back to you.`, {
                  confirmLabel: "Dismiss",
                  danger: true,
                });
                if (!ok) return;
                engine.dismissServant();
                actions.refresh();
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CoinPouch() {
  const { engine, state, actions } = useGame();
  const servant = state.servant!;
  const [custom, setCustom] = useState("");
  const gp = Math.floor(engine.getOwnedCount("gp"));
  const purse = Math.floor(servant.purse);

  const deposit = (amount: number) => {
    if (amount > 0) engine.depositServantWages(amount);
    actions.refresh();
  };

  return (
    <div className="card servant-section">
      <div className="row row-between">
        <strong>Coin pouch</strong>
        <GpAmount amount={purse} />
      </div>
      <span className="text-small text-muted">
        {servant.purse > 0 ? `Pays for ${formatDuration(engine.getServantPurseTimeMs())} of work.` : "Empty. An order only starts when the pouch covers all its wages."}
      </span>
      <div className="btn-row servant-deposits">
        {DEPOSITS.map((amount) => (
          <button key={amount} type="button" className="btn" disabled={gp < amount} onClick={() => deposit(amount)}>
            +{amount.toLocaleString()}
          </button>
        ))}
      </div>
      <form
        className="row servant-custom"
        onSubmit={(e) => {
          e.preventDefault();
          deposit(Math.min(gp, Math.floor(Number(custom) || 0)));
          setCustom("");
        }}
      >
        <input type="number" inputMode="numeric" min={1} max={gp} placeholder="GP" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="GP to deposit" />
        <button type="submit" className="btn" disabled={!(Number(custom) >= 1) || gp < 1}>
          Deposit GP
        </button>
      </form>
    </div>
  );
}

function OrderProgress() {
  const { engine, state, actions } = useGame();
  const order = state.servant!.order!;
  const left = engine.getServantOrderTimeLeftMs();
  const shown = order.output?.resource ?? order.inputsPerItem[0]?.resource;

  return (
    <div className="card servant-section">
      <div className="row row-between">
        <span className="row" style={{ gap: 6 }}>
          <SkillIcon skillId={order.skill} />
          <strong>{order.recipeName}</strong>
        </span>
        <span className="text-small text-muted">
          {order.quantityCompleted.toLocaleString()}/{order.quantityTotal.toLocaleString()}
        </span>
      </div>
      {shown && <ItemChip id={shown} />}
      <div className="progress-track cycle-track" aria-hidden="true">
        <div className="progress-fill" style={{ width: `${Math.min(100, (order.progressMs / order.timePerItemMs) * 100)}%` }} />
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${(order.quantityCompleted / order.quantityTotal) * 100}%` }} />
      </div>
      <span className="text-small">
        {formatDuration(left)} left · {formatEach(order.timePerItemMs)} each
      </span>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            engine.cancelServantOrder();
            actions.refresh();
          }}
        >
          Cancel order
        </button>
      </div>
    </div>
  );
}

function OrderPicker() {
  const { engine, state, actions } = useGame();
  const placed = new Set<StationType>();
  for (const p of state.house.layout.inside) {
    const station = engine.getFurnitureDef(p.furnitureId)?.station;
    if (station) placed.add(station);
  }
  const recipes = workableRecipes(placed);
  // Start on the first one there are materials for.
  const [recipeId, setRecipeId] = useState(() => (recipes.find((r) => engine.getServantMaxOrder(r) > 0) ?? recipes[0])?.id ?? "");
  const [qty, setQty] = useState("");
  const recipe = recipes.find((r) => r.id === recipeId) ?? recipes[0];

  if (recipes.length === 0) {
    return (
      <div className="card servant-section">
        <strong>No work to do</strong>
        <span className="text-small text-muted">Servants only work facilities standing in your house. Build and place a Workbench, Cooking Range, Anvil, Furnace or Altar.</span>
      </div>
    );
  }

  const max = recipe ? engine.getServantMaxOrder(recipe) : 0;
  const quantity = Math.floor(Number(qty) || 0);
  const each = recipe ? engine.getServantTimePerItem(recipe) : 0;
  const blocker = recipe ? engine.getServantOrderBlocker(recipe, quantity) : null;
  const wages = recipe ? Math.ceil(engine.getServantOrderWages(recipe, quantity)) : 0;
  // Only the pouch is short (it's the last check): offer to top it up.
  const shortfall = Math.max(0, wages - Math.floor(state.servant!.purse));
  const pouchOnly = !!blocker && shortfall > 0 && blocker.includes("coin pouch");
  const gp = Math.floor(engine.getOwnedCount("gp"));

  return (
    <div className="card servant-section">
      <strong>Give an order</strong>
      <label className="servant-field">
        <span className="text-small text-muted">Make</span>
        <select value={recipe?.id} onChange={(e) => setRecipeId(e.target.value)}>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({engine.getServantMaxOrder(r).toLocaleString()})
            </option>
          ))}
        </select>
      </label>
      {recipe && (
        <>
          <span className="text-small text-muted">
            {recipe.inputs.length > 0 && (
              <>
                Uses{" "}
                {recipe.inputs.map((input, i) => (
                  <span key={input.resource}>
                    {i > 0 && ", "}
                    <ItemChip id={input.resource} amount={input.amount} size={14} />
                  </span>
                ))}{" "}
                each ·{" "}
              </>
            )}
            {formatEach(each)} each · {recipe.xpPerItem} XP each
          </span>
          <div className="row servant-custom">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={max}
              placeholder={`Up to ${max.toLocaleString()}`}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              aria-label="How many"
            />
            <button type="button" className="btn" disabled={max < 1} onClick={() => setQty(String(max))}>
              Max
            </button>
          </div>
          {quantity > 0 && (
            <span className="text-small">
              Takes {formatDuration(each * quantity)} · {wages.toLocaleString()} GP in wages
            </span>
          )}
          {quantity > 0 && blocker && !pouchOnly && <span className="text-small text-warning">{blocker}</span>}
          <div className="btn-row">
            {pouchOnly ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={gp < shortfall}
                title={gp < shortfall ? "Not enough GP" : undefined}
                onClick={() => {
                  if (engine.depositServantWages(shortfall) && engine.startServantOrder(recipe, quantity)) setQty("");
                  actions.refresh();
                }}
              >
                Add {shortfall.toLocaleString()} GP and start
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={quantity < 1 || !!blocker}
                onClick={() => {
                  if (engine.startServantOrder(recipe, quantity)) setQty("");
                  actions.refresh();
                }}
              >
                Start
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
