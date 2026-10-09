import { useGame } from "../engine/GameEngineContext";
import { BUILDING_CATALOG } from "../content/buildings";
import { MAP_LOCATIONS } from "../content/mapLocations";
import { formatNumber, formatDuration } from "../engine/format";
import RichText from "./Richtext";

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 14 }}>
      {/* RichText so a label can embed icons: "<Woodcutting> Logs Chopped" */}
      <span>
        <RichText text={label} />
      </span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default function StatisticsPanel() {
  const { state } = useGame();
  const stat = (key: string) => state.statistics[key] ?? 0;

  return (
    <section style={{ maxWidth: 480 }}>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Statistics</h2>

      <h3 style={{ fontSize: 14, color: "#888", marginBottom: 4 }}>General</h3>
      <StatRow label="Total GP Earned" value={formatNumber(stat("gp:earned"))} />
      <StatRow label="Total GP Spent" value={formatNumber(stat("gp:spent"))} />
      <StatRow label="Overall Exp Gained" value={formatNumber(stat("totalExp"))} />
      <StatRow label="Total Level" value={stat("totalLevel")} />

      <h3 style={{ fontSize: 14, color: "#888", marginTop: 12, marginBottom: 4 }}>Buildings</h3>
      <StatRow label="Buildings Bought (Total)" value={stat("buildingsBought:total")} />
      {BUILDING_CATALOG.map((b) => (
        <StatRow key={b.id} label={`${b.name} Bought`} value={stat(`buildingsBought:${b.id}`)} />
      ))}

      <h3 style={{ fontSize: 14, color: "#888", marginTop: 12, marginBottom: 4 }}>Travel</h3>
      <StatRow label="</assets/items/Abyssal Whip/abyssal_whip.png> Total Travel Time" value={formatDuration(stat("totalTravelTimeMs"))} />
      {MAP_LOCATIONS.map((loc) => (
        <StatRow key={loc.id} label={`Times Traveled to ${loc.name}`} value={stat(`traveledTo:${loc.id}`)} />
      ))}

      <h3 style={{ fontSize: 14, color: "#888", marginTop: 12, marginBottom: 4 }}>Skilling</h3>
      <StatRow label="<Fletching> Bows Fletched" value={stat("crafted:wooden-bow")} />
      <StatRow label="Total Fish Caught" value="Not trackable yet — no active Fishing action exists" />

      <h3 style={{ fontSize: 14, color: "#888", marginTop: 12, marginBottom: 4 }}>Jobs</h3>
      <StatRow label="Jobs Completed" value={stat("jobCompletions:total")} />
    </section>
  );
}