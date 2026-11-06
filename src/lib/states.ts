// FIPS code -> postal code and name, for the 50 states and D.C. (us-atlas keys shapes by FIPS).
export const STATES: Record<string, { code: string; name: string }> = {
  "01": { code: "AL", name: "Alabama" }, "02": { code: "AK", name: "Alaska" },
  "04": { code: "AZ", name: "Arizona" }, "05": { code: "AR", name: "Arkansas" },
  "06": { code: "CA", name: "California" }, "08": { code: "CO", name: "Colorado" },
  "09": { code: "CT", name: "Connecticut" }, "10": { code: "DE", name: "Delaware" },
  "11": { code: "DC", name: "District of Columbia" }, "12": { code: "FL", name: "Florida" },
  "13": { code: "GA", name: "Georgia" }, "15": { code: "HI", name: "Hawaii" },
  "16": { code: "ID", name: "Idaho" }, "17": { code: "IL", name: "Illinois" },
  "18": { code: "IN", name: "Indiana" }, "19": { code: "IA", name: "Iowa" },
  "20": { code: "KS", name: "Kansas" }, "21": { code: "KY", name: "Kentucky" },
  "22": { code: "LA", name: "Louisiana" }, "23": { code: "ME", name: "Maine" },
  "24": { code: "MD", name: "Maryland" }, "25": { code: "MA", name: "Massachusetts" },
  "26": { code: "MI", name: "Michigan" }, "27": { code: "MN", name: "Minnesota" },
  "28": { code: "MS", name: "Mississippi" }, "29": { code: "MO", name: "Missouri" },
  "30": { code: "MT", name: "Montana" }, "31": { code: "NE", name: "Nebraska" },
  "32": { code: "NV", name: "Nevada" }, "33": { code: "NH", name: "New Hampshire" },
  "34": { code: "NJ", name: "New Jersey" }, "35": { code: "NM", name: "New Mexico" },
  "36": { code: "NY", name: "New York" }, "37": { code: "NC", name: "North Carolina" },
  "38": { code: "ND", name: "North Dakota" }, "39": { code: "OH", name: "Ohio" },
  "40": { code: "OK", name: "Oklahoma" }, "41": { code: "OR", name: "Oregon" },
  "42": { code: "PA", name: "Pennsylvania" }, "44": { code: "RI", name: "Rhode Island" },
  "45": { code: "SC", name: "South Carolina" }, "46": { code: "SD", name: "South Dakota" },
  "47": { code: "TN", name: "Tennessee" }, "48": { code: "TX", name: "Texas" },
  "49": { code: "UT", name: "Utah" }, "50": { code: "VT", name: "Vermont" },
  "51": { code: "VA", name: "Virginia" }, "53": { code: "WA", name: "Washington" },
  "54": { code: "WV", name: "West Virginia" }, "55": { code: "WI", name: "Wisconsin" },
  "56": { code: "WY", name: "Wyoming" },
};

export const STATE_NAME: Record<string, string> = Object.fromEntries(
  Object.values(STATES).map((s) => [s.code, s.name]),
);

export const FIPS_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATES).map(([fips, s]) => [s.code, fips]),
);

/** Wausau Pilot & Review's readers: a toolbar shortcut, a resting outline on the maps, and a block on the overview panel. */
export const HOME_STATE = "WI";

/** States too small to label or click comfortably on the national map; they get callout chips. */
export const SMALL_STATES = ["MA", "RI", "CT", "NJ", "DE", "MD"];

export function stateName(code: string): string {
  const name = STATE_NAME[code];
  if (!name) throw new Error(`unknown state code ${code}`);
  return name;
}
