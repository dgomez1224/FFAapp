/**
 * Canonical Managers List
 *
 * Fixed list of all 20 managers across Division One and Division Two.
 * Used for CSV imports, database rows, UI routing, and application logic.
 */

import {
  DIVISION_ONE_MANAGERS,
  DIVISION_TWO_MANAGERS,
  type Division,
  getManagerDivision,
} from "./divisions";

export const CANONICAL_MANAGERS = [
  ...DIVISION_ONE_MANAGERS,
  ...DIVISION_TWO_MANAGERS,
] as const;

export type CanonicalManager = (typeof CANONICAL_MANAGERS)[number];

export { DIVISION_ONE_MANAGERS, DIVISION_TWO_MANAGERS, getManagerDivision };
export type { Division };

/**
 * Validates that a manager name is in the canonical list
 */
export function isValidManager(managerName: string): managerName is CanonicalManager {
  return CANONICAL_MANAGERS.includes(managerName.toUpperCase() as CanonicalManager);
}

/**
 * Normalizes a manager name to the canonical format
 * Returns null if the name is not in the canonical list
 */
export function normalizeManagerName(name: string | null | undefined): CanonicalManager | null {
  if (!name) return null;
  const upper = name.toUpperCase().trim();
  if (upper === "MATTHEW") return "MATT";
  if (upper === "SEB") return "SEBASTIAN";
  return isValidManager(upper) ? upper : null;
}

/**
 * Gets manager name by index (0-19)
 * Used for index-based CSV mapping
 */
export function getManagerByIndex(index: number): CanonicalManager | null {
  if (index < 0 || index >= CANONICAL_MANAGERS.length) return null;
  return CANONICAL_MANAGERS[index];
}
