import { useGame } from "../engine/GameEngineContext";
import { getLocation } from "../content/mapLocations";
import { getAmenitiesAtLocation } from "../content/amenities";
import ResourceList from "./ResourceList";
import RecipeList from "./RecipeList";
import AmenityEntry from "./AmenityEntry";
import ActivityCard from "./ActivityCard";
import HpBar from "./HpBar";
import { EmptyState, Page, Section } from "./ui/Page";

/**
 * The main/home tab — where players spend most of their time: what you're
 * doing, what's at your current location, your resources, and crafting.
 * New amenity kinds and recipes show up here without layout changes.
 */
export default function HomeView() {
  const { engine, state } = useGame();
  const currentLocation = getLocation(state.currentLocationId);
  const amenities = getAmenitiesAtLocation(state.currentLocationId);

  return (
    <Page title={currentLocation?.name ?? "Unknown location"}>
      <div className="card">
        <HpBar current={engine.getCurrentHp()} max={engine.getMaxHp()} label="Health" />
      </div>

      <ActivityCard />

      <Section title="Here">
        {amenities.length === 0 ? (
          <EmptyState>There's nothing to do here yet.</EmptyState>
        ) : (
          <div className="stack">
            {amenities.map((amenity) => (
              <AmenityEntry key={amenity.id} amenity={amenity} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Resources">
        <ResourceList />
      </Section>

      <Section title="Crafting">
        <RecipeList />
      </Section>
    </Page>
  );
}
