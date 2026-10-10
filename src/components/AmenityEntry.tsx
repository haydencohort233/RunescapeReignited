import { useGame } from "../engine/GameEngineContext";
import { AMENITY_ICON, type Amenity, type ResourceNodeAmenity } from "../content/amenities";
import { getShop } from "../content/shops";
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
    case "dungeonEntrance":
      return <PlaceholderCard amenity={amenity} />;
  }
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
          onClick: () => engine.notifications.push("status", `${shop.npcName} has nothing to say right now.`),
        },
      ]}
    >
      <ShopBrowsePanel shop={shop} />
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
  const icon = AMENITY_ICON.resourceNode;
  const recipe = getRecipe(amenity.recipeId);
  if (!recipe) return null;

  // The recipe can gate things too (e.g. Woodcutting 30 for Willow),
  // separately from the amenity's own unlock.
  const recipeLock = recipe.unlockCondition
    ? describeUnmetCondition(recipe.unlockCondition, state, CONDITION_LABELS)
    : null;
  if (recipeLock) return <LockedCard icon={icon} title={amenity.name} reason={recipeLock} />;

  if (amenity.gatherMode === "batch") {
    return (
      <ActionCard
        icon={icon}
        title={amenity.name}
        description={amenity.description}
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
    meta = `${active.quantityGathered.toLocaleString()} gathered · ends in ${formatCountdown(endsIn)}`;
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
      description={amenity.description}
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
