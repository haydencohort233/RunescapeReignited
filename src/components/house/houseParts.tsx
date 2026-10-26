import { useGame } from "../../engine/GameEngineContext";
import type { Facing, FurnitureDefinition } from "../../engine/types";
import { furnitureImagePath } from "../../content/assetPaths";
import GameImage from "../GameImage";
import { Modal } from "../ui/Modal";
import { furnitureDrawing } from "./furnitureSprites";
import { ROOM_W, type SpriteBox } from "./roomGeometry";
import type { PieceArt } from "./artCache";

// The house screen's smaller pieces: furniture pictures and the skin
// picker (HouseView.tsx is the scene, BuildDock.tsx the build catalog).

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

/** Pick a look for a placed piece from the skins you've unlocked. */
export function SkinPicker({ uid, onClose }: { uid: string; onClose: () => void }) {
  const { engine, state, actions } = useGame();
  const piece = [...state.house.layout.inside, ...state.house.layout.yard].find((p) => p.uid === uid);
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
