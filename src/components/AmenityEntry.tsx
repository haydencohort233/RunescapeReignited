import { useContext, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { AMENITY_ICON, type Amenity, type CraftingStationAmenity, type ResourceNodeAmenity } from "../content/amenities";
import { getShop } from "../content/shops";
import { getNpc } from "../content/npcs";
import { getItemDef } from "../content/items";
import { recipesAtStation } from "../content/recipes";
import { openHouse, showDialogue } from "../lib/dialog";
import { greetingFor, nextLine, questsGivenBy, talkTo } from "./npcTalk";
import { isQuestReadyToHandIn } from "./map/locationStatus";
import { ChatHead } from "./ui/Conversation";
import { CraftCard, GatherCard } from "./TrainingCards";
import ItemIcon from "./ItemIcon";
import type { GameEngine } from "../engine/gameEngine";
import type { NpcDefinition, ShopDefinition } from "../engine/types";
import { getJobBoard } from "../content/jobBoards";
import { getRecipe } from "../content/recipes";
import { CONDITION_LABELS } from "../content/display";
import { describeUnmetCondition } from "../engine/unlockConditions";
import ShopBrowsePanel from "./ShopBrowsePanel";
import JobBoardBrowsePanel from "./JobBoardBrowsePanel";
import CombatPanel from "./CombatPanel";
import DungeonCard from "./DungeonCard";
import { ActionCard, LockedCard } from "./ui/ActionCard";
import { CardPanelContext } from "./ui/cardPanel";
import { ServantHirePanel } from "./house/ServantPanel";

/** One amenity at the CURRENT location, as a card. Every kind uses the same
 *  pattern (see ActionCard): click to show its actions, right-click for
 *  the same actions in a menu, dashed card with a reason when locked. */
export default function AmenityEntry({ amenity, onStarted }: { amenity: Amenity; onStarted?: () => void }) {
  const { state } = useGame();
  const icon = AMENITY_ICON[amenity.kind];

  const lockReason = amenity.unlockCondition
    ? describeUnmetCondition(amenity.unlockCondition, state, CONDITION_LABELS)
    : null;
  if (lockReason) return <LockedCard icon={icon} title={amenity.name} reason={lockReason} />;

  switch (amenity.kind) {
    case "housePortal":
      return (
        <ActionCard
          icon={icon}
          title={amenity.name}
          description={amenity.description}
          actions={[{ label: "Enter your house", variant: "primary", onClick: openHouse }]}
        />
      );
    case "shop":
      return <ShopCard shopId={amenity.shopId} />;
    case "jobBoard":
      return <JobBoardCard boardId={amenity.boardId} name={amenity.name} />;
    case "combatEncounter":
      return <CombatPanel enemyId={amenity.enemyId} />;
    case "resourceNode":
      return <ResourceNodeCard amenity={amenity} onStarted={onStarted} />;
    case "craftingStation":
      return <StationCard amenity={amenity} onStarted={onStarted} />;
    case "npc":
      return <NpcCard npcId={amenity.npcId} description={amenity.description} />;
    case "dungeonEntrance":
      return <DungeonCard dungeonId={amenity.dungeonId} description={amenity.description} />;
  }
}

/** A range, furnace or anvil: the recipes made there. */
function StationCard({ amenity, onStarted }: { amenity: CraftingStationAmenity; onStarted?: () => void }) {
  const recipes = recipesAtStation(amenity.station);
  return (
    <ActionCard icon={AMENITY_ICON.craftingStation} title={amenity.name} description={amenity.description} actions={[]}>
      <div className="stack-sm">
        {recipes.map((recipe) => (
          <CraftCard key={recipe.id} recipe={recipe} onStarted={onStarted} />
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

/** Someone to talk to: their chat head, a line of greeting, the quests
 *  they give out, and what they can do for you. "Talk" opens the
 *  conversation, which is where quests start and hand-ins happen. */
function NpcCard({ npcId, description }: { npcId: string; description: string }) {
  const { engine } = useGame();
  const npc = getNpc(npcId);
  // One greeting per visit to the card, not a new one every render.
  const [greeting] = useState(() => (npc ? greetingFor(engine, npc) : ""));
  if (!npc) return null;
  const recharges = npc.services?.includes("recharge");
  const quests = questsGivenBy(npc.id);
  return (
    <ActionCard
      icon={AMENITY_ICON.npc}
      title={npc.name}
      meta={npc.title}
      description={
        <div className="npc-intro">
          <ChatHead name={npc.name} portrait={npc.portrait} size={64} />
          <div className="npc-intro-text">
            <p className="npc-greeting">"{greeting}"</p>
            <p className="text-muted text-small">{description}</p>
          </div>
        </div>
      }
      actions={[{ label: `Talk to ${npc.name}`, variant: "primary", onClick: () => void talkTo(engine, npc, greeting) }]}
    >
      {quests.length > 0 && (
        <ul className="npc-quests">
          {quests.map((quest) => {
            const status = engine.getQuestStatus(quest.id);
            const canStart = engine.canStartQuest(quest.id);
            return (
              <li key={quest.id} className="map-quest">
                <span className="map-badge is-quest" aria-hidden="true">
                  Q
                </span>
                <span className="map-quest-name">{quest.name}</span>
                {status === "completed" ? (
                  <span className="tag tag-success">Done</span>
                ) : status === "in-progress" ? (
                  isQuestReadyToHandIn(engine, quest) ? (
                    <span className="tag tag-success">Ready to hand in</span>
                  ) : (
                    <span className="tag tag-gold">In progress</span>
                  )
                ) : canStart ? (
                  <span className="tag">Available</span>
                ) : (
                  <span className="tag">🔒</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {npc.services?.includes("servants") && <ServantHirePanel npc={npc} />}
      {recharges && (
        <div className="stack-sm">
          <h4 className="section-title">Recharge jewellery</h4>
          <RechargePanel engine={engine} npc={npc} />
        </div>
      )}
    </ActionCard>
  );
}

function ShopCard({ shopId }: { shopId: string }) {
  const { engine } = useGame();
  const asPanel = useContext(CardPanelContext);
  // By the amenity's own shopId: a location lookup always found the first
  // shop there, so a second shop at the same place was unreachable.
  const shop = getShop(shopId);
  if (!shop) return null;
  const browse = <ShopBrowsePanel shop={shop} repairPanel={shop.repairs ? <RepairPanel engine={engine} shop={shop} /> : undefined} />;
  // Opened from the town scene: the shop is the whole panel (the greeting
  // replaces "Talk to").
  if (asPanel) return browse;
  return (
    <ActionCard
      icon={AMENITY_ICON.shop}
      title={shop.title}
      meta={shop.npcName}
      actions={[
        {
          label: `Talk to ${shop.npcName}`,
          onClick: () => void showDialogue(shop.npcName, nextLine(shop.dialogue, "Have a look around.")),
        },
      ]}
    >
      {browse}
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
      actions={[]}
    >
      <JobBoardBrowsePanel board={board} />
    </ActionCard>
  );
}

/** A gathering spot: the same training card as the skill page, for this
 *  one spot. */
function ResourceNodeCard({ amenity, onStarted }: { amenity: ResourceNodeAmenity; onStarted?: () => void }) {
  const recipe = getRecipe(amenity.recipeId);
  if (!recipe) return null;
  return <GatherCard recipe={recipe} node={amenity} onStarted={onStarted} />;
}
