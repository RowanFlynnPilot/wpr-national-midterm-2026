import type { Party } from "./types";

// Validated with the dataviz palette checker against the WPR cream surface (#F6F2E9):
// D/R/I pass all-pairs CVD separation; ochre sits below 3:1 so it always ships beside a label.
export const PARTY: Record<Party, string> = { D: "#2D63A6", R: "#C23A30", I: "#B88A1E", O: "#8A857A" };

/** Leading but not yet called. */
export const PALE: Record<Party, string> = { D: "#93B4DD", R: "#E59C90", I: "#E2C67E", O: "#CFC9BC" };

export const NO_RACE = "#E6E0D3";

// "Still counting" county mode: share of the vote still to report, light -> deep teal.
export const REMAINING_BINS = [5, 25, 50]; // four classes: 0 (done), <5, 5-25, 25-50, 50+
export const REMAINING_RAMP = ["#EFE9DC", "#CFE3DF", "#9CC7C0", "#5FA59B", "#2B6B62"];

export function remainingColor(pctReporting: number): string {
  const left = 100 - pctReporting;
  if (left <= 0) return REMAINING_RAMP[0] as string;
  const idx = REMAINING_BINS.findIndex((b) => left < b);
  return REMAINING_RAMP[idx === -1 ? REMAINING_RAMP.length - 1 : idx + 1] as string;
}
export const NO_RESULTS = "#D8D2C4";

export const PARTY_LABEL: Record<Party, string> = { D: "Democrat", R: "Republican", I: "Independent", O: "Other" };
export const PARTY_PLURAL: Record<Party, string> = { D: "Democrats", R: "Republicans", I: "Independents", O: "Others" };

// County margin of victory: one hue per party, light -> dark.
export const MARGIN_BINS = [5, 10, 20, 40]; // points; five classes: <5, 5-10, 10-20, 20-40, 40+
export const MARGIN_RAMP: Record<Party, string[]> = {
  D: ["#C9D9EE", "#93B4DD", "#5D8DC9", "#2D63A6", "#1D467A"],
  R: ["#F2CEC7", "#E59C90", "#D46A5B", "#C23A30", "#8E2620"],
  I: ["#F0E2BD", "#E2C67E", "#CDA748", "#B88A1E", "#7E5E12"],
  O: ["#E4E1DA", "#CFC9BC", "#B2AC9F", "#8A857A", "#5F5B53"],
};

export function marginColor(party: Party, margin: number): string {
  const idx = MARGIN_BINS.findIndex((b) => margin < b);
  const ramp = MARGIN_RAMP[party];
  return ramp[idx === -1 ? ramp.length - 1 : idx] as string;
}

/** Ink that stays legible on top of a fill: white on the darker steps, near-black on the light ones. */
export function inkOn(fill: string): string {
  const n = parseInt(fill.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.3 ? "#1D1B17" : "#FFFFFF";
}
