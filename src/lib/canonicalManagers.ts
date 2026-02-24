/**
 * Canonical Managers List
 * 
 * This is the fixed, permanent list of exactly 10 managers.
 * These names are used across:
 * - CSV imports (index-based mapping)
 * - Database rows
 * - UI routing
 * - Application logic
 * 
 * IMPORTANT: These names will never change.
 * Every historical stat must be associated with one of these names.
 */

export const CANONICAL_MANAGERS = [
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

export type CanonicalManager = typeof CANONICAL_MANAGERS[number];

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
  return isValidManager(upper) ? upper : null;
}

/**
 * Gets manager name by index (0-9)
 * Used for index-based CSV mapping
 */
export function getManagerByIndex(index: number): CanonicalManager | null {
  if (index < 0 || index >= CANONICAL_MANAGERS.length) return null;
  return CANONICAL_MANAGERS[index];
}
