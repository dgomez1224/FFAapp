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
  xi: { element: number; typeId: number }[],
  outTypeId: number,
  inTypeId: number,
): boolean {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const p of xi) {
    if (!p.typeId) continue;
    counts[p.typeId] = (counts[p.typeId] ?? 0) + 1;
  }

  counts[outTypeId] = (counts[outTypeId] ?? 0) - 1;
  counts[inTypeId] = (counts[inTypeId] ?? 0) + 1;

  if (counts[1] !== 1) return false; // exactly 1 GK
  if ((counts[2] ?? 0) < 3) return false; // at least 3 DEF
  if ((counts[4] ?? 0) < 1) return false; // at least 1 FWD

  const total =
    (counts[1] ?? 0) + (counts[2] ?? 0) + (counts[3] ?? 0) + (counts[4] ?? 0);
  if (total !== 11) return false;

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
  fixtureStatusMap: Map<number, { status: "not_started" | "live" | "finished"; elapsed: number }>,
  elementTeamMap: Map<number, number>,
  elementTypeMap: Map<number, number>,
  rules: ScoringRules = DEFAULT_RULES,
): Pick[] {
  if (!rules.applyAutosubs) return picks;

  let starters = picks
    .filter((p) => p.position <= 11)
    .sort((a, b) => a.position - b.position);
  const bench = picks
    .filter((p) => p.position > 11)
    .sort((a, b) => a.position - b.position);

  const gkBench = bench.find((p) => (elementTypeMap.get(p.element) ?? 3) === 1);
  const outfieldBench = bench
    .filter((p) => (elementTypeMap.get(p.element) ?? 3) !== 1)
    .sort((a, b) => a.position - b.position);

  const usedBench = new Set<number>();

  function gameFinished(element: number): boolean {
    return fixtureStatusMap.get(element)?.status === "finished";
  }

  function playedMinutes(element: number): boolean {
    return (liveStatsMap.get(element)?.stats.minutes ?? 0) > 0;
  }

  function typeOf(element: number): number {
    return elementTypeMap.get(element) ?? 3;
  }

  function getXITypes(xi: Pick[]): { element: number; typeId: number }[] {
    return xi.map((p) => ({ element: p.element, typeId: typeOf(p.element) }));
  }

  const gkStarter = starters.find((p) => typeOf(p.element) === 1);
  if (gkStarter && gkBench) {
    const starterPlayed = playedMinutes(gkStarter.element);
    const starterGameDone = gameFinished(gkStarter.element);
    const benchPlayed = playedMinutes(gkBench.element);
    const benchGameDone = gameFinished(gkBench.element);

    if (!starterPlayed && starterGameDone && benchPlayed && benchGameDone) {
      starters = starters.map((p) =>
        p.element === gkStarter.element
          ? {
              ...gkBench,
              position: gkStarter.position,
              is_captain: false,
              is_vice_captain: false,
              multiplier: 1,
            }
          : p,
      );
      usedBench.add(gkBench.element);
    }
  }

  for (let i = 0; i < starters.length; i++) {
    const starter = starters[i];
    if (typeOf(starter.element) === 1) continue;
    if (playedMinutes(starter.element)) continue;
    if (!gameFinished(starter.element)) continue;

    for (let j = 0; j < outfieldBench.length; j++) {
      const candidate = outfieldBench[j];
      if (usedBench.has(candidate.element)) continue;

      const candidatePlayed = playedMinutes(candidate.element);
      const candidateGameDone = gameFinished(candidate.element);

      let queueBlocked = false;
      for (let k = 0; k < j; k++) {
        const earlier = outfieldBench[k];
        if (usedBench.has(earlier.element)) continue;
        const earlierGameDone = gameFinished(earlier.element);
        const earlierPlayed = playedMinutes(earlier.element);
        if (!earlierGameDone) {
          queueBlocked = true;
          break;
        }
        if (earlierGameDone && !earlierPlayed) {
          continue;
        }
        queueBlocked = true;
        break;
      }

      if (queueBlocked) break;

      if (!candidatePlayed || !candidateGameDone) {
        if (!candidateGameDone) break;
        continue;
      }

      const xiTypes = getXITypes(starters);
      const outType = typeOf(starter.element);
      const inType = typeOf(candidate.element);

      if (!isValidFormation(xiTypes, outType, inType)) continue;

      starters[i] = {
        ...candidate,
        position: starter.position,
        is_captain: false,
        is_vice_captain: false,
        multiplier: 1,
      };
      usedBench.add(candidate.element);
      break;
    }
  }

  const unusedBench = bench.filter((p) => !usedBench.has(p.element));
  return [...starters, ...unusedBench].sort((a, b) => a.position - b.position);
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
  elementTeamMap: Map<number, number>,
  elementTypeMap: Map<number, number>,
  rules: ScoringRules = DEFAULT_RULES,
): number {
  // Apply autosubs first
  const finalPicks = applyAutoSubs(
    picks,
    liveStatsMap,
    elementTypes,
    fixtureStatusMap,
    elementTeamMap,
    elementTypeMap,
    rules,
  );

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
