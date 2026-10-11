import { useGame } from "../engine/GameEngineContext";
import { AMENITY_ICON, type Amenity, type CraftingStationAmenity, type ResourceNodeAmenity } from "../content/amenities";
import { getShop } from "../content/shops";
import { getNpc } from "../content/npcs";
import { getItemDef } from "../content/items";
import { recipesAtStation } from "../content/recipes";
import { showDialogue } from "../lib/dialog";
import { RecipeCard } from "./RecipeList";
import ItemIcon from "./ItemIcon";
import type { GameEngine } from "../engine/gameEngine";
import type { NpcDefinition, ShopDefinition } from "../engine/types";
import { getJobBoard } from "../content/jobBoards";
import { getRecipe } from "../content/recipes";
import { CONDITION_LABELS } from "../content/display";
import { getMsUntilNextDailyReset, formatCountdown } from "../engine/time";
import { describeUnmetCondition } from "../engine/unlockConditions";
import { confirmAndStartCraftJob, confirmAndStartGatherSession } from "../engine/actionHelpers";
import { getActiveGatherSession } from "../engine/activeAction";
import ShopBrowsePanel from "./ShopBrowsePanel";
import JobBoardBrowsePanel from "./JobBoardBrowsePanel";
import CombatPanel from "./CombatPanel";
import { ActionCard, LockedCard } from "./ui/ActionCard";
import { RecipeYield, SkillIcon } from "./ui/GameIcons";

const BATCH_SIZES = [1, 5, 10, 25];

/** One amenity at the CURRENT location, as a card. Every kind uses the same
 *  pattern (see ActionCard): click to show its actions, right-click for
 *  the same actions in a menu, dashed card with a reason when locked. */
export default function AmenityEntry({ amenity }: { amenity: Amenity }) {
  const { state } = useGame();
  const icon = AMENITY_ICON[amenity.kind];

  const lockReason = amenity.unlockCondition
    ? describeUnmetCondition(amenity.unlockCondition, state, CONDITION_LABELS)
    : null;
  if (lockReason) return <LockedCard icon={icon} title={amenity.name} reason={lockReason} />;

  switch (amenity.kind) {
    case "shop":
      return <ShopCard shopId={amenity.shopId} />;
    case "jobBoard":
      return <JobBoardCard boardId={amenity.boardId} name={amenity.name} />;
    case "combatEncounter":
      return <CombatPanel enemyId={amenity.enemyId} />;
    case "resourceNode":
      return <ResourceNodeCard amenity={amenity} />;
    case "craftingStation":
      return <StationCard amenity={amenity} />;
    case "npc":
      return <NpcCard npcId={amenity.npcId} description={amenity.description} />;
    case "dungeonEntrance":
      return <PlaceholderCard amenity={amenity} />;
  }
}

function randomLine(lines: string[] | undefined, fallback: string): string {
  return lines && lines.length > 0 ? lines[Math.floor(Math.random() * lines.length)] : fallback;
}

/** A range, furnace or anvil: the recipes made there. */
function StationCard({ amenity }: { amenity: CraftingStationAmenity }) {
  const recipes = recipesAtStation(amenity.station);
  return (
    <ActionCard icon={AMENITY_ICON.craftingStation} title={amenity.name} description={amenity.description} actions={[]}>
      <div className="stack-sm">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
    </ActionCard>
  );
}

