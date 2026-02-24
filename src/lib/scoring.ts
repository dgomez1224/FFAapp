/**
 * Scoring Logic - Client-Side FPL Point Calculations
 * 
 * Pure functions for computing player points, applying autosubs,
 * bonus points, and captaincy multipliers.
 * 
 * These functions are deterministic and can be used both client-side
 * and server-side for consistency.
 */

export interface LivePlayerStats {
  element: number;
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    influence: number;
    creativity: number;
    threat: number;
    ict_index: number;
    starts: number;
    expected_goals: number;
    expected_assists: number;
    expected_goal_involvements: number;
    expected_goals_conceded: number;
    total_points: number;
  };
  explain: Array<{
    name: string;
    points: number;
    value: number;
  }>;
}

export interface Pick {
  element: number;
  position: number; // 1-11 = starting XI, 12-15 = bench
  is_captain: boolean;
  is_vice_captain: boolean;
  multiplier: number;
}

export interface ElementType {
  id: number;
  singular_name: string;
  singular_name_short: string;
  squad_select: number;
  squad_min_play: number;
  squad_max_play: number;
}

export interface ScoringRules {
  applyAutosubs: boolean;
  applyBonus: boolean;
  bonusReliableAt60: boolean; // Bonus becomes reliable at 60 minutes
  captainMultiplier: number; // Usually 2 for classic, may differ for draft
}

const DEFAULT_RULES: ScoringRules = {
  applyAutosubs: true,
  applyBonus: true,
  bonusReliableAt60: true,
  captainMultiplier: 2,
};

/**
 * Computes base points for a player from live stats
 */
export function computePlayerPoints(
  liveStats: LivePlayerStats,
  position: number, // 1 = GK, 2 = DEF, 3 = MID, 4 = FWD
  rules: ScoringRules = DEFAULT_RULES
): number {
  const stats = liveStats.stats;
  let points = stats.total_points || 0;

  // If bonus is not yet reliable and we're applying bonus logic
  if (rules.applyBonus && rules.bonusReliableAt60 && stats.minutes < 60) {
    // Remove bonus points if match hasn't reached 60 minutes
    // (bonus is only final after 60' or at FT)
    points -= stats.bonus || 0;
  }

  return Math.max(0, points); // Points can't be negative
}

/**
 * Applies captaincy multiplier to a player's points
 */
export function applyCaptaincy(
  pick: Pick,
  basePoints: number,
  rules: ScoringRules = DEFAULT_RULES
): number {
  if (pick.is_captain) {
    return basePoints * rules.captainMultiplier;
  }
  return basePoints;
}

/**
 * Determines if autosub should be applied
 * Returns true if starting player has 0 minutes and bench player has >0 minutes
 */
function shouldAutoSub(
  startingPick: Pick,
  benchPick: Pick,
  startingMinutes: number,
  benchMinutes: number
): boolean {
  return startingMinutes === 0 && benchMinutes > 0;
}

/**
 * Validates formation constraints
 * Returns true if the formation is valid after substitution
 * 
 * Note: Full implementation would require element->type mapping from bootstrap data.
 * This is a simplified version that always allows substitutions.
 */
function isValidFormation(
  _startingXI: Pick[],
  _elementTypes: Map<number, ElementType>,
  _substitutedPosition: number,
  _substitutePosition: number
): boolean {
  // Simplified: always allow substitution
  // Full implementation would check:
  // - GK: exactly 1
  // - DEF: min 3, max 5
  // - MID: min 3, max 5
  // - FWD: min 1, max 3
  return true;
}

/**
 * Applies automatic substitutions
 * 
 * Rules:
 * - If a starting player has 0 minutes, substitute with first bench player that has >0 minutes
 * - Must respect formation constraints (GK, DEF, MID, FWD min/max)
 * - Bench order matters (position 12 is first sub, etc.)
 */
