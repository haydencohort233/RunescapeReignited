import { useEffect, useState } from "react";
import { useGame } from "../../engine/GameEngineContext";
import type { GameEngine } from "../../engine/gameEngine";
import { fromShareCode, toShareCode } from "../../lib/shareCode";
import { getListedHouse, houseServerAvailable, houseTitle, likeHouse, listMyHouse, playerName, topHouses, unlistMyHouse, type ListedHouse } from "../../lib/houseDirectory";
import { openVisit } from "../../lib/dialog";

// The Houses panel's parts: your share code and listing, the most-liked
// lists, and visiting by code. HousePanels.tsx puts them in tabs; the
// House Portal card shows VisitHousesPanel.

/** Whether the house server answers here (null while asking). */
function useServer(): boolean | null {
  const [up, setUp] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    houseServerAvailable().then((ok) => live && setUp(ok));
    return () => {
      live = false;
    };
  }, []);
  return up;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Your house's share code (inside and yard in one), with Copy, and, when
 * the house server is reachable, listing it for others to find and like.
 */
export function MyHouseShare() {
  const { engine, state, actions } = useGame();
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState<boolean | null>(null);
  const server = useServer();
  const [listed, setListed] = useState<ListedHouse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = playerName(engine);
  const houseId = state.online?.houseId ?? null;
  const layout = state.house.layout;

  // The code for the house as it stands now.
  useEffect(() => {
    let live = true;
    toShareCode({ name, layout }).then((c) => live && setCode(c));
    return () => {
      live = false;
    };
  }, [name, layout, state]);

  // How the listed copy is doing (likes), if there is one.
  useEffect(() => {
    if (!server || !houseId) return;
    let live = true;
    getListedHouse(engine, houseId)
      .then((h) => live && setListed(h))
      .catch(() => live && setListed(null));
    return () => {
      live = false;
    };
  }, [engine, server, houseId]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      actions.refresh();
    }
  };

  return (
    <div className="stack-sm">
      {server && (
        <div className="houses-card">
          <div className="row row-between">
            <strong>{houseTitle(name)}</strong>
            {houseId && listed && (
              <span className="houses-likes" title={`${listed.likesWeek} this week`}>
                ♥ {listed.likes}
              </span>
            )}
          </div>
          <span className="text-small text-muted">{houseId ? "Listed. Update it after changing things." : "Not listed yet. List it so others can find and like it."}</span>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary btn-small"
              disabled={busy || !code}
              onClick={() =>
                act(async () => {
                  setListed(await listMyHouse(engine, name, code));
                })
              }
            >
              {houseId ? "Update listing" : "List my house"}
            </button>
            {houseId && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                disabled={busy}
                onClick={() =>
                  act(async () => {
                    await unlistMyHouse(engine);
                    setListed(null);
                  })
                }
              >
                Remove
              </button>
            )}
          </div>
          {error && <p className="text-small text-danger">{error}</p>}
        </div>
      )}
      {server === false && <p className="text-small text-muted">The house server isn't reachable here, so listing and likes are off. Share codes still work.</p>}
      <div className="houses-card">
        <strong>Share code</strong>
        <span className="text-small text-muted">Your whole house, yard and room. Anyone can paste it to visit.</span>
        <textarea className="share-code" readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} aria-label="Your share code" />
        <div className="btn-row">
          <button type="button" className="btn btn-small" disabled={!code} onClick={async () => setCopied(await copyText(code))}>
            {copied ? "Copied" : "Copy code"}
          </button>
          {copied === false && <span className="text-small text-warning">Couldn't copy. Select the code and copy it yourself.</span>}
        </div>
      </div>
    </div>
  );
}

/** Opens a listed house: fetches its code and visits it. */
async function visitListed(engine: GameEngine, id: string): Promise<void> {
  const house = await getListedHouse(engine, id);
  const content = engine.content.house;
  const shared = content && house.code ? await fromShareCode(house.code, content) : null;
  if (!shared) throw new Error("That house couldn't be opened.");
  openVisit({ name: houseTitle(house.name), layout: shared.layout, houseId: house.id });
}

