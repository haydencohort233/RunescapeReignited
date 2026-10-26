import { useCallback, useEffect, useState } from "react";
import { useGame } from "../engine/GameEngineContext";
import { getLocation } from "../content/mapLocations";
import { getAmenitiesAtLocation, type Amenity } from "../content/amenities";
import { getTownScene } from "../content/townScenes";
import { getShop } from "../content/shops";
import RecipeList from "./RecipeList";
import AmenityEntry from "./AmenityEntry";
import ActivityCard from "./ActivityCard";
import TownScene from "./scene/TownScene";
import { CardPanelContext } from "./ui/cardPanel";
import { Modal } from "./ui/Modal";
import { EmptyState, Page, Section } from "./ui/Page";
import { getActiveTravel } from "../engine/activeAction";
import { subscribeBackToTown, subscribeOpenHouse, subscribeOpenVisit, type HouseVisit } from "../lib/dialog";
import HouseView from "./house/HouseView";
import { VisitLikeButton } from "./house/SharePanel";

/** Whether the house was open when Home was last shown, so visiting
 *  another tab and coming back returns to the house. */
let houseWasOpen = false;

/** A building or spot opened from the town scene, in a modal. */
function AmenityModal({ amenity, locationId, onClose }: { amenity: Amenity; locationId: string; onClose: () => void }) {
  const shop = amenity.kind === "shop" ? getShop(amenity.shopId) : undefined;
  const title = getTownScene(locationId).spots[amenity.id]?.label ?? shop?.title ?? amenity.name;
  // Shops and job boards are grids and lists: give them the wide panel.
  const wide = amenity.kind === "shop" || amenity.kind === "jobBoard" || amenity.kind === "craftingStation";
  return (
    <Modal title={title} onClose={onClose} wide={wide} className="amenity-modal">
      <CardPanelContext.Provider value={true}>
        <AmenityEntry amenity={amenity} onStarted={onClose} />
      </CardPanelContext.Provider>
    </Modal>
  );
}

/**
 * The main/home tab, where players spend most of their time: what you're
 * doing, a picture of where you are (click a building to use it), and
 * crafting. New amenities show up in the picture on their own; their
 * placement lives in content/townScenes.ts.
 */
export default function HomeView() {
  const { engine, state } = useGame();
  const currentLocation = getLocation(state.currentLocationId);
  const amenities = getAmenitiesAtLocation(state.currentLocationId);
  const travel = getActiveTravel(state);
  const [openId, setOpenId] = useState<string | null>(null);
  const [inHouse, setInHouseState] = useState(houseWasOpen);
  const setInHouse = useCallback((open: boolean) => {
    houseWasOpen = open;
    setInHouseState(open);
  }, []);
  const close = useCallback(() => setOpenId(null), []);
  // Someone else's house, read-only, while visiting.
  const [visiting, setVisiting] = useState<HouseVisit | null>(null);
  useEffect(
    () =>
      subscribeOpenVisit((visit) => {
        setOpenId(null);
        setVisiting(visit);
      }),
    []
  );
  // Saying goodbye to an NPC, or finishing a quest, closes the building.
  useEffect(() => subscribeBackToTown(close), [close]);
  useEffect(
    () =>
      subscribeOpenHouse(() => {
        setOpenId(null);
        setInHouse(true);
      }),
    [setInHouse]
  );
  // Away from the house portal (another town, or on the road), Home shows
  // where you are, not the house (decided Oct 26). Checked on every
  // render, so it also holds after visiting other tabs or a teleport.
  const atHouse = engine.isAtHouse();
  if (!atHouse && (inHouse || visiting)) {
    setInHouse(false);
    setVisiting(null);
  }
  const open = openId ? amenities.find((a) => a.id === openId) : undefined;

  // On the road there's nowhere to be "here": just the trip.
  if (travel) {
    return (
      <Page title={`On the road to ${travel.destinationName}`}>
        <ActivityCard />
        <EmptyState>
          You left {currentLocation?.name ?? "town"}. You can't do anything until you arrive, or you can cancel the trip.
        </EmptyState>
      </Page>
    );
  }

  if (visiting) {
    return (
      <>
        <ActivityCard />
        <HouseView
          key={`${visiting.houseId ?? "code"}:${visiting.name}`}
          visit={visiting}
          visitExtra={visiting.houseId ? <VisitLikeButton houseId={visiting.houseId} /> : <span className="text-muted">Visiting from a share code</span>}
          onLeave={() => setVisiting(null)}
        />
      </>
    );
  }

  if (inHouse) {
    return (
      <>
        <ActivityCard />
        <HouseView onLeave={() => setInHouse(false)} />
      </>
    );
  }

  // No page title: the place's name is on a sign in the picture.
  return (
    <section className="page">
      <ActivityCard />

      {amenities.length === 0 ? (
        <>
          <h2 className="page-title">{currentLocation?.name ?? "Unknown location"}</h2>
          <EmptyState>There's nothing to do here yet.</EmptyState>
        </>
      ) : (
        <TownScene
          locationId={state.currentLocationId}
          locationName={currentLocation?.name ?? "Unknown location"}
          amenities={amenities}
          onOpen={(a) => (a.kind === "housePortal" ? setInHouse(true) : setOpenId(a.id))}
        />
      )}

      <Section title="Crafting">
        <RecipeList />
      </Section>

      {open && <AmenityModal key={open.id} amenity={open} locationId={state.currentLocationId} onClose={close} />}
    </section>
  );
}
