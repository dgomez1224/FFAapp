/** How long rank arrows stay after a new gameweek becomes current. */
export const RANK_MOVEMENT_GRACE_MS = 24 * 60 * 60 * 1000;

export type RankMovementVisibility = {
  show: boolean;
  movementGameweek: number | null;
  hideAt: number | null;
};

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Rank arrows:
 * - stay up for the whole time the current gameweek is being played
 * - after the next gameweek starts, keep the previous GW arrows for 24h
 * - then return to a neutral dash
 */
export function resolveRankMovementVisibility(opts: {
  now?: number;
  currentGameweek: number;
  currentEventFinished: boolean;
  deadlineTime?: string | null;
  /** When this current event opened (Draft `trades_time`). */
  newGameweekStartedAt?: string | null;
  gwMatchesStarted: boolean;
}): RankMovementVisibility {
  const now = opts.now ?? Date.now();
  const currentGameweek = Number(opts.currentGameweek) || 0;
  if (currentGameweek < 1) {
    return { show: false, movementGameweek: null, hideAt: null };
  }

  const deadlineMs = parseTime(opts.deadlineTime ?? null);
  const deadlinePassed = deadlineMs != null && now >= deadlineMs;

  if (opts.gwMatchesStarted || deadlinePassed || opts.currentEventFinished) {
    return { show: true, movementGameweek: currentGameweek, hideAt: null };
  }

  // New gameweek is current but has not started — keep last GW's arrows for 24h.
  const startedAt = parseTime(opts.newGameweekStartedAt ?? null) ?? deadlineMs;
  if (currentGameweek > 1 && startedAt != null) {
    const hideAt = startedAt + RANK_MOVEMENT_GRACE_MS;
    if (now < hideAt) {
      return { show: true, movementGameweek: currentGameweek - 1, hideAt };
    }
  }

  return { show: false, movementGameweek: null, hideAt: null };
}
