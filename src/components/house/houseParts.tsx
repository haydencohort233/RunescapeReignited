import { useGame } from "../../engine/GameEngineContext";
import type { Facing, FurnitureDefinition } from "../../engine/types";
import { formatDuration, formatXp } from "../../engine/format";
import { FURNITURE_CATALOG } from "../../content/house";
import { furnitureImagePath } from "../../content/assetPaths";
import GameImage from "../GameImage";
import { ItemChip } from "../ui/GameIcons";
import { Modal } from "../ui/Modal";
import { furnitureDrawing } from "./furnitureSprites";
import { ROOM_W, type SpriteBox } from "./roomGeometry";
import type { PieceArt } from "./artCache";

// The house screen's smaller pieces: furniture pictures, the build menu,
// storage and the skin picker (HouseView.tsx is the room itself).

/** One piece's picture: its art at its pixel size, or a drawn stand-in
 *  until art exists (the emoji if there's no drawing either). */
export function FurnitureSprite({ def, facing, art, skinned, box }: { def: FurnitureDefinition; facing: Facing; art: PieceArt | null | undefined; skinned: boolean; box: SpriteBox }) {
  if (art) {
    return (
      <img
        className="house-art"
        src={art.src}
        alt=""
        draggable={false}
        style={art.flip ? { transform: "scaleX(-1)" } : undefined}
      />
    );
  }
  const drawing = furnitureDrawing(def, facing);
  const emojiSize = (Math.min(box.width, box.height * 1.1) / ROOM_W) * 100 * 0.78;
  return drawing.svg ? (
    <svg
      className={`house-drawing${skinned ? " is-skinned" : ""}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={facing === "right" ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: drawing.svg }}
    />
  ) : (
    <span className="house-emoji" style={{ fontSize: `${emojiSize}cqw` }} aria-hidden="true">
      {def.emoji}
    </span>
  );
}

/** A small square picture of a piece for lists (build menu, storage). */
export function FurnitureIcon({ def, size = 28 }: { def: FurnitureDefinition; size?: number }) {
  const drawing = furnitureDrawing(def);
  const fallback = drawing.svg ? (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" dangerouslySetInnerHTML={{ __html: drawing.svg }} />
  ) : (
    <span style={{ fontSize: size * 0.85 }} aria-hidden="true">
      {def.emoji}
    </span>
  );
  return def.art ? <GameImage src={furnitureImagePath(def.art, "front")} alt="" style={{ width: size, height: size }} fallback={fallback} /> : fallback;
}

/** Everything that can be built, grouped, with what it costs and does. */
export function BuildMenu({ onClose }: { onClose: () => void }) {
  const { engine, actions } = useGame();
  const groups: { title: string; filter: (f: FurnitureDefinition) => boolean }[] = [
    { title: "Facilities", filter: (f) => f.kind === "facility" },
    { title: "Beds", filter: (f) => f.kind === "furniture" && !!f.offlineCapBonusMs },
    { title: "Furniture", filter: (f) => f.kind === "furniture" && f.slot === "floor" && !f.offlineCapBonusMs },
    { title: "Rugs", filter: (f) => f.slot === "rug" },
    { title: "On the wall", filter: (f) => f.kind === "furniture" && f.slot === "wall" },
    { title: "On tables and shelves", filter: (f) => f.kind === "furniture" && f.slot === "surface" },
  ];
  return (
    <Modal title="Build furniture" onClose={onClose} wide>
      <div className="stack-sm">
        {groups.map((g) => (
          <div key={g.title} className="stack-sm">
            <h4 className="section-title">{g.title}</h4>
            <ul className="house-build-list">
              {FURNITURE_CATALOG.filter(g.filter)
                .sort((a, b) => a.levelRequired - b.levelRequired)
                .map((def) => {
                  const blocker = engine.getFurnitureBuildBlocker(def.id);
                  const locked = engine.getSkillLevel("construction") < def.levelRequired;
                  return (
                    <li key={def.id} className={`house-build-row${locked ? " is-locked" : ""}`}>
                      <span className="house-build-emoji">
                        <FurnitureIcon def={def} size={32} />
                      </span>
                      <div className="house-build-info">
                        <div className="house-build-name">
                          <strong>{def.name}</strong>
                          <span className={`tag${locked ? "" : " tag-success"}`}>Level {def.levelRequired}</span>
                        </div>
                        <div className="text-small text-muted">
                          {formatDuration(def.buildTimeMs).replace(/ 0s$/, "")} · {formatXp(def.xp)} XP
                          {def.slot !== "surface" && ` · ${def.width}x${def.depth}`}
                          {def.surfaceSlots ? ` · holds ${def.surfaceSlots}` : ""}
                        </div>
                        <div className="text-small">{def.description}</div>
                        <div className="house-build-cost">
                          {def.cost.map((c) => (
                            <ItemChip key={c.resource} id={c.resource} amount={c.amount} size={16} />
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn"
                        disabled={!!blocker}
                        title={blocker ?? undefined}
                        onClick={() => {
                          if (engine.startFurnitureBuild(def.id)) onClose();
                          actions.refresh();
                        }}
                      >
                        Build
                      </button>
                      {blocker && !locked && <span className="house-build-why text-small text-warning">{blocker}</span>}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Pick a look for a placed piece from the skins you've unlocked. */
export function SkinPicker({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { engine, state, actions } = useGame();
  const piece = state.house.layout.inside.find((p) => p.uid === uid);
  const def = piece ? engine.getFurnitureDef(piece.furnitureId) : undefined;
  if (!piece || !def) return null;
  const options = [{ id: null as string | null, name: `Plain ${def.name}` }, ...engine.getAvailableFurnitureSkins(def.id).map((s) => ({ id: s.id as string | null, name: s.name }))];
  return (
    <Modal title={`${def.name} cosmetics`} onClose={onClose}>
      <div className="stack-sm">
        {options.map((o) => {
          const current = (piece.skinId ?? null) === o.id;
          return (
            <button
              key={o.id ?? "plain"}
              type="button"
              className={`btn${current ? " btn-primary" : ""}`}
              onClick={() => {
                engine.setFurnitureSkin(uid, o.id);
                actions.refresh();
              }}
            >
              {current ? "✓ " : ""}
              {o.name}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

/** Built pieces waiting to be placed. Tap one to put it in the room. */
export function StoragePanel({ onPick, onClose }: { onPick: (uid: string, def: FurnitureDefinition) => void; onClose: () => void }) {
  const { engine, state } = useGame();
  const storage = state.house.storage;
  const atHouse = engine.isAtHouse();
  return (
    <Modal title={`Storage (${engine.getHouseStorageUsed()}/${engine.getHouseStorageCapacity()})`} onClose={onClose}>
      {storage.length === 0 ? (
        <p className="empty-state">Nothing in storage. Build something, or store a piece to make room.</p>
      ) : (
        <ul className="house-storage">
          {storage.map((s) => {
            const def = engine.getFurnitureDef(s.furnitureId);
            if (!def) return null;
            return (
              <li key={s.uid}>
                <button type="button" className="house-stored" disabled={!atHouse} title={`Place ${def.name}`} onClick={() => onPick(s.uid, def)}>
                  <FurnitureIcon def={def} size={34} />
                  <span className="house-stored-name">{def.name}</span>
                  <span className="text-faint text-small">Place</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
