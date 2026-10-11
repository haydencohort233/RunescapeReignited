import { useGame } from "../engine/GameEngineContext";
import { BUILDING_CATALOG } from "../content/buildings";
import { MAP_LOCATIONS } from "../content/mapLocations";
import { RECIPE_CATALOG } from "../content/recipes";
import { ENEMY_CATALOG } from "../content/enemies";
import { formatStatisticValue, statisticName } from "../content/display";
import { Page, Section } from "./ui/Page";

/** The statistics shown, grouped. Labels come from content/display.ts so
 *  they match condition text elsewhere ("Goblin kills", "GP spent"). */
const GROUPS: { title: string; keys: string[] }[] = [
  { title: "General", keys: ["gp:earned", "gp:spent", "totalExp", "totalLevel", "questsCompleted", "jobCompletions:total"] },
  {
    title: "Buildings",
    keys: ["buildingsBought:total", "buildingsSold:total", ...BUILDING_CATALOG.filter((b) => b.baseCost).map((b) => `buildingsBought:${b.id}`)],
  },
  { title: "Travel", keys: ["totalTravelTimeMs", "locationsDiscovered", ...MAP_LOCATIONS.map((l) => `traveledTo:${l.id}`)] },
  {
    title: "Skilling",
    keys: RECIPE_CATALOG.map((r) => (r.inputs.length > 0 ? `crafted:${r.id}` : `gathered:${r.id}`)),
  },
  { title: "Combat", keys: ["kills:total", "deaths", "gp:lostOnDeath", ...ENEMY_CATALOG.map((e) => `kills:${e.id}`)] },
];

export default function StatisticsPanel() {
  const { state } = useGame();
  // Gathering recipes run as open sessions (gathered:<id>) or as fixed
  // batches through the crafting path (crafted:<id>); count both.
  const value = (key: string) =>
    (state.statistics[key] ?? 0) +
    (key.startsWith("gathered:") ? (state.statistics[`crafted:${key.slice("gathered:".length)}`] ?? 0) : 0);
  return (
    <Page title="Statistics">
      {GROUPS.map((group) => (
        <Section key={group.title} title={group.title}>
          <div className="card">
            <div>
              {group.keys.map((key) => (
                <div key={key} className="data-row">
                  <span>{statisticName(key)}</span>
                  <span>{formatStatisticValue(key, value(key))}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      ))}
    </Page>
  );
}
