import { getDailyPeriodNumber } from "../engine/time";
import { hashStringToSeed, seededPick } from "../engine/rng";

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
    jobIds: ["deliver-wood", "reach-woodcutting-15", "flax-for-the-fletcher", "clear-the-den"],
    slotsPerDay: 3, // 3 of 4 jobs show each day — which one is left out rotates
  },
];

export function getJobBoardAtLocation(locationId: string): JobBoardDefinition | undefined {
  return JOB_BOARD_CATALOG.find((b) => b.locationId === locationId);
}

/** Which job ids are actively offered TODAY — deterministic from the board
 *  id + the current UTC day, so nothing needs to be stored: the same
 *  (board, day) pair always derives the same picks, on any device, without
 *  syncing anything. Returns the whole pool if slotsPerDay is unset or
 *  covers it (the fixed-board case). */
export function getActiveJobIds(board: JobBoardDefinition, now: number): string[] {
  if (board.slotsPerDay === undefined) return board.jobIds;
  const seed = hashStringToSeed(board.id) + getDailyPeriodNumber(now);
  return seededPick(board.jobIds, board.slotsPerDay, seed);
}