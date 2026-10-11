import { useGame } from "../engine/GameEngineContext";
import { getLocation } from "../content/mapLocations";
import { getAmenitiesAtLocation } from "../content/amenities";
import ResourceList from "./ResourceList";
import RecipeList from "./RecipeList";
import AmenityEntry from "./AmenityEntry";
import ActivityCard from "./ActivityCard";
import { EmptyState, Page, Section } from "./ui/Page";
import { getActiveTravel } from "../engine/activeAction";

/**
 * The main/home tab — where players spend most of their time: what you're
 * doing, what's at your current location, your resources, and crafting.
 * New amenity kinds and recipes show up here without layout changes.
 */
export default function HomeView() {
  const { state } = useGame();
  const currentLocation = getLocation(state.currentLocationId);
  const amenities = getAmenitiesAtLocation(state.currentLocationId);
  const travel = getActiveTravel(state);

  // On the road there's nowhere to be "here": just the trip.
  if (travel) {
    return (
      <Page title={`On the road to ${travel.destinationName}`}>
        <ActivityCard />
        <EmptyState>
          You left {currentLocation?.name ?? "town"}. You can't do anything until you arrive, or you can cancel the trip.
        </EmptyState>
        <div className="home-resources">
          <Section title="Resources">
            <ResourceList />
          </Section>
        </div>
      </Page>
    );
  }

  return (
    <Page title={currentLocation?.name ?? "Unknown location"}>
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

      <div className="home-resources">
        <Section title="Resources">
          <ResourceList />
        </Section>
      </div>

      <Section title="Crafting">
        <RecipeList />
      </Section>
    </Page>
  );
}
