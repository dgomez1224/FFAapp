/**
 * Division configuration for the two-division FPL league structure.
 */

export type Division = "division_one" | "division_two";

export type DivisionLabel = "Division One" | "Division Two";

export const DIVISION_LABELS: Record<Division, DivisionLabel> = {
  division_one: "Division One",
  division_two: "Division Two",
};

export const DIVISION_ONE_LEAGUE_ID = "23236";
export const DIVISION_TWO_LEAGUE_ID = "31913";

export const DIVISION_ONE_MANAGERS = [
  "PATRICK",
  "MATT",
  "MARCO",
  "LENNART",
  "CHRIS",
  "IAN",
  "HENRI",
  "DAVID",
  "MAX",
  "BENJI",
] as const;

export const DIVISION_TWO_MANAGERS = [
  "ANDREW",
  "BRENDAN",
  "CONNOR",
  "LUKE",
  "KARIM",
  "JORDAN",
  "ROHUN",
  "ZACH",
  "SEBASTIAN",
  "GRANT",
] as const;

export type DivisionOneManager = (typeof DIVISION_ONE_MANAGERS)[number];
export type DivisionTwoManager = (typeof DIVISION_TWO_MANAGERS)[number];

/** Current-season Draft entry IDs keyed by canonical manager name. */
export const MANAGER_ENTRY_IDS: Record<string, string> = {
  BENJI: "258967",
  CHRIS: "247337",
  DAVID: "132262",
  HENRI: "135018",
  IAN: "268695",
  LENNART: "238334",
  MARCO: "122327",
  MATT: "118187",
  MAX: "126340",
  PATRICK: "261017",
  ANDREW: "183764",
  BRENDAN: "195884",
  CONNOR: "178589",
  GRANT: "165408",
  JORDAN: "231538",
  KARIM: "231380",
  LUKE: "216175",
  ROHUN: "221585",
  SEBASTIAN: "183859",
  ZACH: "215391",
};

export const MANAGER_NAME_ALIASES: Record<string, string> = {
  MATTHEW: "MATT",
  SEB: "SEBASTIAN",
};

export const MANAGER_DIVISION: Record<string, Division> = Object.fromEntries([
  ...DIVISION_ONE_MANAGERS.map((m) => [m, "division_one" as Division]),
  ...DIVISION_TWO_MANAGERS.map((m) => [m, "division_two" as Division]),
]);

export function getManagerDivision(managerName: string): Division | null {
  const upper = managerName.trim().toUpperCase();
  const canonical = MANAGER_NAME_ALIASES[upper] ?? upper;
  return MANAGER_DIVISION[canonical] ?? null;
}

export function getManagerEntryId(managerName: string): string | null {
  const upper = managerName.trim().toUpperCase();
  const canonical = MANAGER_NAME_ALIASES[upper] ?? upper;
  return MANAGER_ENTRY_IDS[canonical] ?? null;
}

export function getDivisionLabel(division: Division): DivisionLabel {
  return DIVISION_LABELS[division];
}

export const DIVISION_SHORT_LABELS: Record<Division, "D1" | "D2"> = {
  division_one: "D1",
  division_two: "D2",
};

export function getDivisionShortLabel(division: Division): "D1" | "D2" {
  return DIVISION_SHORT_LABELS[division];
}

export function isDivision(value: string): value is Division {
  return value === "division_one" || value === "division_two";
}

export interface ManagerDivisionStatBlock {
  wins: number;
  draws: number;
  losses: number;
  total_points: number;
  points_plus: number;
  points_per_game: number | null;
  league_titles: number;
}

export interface ManagerStatsBreakdown {
  currentDivision: Division | null;
  divisionOne: ManagerDivisionStatBlock;
  divisionTwo: ManagerDivisionStatBlock;
  allTime: ManagerDivisionStatBlock;
}