/** Every copy of something that can be repaired, with what it costs. */
function RepairPanel({ engine, shop }: { engine: GameEngine; shop: ShopDefinition }) {
  const { actions } = useGame();
  const repairable = engine.getInventoryItems().filter((i) => engine.getRepairCost(i.instanceId) > 0);
  if (repairable.length === 0) return <p className="text-faint text-small">{shop.npcName} can repair worn or broken gear. Nothing of yours needs it.</p>;
  return (
    <div className="stack-sm">
      <span className="text-small">Repairs</span>
      {repairable.map((instance) => {
        const def = getItemDef(instance.itemDefId);
        if (!def) return null;
        const cost = engine.getRepairCost(instance.instanceId);
        return (
          <div key={instance.instanceId} className="row row-between">
            <span className="row" style={{ gap: 6 }}>
              <ItemIcon def={def} size={20} />
              {def.name}
            </span>
            <button
              type="button"
              className="btn"
              disabled={engine.getOwnedCount("gp") < cost}
              title={engine.getOwnedCount("gp") < cost ? "Not enough GP" : undefined}
              onClick={() => {
                engine.repairItem(shop.id, instance.instanceId);
                actions.refresh();
              }}
            >
              Repair ({cost.toLocaleString()} GP)
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Charged jewellery the NPC can refill, with what it costs. */
function RechargePanel({ engine, npc }: { engine: GameEngine; npc: NpcDefinition }) {
  const { actions } = useGame();
  const charged = engine.getInventoryItems().filter((i) => getItemDef(i.itemDefId)?.maxCharges !== undefined);
  if (charged.length === 0) return <p className="text-faint text-small">You have no charged jewellery for {npc.name} to look at.</p>;
  return (
    <div className="stack-sm">
      {charged.map((instance) => {
        const def = getItemDef(instance.itemDefId)!;
        const cost = engine.getRechargeCost(instance.instanceId);
        const full = cost <= 0;
        return (
          <div key={instance.instanceId} className="row row-between">
            <span className="row" style={{ gap: 6 }}>
              <ItemIcon def={def} size={20} />
              {def.name} ({instance.charges ?? 0}/{def.maxCharges})
            </span>
            <button
              type="button"
              className="btn"
              disabled={full || engine.getOwnedCount("gp") < cost}
              title={full ? "Already fully charged" : engine.getOwnedCount("gp") < cost ? "Not enough GP" : undefined}
              onClick={() => {
                engine.rechargeItem(npc, instance.instanceId);
                actions.refresh();
              }}
            >
              {full ? "Full" : `Recharge (${cost.toLocaleString()} GP)`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Someone to talk to who may offer a service (Aggie recharges jewellery). */
function NpcCard({ npcId, description }: { npcId: string; description: string }) {
  const { engine } = useGame();
  const npc = getNpc(npcId);
  if (!npc) return null;
  const recharges = npc.services?.includes("recharge");
  const talk = async () => {
    const choice = await showDialogue(
      npc.name,
      randomLine(npc.dialogue, "Hello."),
      recharges ? ["Can you recharge my jewellery?"] : []
    );
    if (choice === 0 && recharges) {
      const charged = engine.getInventoryItems().filter((i) => getItemDef(i.itemDefId)?.maxCharges !== undefined);
      const needing = charged.filter((i) => engine.getRechargeCost(i.instanceId) > 0);
      if (needing.length === 0) {
        await showDialogue(npc.name, charged.length === 0 ? "You've nothing for me to charge, dearie." : "Those are full already. Come back when they're spent.");
        return;
      }
      const total = needing.reduce((sum, i) => sum + engine.getRechargeCost(i.instanceId), 0);
      const yes = await showDialogue(npc.name, `That'll be ${total.toLocaleString()} GP for the lot.`, ["Here you go.", "That's too much."]);
      if (yes === 0) for (const i of needing) engine.rechargeItem(npc, i.instanceId);
    }
  };
  return (
    <ActionCard icon={AMENITY_ICON.npc} title={npc.name} description={description} actions={[{ label: `Talk to ${npc.name}`, variant: "primary", onClick: () => void talk() }]}>
      {recharges && <RechargePanel engine={engine} npc={npc} />}
    </ActionCard>
  );
}

function ShopCard({ shopId }: { shopId: string }) {
  const { engine } = useGame();
  // By the amenity's own shopId: a location lookup always found the first
  // shop there, so a second shop at the same place was unreachable.
  const shop = getShop(shopId);
  if (!shop) return null;
  return (
    <ActionCard
      icon={AMENITY_ICON.shop}
      title={shop.title}
      meta={shop.npcName}
      actions={[
        {
          label: `Talk to ${shop.npcName}`,
          onClick: () => void showDialogue(shop.npcName, randomLine(shop.dialogue, "Have a look around.")),
        },
      ]}
    >
      <ShopBrowsePanel shop={shop} />
      {shop.repairs && <RepairPanel engine={engine} shop={shop} />}
    </ActionCard>
  );
}

function JobBoardCard({ boardId, name }: { boardId: string; name: string }) {
  const board = getJobBoard(boardId);
  if (!board) return null;
  return (
    <ActionCard
      icon={AMENITY_ICON.jobBoard}
      title={name}
      meta={`Resets in ${formatCountdown(getMsUntilNextDailyReset(Date.now()))}`}
      actions={[]}
    >
      <JobBoardBrowsePanel board={board} />
    </ActionCard>
  );
}

function PlaceholderCard({ amenity }: { amenity: Amenity }) {
  const { engine } = useGame();
  const isDungeon = amenity.kind === "dungeonEntrance";
  return (
    <ActionCard
      icon={AMENITY_ICON[amenity.kind]}
      title={amenity.name}
      description={amenity.description}
      actions={[
        {
          label: isDungeon ? "Enter" : "Use",
          onClick: () =>
            engine.notifications.push(
              "status",
              isDungeon ? "Dungeons aren't implemented yet." : "Nothing usable here yet.",
              { severity: "warning" }
            ),
        },
      ]}
    />
  );
}

function ResourceNodeCard({ amenity }: { amenity: ResourceNodeAmenity }) {
  const { engine, state, actions } = useGame();
  const recipe = getRecipe(amenity.recipeId);
  if (!recipe) return null;
  // The skill it trains, so a tree reads as Woodcutting at a glance.
  const icon = <SkillIcon skillId={recipe.skill} size={20} />;
  const description = (
    <>
      {amenity.description}
      <RecipeYield recipe={recipe} />
      <span className="text-faint text-small">
        {(engine.getEffectiveTimePerItem(recipe) / 1000).toFixed(1)}s · {recipe.xpPerItem} XP each
        {recipe.tool && engine.getBestTool(recipe.tool) && ` · using ${engine.getBestTool(recipe.tool)!.name}`}
      </span>
    </>
  );

  // The recipe can gate things too (e.g. Woodcutting 30 for Willow),
  // separately from the amenity's own unlock, and so can a missing tool.
  const recipeLock = recipe.unlockCondition
    ? describeUnmetCondition(recipe.unlockCondition, state, CONDITION_LABELS)
    : engine.getRecipeStartBlocker(recipe);
  if (recipeLock) return <LockedCard icon={icon} title={amenity.name} reason={recipeLock} />;

  if (amenity.gatherMode === "batch") {
    return (
      <ActionCard
        icon={icon}
        title={amenity.name}
        description={description}
        actions={BATCH_SIZES.map((n) => ({
          label: `${amenity.actionLabel} x${n}`,
          onClick: () => confirmAndStartCraftJob(engine, recipe, n),
        }))}
      />
    );
  }

  // gatherMode === "session" — open-ended, Start / Tend / Stop.
  const session = getActiveGatherSession(state);
  const active = session?.amenityId === amenity.id ? session : null;

  let meta: string | undefined;
  if (active) {
    const now = Date.now();
    const endsIn = Math.max(0, active.startedAt + active.maxDurationMs - now);
    meta = `x${active.quantityGathered.toLocaleString()} · ends in ${formatCountdown(endsIn)}`;
    if (active.requiresKeepAliveEveryMs !== undefined && active.lastKeepAliveAt !== undefined) {
      const tendIn = Math.max(0, active.lastKeepAliveAt + active.requiresKeepAliveEveryMs - now);
      meta += ` · tend within ${formatCountdown(tendIn)}`;
    }
  }

  return (
    <ActionCard
      className={active ? "is-active" : ""}
      icon={icon}
      title={amenity.name}
      meta={meta}
      description={description}
      actions={
        active
          ? [
              ...(active.requiresKeepAliveEveryMs !== undefined
                ? [
                    {
                      label: "Tend to it",
                      variant: "primary" as const,
                      onClick: () => {
                        engine.keepGatherSessionAlive();
                        actions.refresh();
                      },
                    },
                  ]
                : []),
              { label: "Stop", onClick: () => engine.stopGatherSession() },
            ]
          : [
              {
                label: amenity.actionLabel,
                variant: "primary" as const,
                onClick: () =>
                  confirmAndStartGatherSession(engine, amenity.id, recipe, {
                    maxDurationMs: amenity.maxDurationMs,
                    requiresKeepAliveEveryMs: amenity.requiresKeepAliveEveryMs,
                  }),
              },
            ]
      }
    />
  );
}