export function applyAutoSubs(
  picks: Pick[],
  liveStatsMap: Map<number, LivePlayerStats>,
  elementTypes: Map<number, ElementType>,
  rules: ScoringRules = DEFAULT_RULES
): Pick[] {
  if (!rules.applyAutosubs) {
    return picks;
  }

  const startingXI = picks.filter((p) => p.position <= 11).sort((a, b) => a.position - b.position);
  const bench = picks.filter((p) => p.position > 11).sort((a, b) => a.position - b.position);

  const finalXI: Pick[] = [];
  const usedBench: Set<number> = new Set();

  // Process each starting position
  for (const starter of startingXI) {
    const starterStats = liveStatsMap.get(starter.element);
    const starterMinutes = starterStats?.stats.minutes || 0;

    if (starterMinutes === 0) {
      // Try to find a substitute
      let substituted = false;
      for (const benchPick of bench) {
        if (usedBench.has(benchPick.position)) continue;

        const benchStats = liveStatsMap.get(benchPick.element);
        const benchMinutes = benchStats?.stats.minutes || 0;

        if (benchMinutes > 0) {
          // Check formation constraints (simplified)
          if (isValidFormation(finalXI, elementTypes, starter.position, benchPick.position)) {
            // Substitute: move bench player to starting position
            finalXI.push({
              ...benchPick,
              position: starter.position,
              is_captain: starter.is_captain,
              is_vice_captain: starter.is_vice_captain,
              multiplier: starter.multiplier,
            });
            usedBench.add(benchPick.position);
            substituted = true;
            break;
          }
        }
      }

      if (!substituted) {
        // No valid sub found, keep original starter
        finalXI.push(starter);
      }
    } else {
      // Starter played, keep them
      finalXI.push(starter);
    }
  }

  // Add remaining bench players in their original positions
  bench.forEach((benchPick) => {
    if (!usedBench.has(benchPick.position)) {
      finalXI.push(benchPick);
    }
  });

  // Sort by position
  return finalXI.sort((a, b) => a.position - b.position);
}

/**
 * Applies bonus points to player stats
 * 
 * Bonus points are only reliable:
 * - After 60 minutes of play (if bonusReliableAt60 is true)
 * - Or when fixture is finished (final bonus)
 */
export function applyBonus(
  liveStats: LivePlayerStats,
  fixtureStatus: "not_started" | "live" | "finished",
  elapsedMinutes: number,
  rules: ScoringRules = DEFAULT_RULES
): number {
  if (!rules.applyBonus) {
    return 0;
  }

  const stats = liveStats.stats;

  // Bonus is only reliable after 60 minutes or when finished
  if (fixtureStatus === "finished") {
    return stats.bonus || 0;
  }

  if (rules.bonusReliableAt60 && fixtureStatus === "live" && elapsedMinutes >= 60) {
    return stats.bonus || 0;
  }

  // Bonus not yet reliable
  return 0;
}

/**
 * Computes total points for a squad
 */
export function computeSquadPoints(
  picks: Pick[],
  liveStatsMap: Map<number, LivePlayerStats>,
  fixtureStatusMap: Map<number, { status: "not_started" | "live" | "finished"; elapsed: number }>,
  elementTypes: Map<number, ElementType>,
  rules: ScoringRules = DEFAULT_RULES
): number {
  // Apply autosubs first
  const finalPicks = applyAutoSubs(picks, liveStatsMap, elementTypes, rules);

  // Compute points for starting XI only
  const startingXI = finalPicks.filter((p) => p.position <= 11);

  let total = 0;

  for (const pick of startingXI) {
    const stats = liveStatsMap.get(pick.element);
    if (!stats) continue;

    const fixtureStatus = fixtureStatusMap.get(pick.element) || {
      status: "not_started" as const,
      elapsed: 0,
    };

    // Get element type (simplified - would need proper mapping from bootstrap)
    // Default to MID (type 3) if not found
    const elementType = elementTypes.get(pick.element) || {
      id: 3,
      singular_name: "Midfielder",
      singular_name_short: "MID",
      squad_select: 5,
      squad_min_play: 3,
      squad_max_play: 5,
    };

    // Compute base points
    let basePoints = computePlayerPoints(stats, elementType.id, rules);

    // Apply bonus
    const bonus = applyBonus(stats, fixtureStatus.status, fixtureStatus.elapsed, rules);
    basePoints += bonus;

    // Apply captaincy
    const finalPoints = applyCaptaincy(pick, basePoints, rules);

    total += finalPoints;
  }

  return total;
}