/** The most-liked houses, all time or this week. */
export function HouseRanking({ period }: { period: "all" | "week" }) {
  const { engine } = useGame();
  const server = useServer();
  const [houses, setHouses] = useState<ListedHouse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!server) return;
    let live = true;
    setHouses(null);
    topHouses(engine, period)
      .then((h) => live && setHouses(h))
      .catch((e) => live && (setHouses([]), setError(e instanceof Error ? e.message : "Couldn't load the list.")));
    return () => {
      live = false;
    };
  }, [engine, server, period]);

  if (server === null) return <p className="text-small text-muted">Looking for the house server...</p>;
  if (!server) return <p className="text-small text-muted">The house server isn't reachable here. Visit by code instead.</p>;
  return (
    <div className="stack-sm">
      {houses === null ? (
        <p className="text-small text-muted">Loading...</p>
      ) : houses.length === 0 ? (
        <p className="text-small text-muted">{period === "week" ? "No likes this week yet." : "No houses listed yet. Be the first."}</p>
      ) : (
        <ol className="house-list">
          {houses.map((h, i) => (
            <li key={h.id} className={`house-list-row${i < 3 ? " is-top" : ""}`}>
              <span className="house-list-rank">{i + 1}</span>
              <span className="house-list-name">
                {houseTitle(h.name)}
                {h.mine && <span className="tag">Yours</span>}
              </span>
              <span className="houses-likes">♥ {period === "week" ? h.likesWeek : h.likes}</span>
              <button type="button" className="btn btn-small" onClick={() => visitListed(engine, h.id).catch((e) => setError(e instanceof Error ? e.message : "Couldn't open it."))}>
                Visit
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="text-small text-danger">{error}</p>}
    </div>
  );
}

/** Paste a share code to visit that house. */
export function VisitByCode() {
  const { engine } = useGame();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const visitCode = async () => {
    setError(null);
    const content = engine.content.house;
    const shared = content ? await fromShareCode(code, content) : null;
    if (!shared) {
      setError("That doesn't look like a house code.");
      return;
    }
    openVisit({ name: houseTitle(shared.name), layout: shared.layout });
  };
  return (
    <div className="stack-sm">
      <form
        className="row servant-custom"
        onSubmit={(e) => {
          e.preventDefault();
          void visitCode();
        }}
      >
        <input type="text" placeholder="Paste a house code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="House code" autoComplete="off" spellCheck={false} />
        <button type="submit" className="btn btn-small" disabled={!code.trim()}>
          Visit
        </button>
      </form>
      {error && <p className="text-small text-danger">{error}</p>}
    </div>
  );
}

/**
 * At the House Portal: visit a house by its share code, or (with the house
 * server) pick one from the most-liked lists, all time or this week.
 */
export function VisitHousesPanel() {
  const [period, setPeriod] = useState<"all" | "week">("all");
  const server = useServer();
  return (
    <div className="stack-sm">
      <h4 className="section-title">Visit a house</h4>
      <VisitByCode />
      {server && (
        <>
          <div className="build-tabs" role="tablist" aria-label="Most liked">
            <button type="button" role="tab" aria-selected={period === "all"} className={`build-tab${period === "all" ? " is-active" : ""}`} onClick={() => setPeriod("all")}>
              Most liked
            </button>
            <button type="button" role="tab" aria-selected={period === "week"} className={`build-tab${period === "week" ? " is-active" : ""}`} onClick={() => setPeriod("week")}>
              This week
            </button>
          </div>
          <HouseRanking period={period} />
        </>
      )}
    </div>
  );
}

/** The Like button on a visited house from the list. */
export function VisitLikeButton({ houseId }: { houseId: string }) {
  const { engine } = useGame();
  const [house, setHouse] = useState<ListedHouse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getListedHouse(engine, houseId)
      .then((h) => live && setHouse(h))
      .catch(() => live && setError("Offline"));
    return () => {
      live = false;
    };
  }, [engine, houseId]);
  if (error) return <span className="text-muted">{error}</span>;
  if (!house) return null;
  return (
    <span className="row" style={{ gap: 8 }}>
      <button
        type="button"
        className={`btn btn-small${house.likedByMe ? " btn-primary" : ""}`}
        disabled={house.mine}
        title={house.mine ? "That's your house" : house.likedByMe ? "Take your like back" : "Like this house"}
        onClick={() =>
          likeHouse(engine, houseId, !house.likedByMe)
            .then(setHouse)
            .catch((e) => setError(e instanceof Error ? e.message : "Couldn't like it."))
        }
      >
        {house.likedByMe ? "♥ Liked" : "♡ Like"}
      </button>
      <span>
        {house.likes} {house.likes === 1 ? "like" : "likes"}
      </span>
    </span>
  );
}
