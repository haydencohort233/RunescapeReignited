/** What falls or drifts in the yard, by the ground look (decided Oct 25:
 *  weather follows the ground). */
export type WeatherKind = "rain" | "snow" | "leaves" | "petals" | "heat";

const BY_GROUND: Record<string, WeatherKind> = {
  "grass-ground": "rain",
  "meadow-ground": "petals",
  "dirt-ground": "leaves",
  "snow-ground": "snow",
  "sand-ground": "heat",
};

export function weatherFor(groundId: string | undefined): WeatherKind | null {
  return (groundId && BY_GROUND[groundId]) || null;
}
