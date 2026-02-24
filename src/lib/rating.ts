/**
 * FFA Rating System V1
 * 
 * This model prioritizes competitive conversion (titles, finishes)
 * while using efficiency and scoring strength as stabilizers, not drivers.
 * 
 * Optimized for 10-team leagues. Future expansion to 20 teams will
 * introduce FFA_RATING_V2, not modify this version.
 */

// Trophy base values
const LEAGUE_TITLE_VALUE = 810;
const CUP_VALUE = 540;
const GOBLET_VALUE = 270;

// Silverware multipliers
const DOUBLE_MULTIPLIER = 1.25;
const TREBLE_MULTIPLIER = 1.4;

// Placement points by finish
const PLACEMENT_POINTS: Record<number, number> = {
  1: 0,    // handled via league title
  2: 240,
  3: 120,
  4: 60,
  5: 30,
  6: 0,
  7: -10,
  8: -30,
  9: -60,
  10: -90,
};

// PPG curve parameters
const PPG_MAX = 3;
const PPG_K = 1.4;
const PPG_LAMBDA = 0.3;
const PPG_SCALE = 1000;

// +/G modifier
const ALPHA = 0.1;

export interface SeasonTrophy {
  league?: boolean;
  cup?: boolean;
  goblet?: boolean;
}

export interface ManagerRatingInput {
  placements: number[];        // array of final league positions by season (1–10)
  trophies: SeasonTrophy[];    // per-season trophies won (aligned with placements)
  ppg: number;                  // long-run points per game (0–3)
  plusG: number;                // average points per gameweek
}

export interface LeagueStats {
  leaguePPGMean: number;
  leaguePlusGMean: number;
  leaguePlusGStdDev: number;
}

/**
 * Compute FFA Rating V1 for a manager
 * 
 * @param manager Manager rating inputs
 * @param leagueStats Global league statistics for normalization
 * @returns Final rating score
 */
export function computeManagerRating(
  manager: ManagerRatingInput,
  leagueStats: LeagueStats
): number {
  // 1. Placement Score (Pσ)
  const placementScore = manager.placements.reduce((sum, position) => {
    return sum + (PLACEMENT_POINTS[position] || 0);
  }, 0);

  // 2. Silverware Score (Sσ)
  let silverwareScore = 0;
  
  manager.trophies.forEach((seasonTrophies) => {
    let base = 0;
    if (seasonTrophies.league) base += LEAGUE_TITLE_VALUE;
    if (seasonTrophies.cup) base += CUP_VALUE;
    if (seasonTrophies.goblet) base += GOBLET_VALUE;

    const trophyCount = [
      seasonTrophies.league,
      seasonTrophies.cup,
      seasonTrophies.goblet,
    ].filter(Boolean).length;

    const multiplier =
      trophyCount === 3 ? TREBLE_MULTIPLIER :
      trophyCount === 2 ? DOUBLE_MULTIPLIER :
      1.0;

    silverwareScore += base * multiplier;
  });

  // 3. PPG Efficiency Curve (PPGcx)
  const ppgRatio = manager.ppg / PPG_MAX;
  const ppgCurve = Math.pow(ppgRatio, PPG_K) *
    Math.exp(PPG_LAMBDA * (manager.ppg - leagueStats.leaguePPGMean));
  const ppgPoints = PPG_SCALE * ppgCurve;

  // 4. Base Score
  const baseScore = placementScore + silverwareScore + ppgPoints;

  // 5. +/G Modifier (Bounded)
  const z = (manager.plusG - leagueStats.leaguePlusGMean) / leagueStats.leaguePlusGStdDev;
  const gModifier = 1 + ALPHA * Math.tanh(z);

  // 6. Final Score
  const finalScore = baseScore * gModifier;

  return finalScore;
}

/**
 * Calculate league-wide statistics needed for rating computation
 */
export function calculateLeagueStats(managers: ManagerRatingInput[]): LeagueStats {
  const ppgValues = managers.map((m) => m.ppg);
  const plusGValues = managers.map((m) => m.plusG);

  const leaguePPGMean = ppgValues.reduce((sum, val) => sum + val, 0) / ppgValues.length;
  const leaguePlusGMean = plusGValues.reduce((sum, val) => sum + val, 0) / plusGValues.length;

  const variance = plusGValues.reduce((sum, val) => {
    const diff = val - leaguePlusGMean;
    return sum + diff * diff;
  }, 0) / plusGValues.length;
  const leaguePlusGStdDev = Math.sqrt(variance);

  return {
    leaguePPGMean,
    leaguePlusGMean,
    leaguePlusGStdDev,
  };
}
