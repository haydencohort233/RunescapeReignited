import { getDailyPeriodNumber } from "../engine/time";
import { hashStringToSeed, seededPick } from "../engine/rng";
import { getJob } from "./jobs";

export interface JobBoardDefinition {
  id: string;
  title: string;
  locationId: string;
  /** The full pool of jobs this board can ever offer. */
  jobIds: string[];
  /** How many of the pool are actively offered per UTC day. Omit for a
   *  fixed board (the whole pool shows every day, unchanged — same
   *  behavior as before rotation existed). Set it to enable rotation. */
  slotsPerDay?: number;
}

export const JOB_BOARD_CATALOG: JobBoardDefinition[] = [
  {
    id: "town-board",
    title: "Town Notice Board",
    locationId: "town",
    jobIds: [
      "deliver-wood",
      "reach-woodcutting-15",
      "flax-for-the-fletcher",
      "clear-the-den",
      "goblin-trouble",
      "rest-in-peace",
      "supper-for-the-inn",
      "bronze-for-the-guard",
    ],
    slotsPerDay: 3, // 3 of the daily jobs show each day — which ones rotates
  },
  {
    id: "lumber-camp-board",
    title: "Camp Job Board",
    locationId: "lumber-camp",
    jobIds: ["logs-for-the-camp", "oak-order", "willow-order", "bandit-bounty", "head-lumberjack"],
    slotsPerDay: 3,
  },
  {
    id: "lake-shore-board",
    title: "Fishmonger's Board",
    locationId: "lake-shore",
    jobIds: ["shrimp-supply", "trout-run", "tuna-haul", "shark-week"],
    slotsPerDay: 2,
  },
  {
    id: "quarry-board",
    title: "Quarry Job Board",
    locationId: "quarry",
    jobIds: ["ore-for-the-furnace", "rock-breaker", "quarry-regular"],
    slotsPerDay: 2,
  },
];

export function getJobBoard(id: string): JobBoardDefinition | undefined {
  return JOB_BOARD_CATALOG.find((b) => b.id === id);
}

/** Which job ids are actively offered TODAY. Only daily jobs rotate:
 *  one-time and repeatable jobs are always on the board. The daily picks
 *  are deterministic from the board id + the current UTC day, so nothing
 *  needs to be stored: the same (board, day) pair always derives the same
 *  picks, on any device. All of them if slotsPerDay is unset or covers it. */
export function getActiveJobIds(board: JobBoardDefinition, now: number): string[] {
  const isDaily = (id: string) => (getJob(id)?.frequency ?? "daily") === "daily";
  const daily = board.jobIds.filter(isDaily);
  const always = board.jobIds.filter((id) => !isDaily(id));
  if (board.slotsPerDay === undefined) return board.jobIds;
  const seed = hashStringToSeed(board.id) + getDailyPeriodNumber(now);
  const picked = new Set(seededPick(daily, board.slotsPerDay, seed));
  return board.jobIds.filter((id) => picked.has(id) || always.includes(id));
}