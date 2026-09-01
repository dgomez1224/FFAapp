import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "./supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "./constants";
import type { Division } from "./divisions";
import { resolveRankMovementVisibility } from "./standingsMovement";

export interface Standing {
  team_id: string;
  rank: number;
  manager_name?: string;
  entry_name?: string;
  entry_id?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  points_for: number;
  points_against: number;
  avg_margin_victory?: number | null;
  avg_margin_defeat?: number | null;
}

export interface LeagueStandingsResponse {
  standings: Standing[];
  source: "database" | "draft" | "classic";
  division?: string;
}

export type GwPhase = "pre" | "live" | "post" | "settled";

type StandingAcc = Standing & {
  margin_victory_sum: number;
  margin_defeat_sum: number;
};

function blankStanding(row: Standing): StandingAcc {
  return {
    ...row,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    points_for: 0,
    points_against: 0,
    margin_victory_sum: 0,
    margin_defeat_sum: 0,
    avg_margin_victory: null,
    avg_margin_defeat: null,
  };
}

function toAcc(row: Standing): StandingAcc {
  const existing = row as StandingAcc;
  const winSum = Number(existing.margin_victory_sum);
  const lossSum = Number(existing.margin_defeat_sum);
  return {
    ...row,
    margin_victory_sum: Number.isFinite(winSum)
      ? winSum
      : row.wins > 0 && row.avg_margin_victory != null
        ? Number(row.avg_margin_victory) * row.wins
        : 0,
    margin_defeat_sum: Number.isFinite(lossSum)
      ? lossSum
      : row.losses > 0 && row.avg_margin_defeat != null
        ? Number(row.avg_margin_defeat) * row.losses
        : 0,
  };
}

function withAverageMargins(row: StandingAcc): StandingAcc {
  return {
    ...row,
    avg_margin_victory: row.wins > 0 ? Math.round((row.margin_victory_sum / row.wins) * 10) / 10 : null,
    avg_margin_defeat: row.losses > 0 ? Math.round((row.margin_defeat_sum / row.losses) * 10) / 10 : null,
  };
}

function zeroedStandings(template: Standing[]): Standing[] {
  return template.map((row) => blankStanding(row));
}

function ranksByTeamId(rows: Standing[]): Record<string, number> {
  const map: Record<string, number> = {};
  rows.forEach((row) => {
    map[row.team_id] = row.rank;
  });
  return map;
}

/** Replay the given matches onto a standings snapshot (caller filters which events to include). */
function applyMatchesToStandings(
  baseline: Standing[],
  matches: any[],
  entryIdToTeamId: Record<string, string>,
): Standing[] {
  if (!baseline.length) return baseline;
  if (!matches.length) {
    return baseline
      .slice()
      .sort((a, b) => (b.points !== a.points ? b.points - a.points : b.points_for - a.points_for))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  const byId: Record<string, StandingAcc> = {};
  baseline.forEach((row) => {
    byId[row.team_id] = toAcc(row);
  });

  const baselineIds = new Set(Object.keys(byId));

  matches.forEach((m: any) => {
    const rawTeam1 = m?.league_entry_1 ?? m?.entry_1 ?? m?.home;
    const rawTeam2 = m?.league_entry_2 ?? m?.entry_2 ?? m?.away;
    if (rawTeam1 == null || rawTeam2 == null) return;

    const entry1Id = String(rawTeam1);
    const entry2Id = String(rawTeam2);
    const key1 = entryIdToTeamId[entry1Id] ?? entry1Id;
    const key2 = entryIdToTeamId[entry2Id] ?? entry2Id;

    if (!baselineIds.has(key1) && !baselineIds.has(key2)) return;

    if (!byId[key1]) {
      byId[key1] = blankStanding({
        team_id: key1,
        rank: baseline.length + 1,
        manager_name: "",
        entry_name: "",
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        points_for: 0,
        points_against: 0,
      });
    }
    if (!byId[key2]) {
      byId[key2] = blankStanding({
        team_id: key2,
        rank: baseline.length + 1,
        manager_name: "",
        entry_name: "",
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        points_for: 0,
        points_against: 0,
      });
    }

    const row1 = byId[key1];
    const row2 = byId[key2];
    const rawP1 = m?.league_entry_1_points ?? m?.score_1 ?? m?.home_score ?? 0;
    const rawP2 = m?.league_entry_2_points ?? m?.score_2 ?? m?.away_score ?? 0;
    const p1 = typeof rawP1 === "number" ? rawP1 : Number(rawP1) || 0;
    const p2 = typeof rawP2 === "number" ? rawP2 : Number(rawP2) || 0;
    const margin = Math.abs(p1 - p2);

    row1.points_for += p1;
    row1.points_against += p2;
    row2.points_for += p2;
    row2.points_against += p1;

    if (p1 > p2) {
      row1.wins += 1;
      row1.points += 3;
      row1.margin_victory_sum += margin;
      row2.losses += 1;
      row2.margin_defeat_sum += margin;
    } else if (p2 > p1) {
      row2.wins += 1;
      row2.points += 3;
      row2.margin_victory_sum += margin;
      row1.losses += 1;
      row1.margin_defeat_sum += margin;
    } else {
      row1.draws += 1;
      row2.draws += 1;
      row1.points += 1;
      row2.points += 1;
    }

    row1.played += 1;
    row2.played += 1;
  });

  return Object.values(byId)
    .map(withAverageMargins)
    .sort((a, b) => (b.points !== a.points ? b.points - a.points : b.points_for - a.points_for))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function overlayAverageMargins(
  rows: Standing[],
  matches: any[],
  entryIdToTeamId: Record<string, string>,
): Standing[] {
  if (!rows.length || !matches.length) return rows;
  const computed = applyMatchesToStandings(zeroedStandings(rows), matches, entryIdToTeamId);
  const byId: Record<string, Standing> = {};
  computed.forEach((row) => {
    byId[row.team_id] = row;
  });
  return rows.map((row) => {
    const next = byId[row.team_id];
    return {
      ...row,
      avg_margin_victory: next?.avg_margin_victory ?? row.avg_margin_victory ?? null,
      avg_margin_defeat: next?.avg_margin_defeat ?? row.avg_margin_defeat ?? null,
    };
  });
}

export function useDivisionStandings(division: Division) {
  const [data, setData] = useState<LeagueStandingsResponse | null>(null);
  const [liveStandings, setLiveStandings] = useState<Standing[] | null>(null);
  const [isLiveGameweek, setIsLiveGameweek] = useState(false);
  const [showLiveColumns, setShowLiveColumns] = useState(false);
  const [showRankMovement, setShowRankMovement] = useState(false);
  const [fromRanks, setFromRanks] = useState<Record<string, number> | null>(null);
  const [hideMovementAt, setHideMovementAt] = useState<number | null>(null);
  const [gwPhase, setGwPhase] = useState<GwPhase>("pre");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const baselineRanksRef = useRef<Record<string, number> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideMovementTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movementTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const movementInputRef = useRef<{
    currentGameweek: number;
    currentEventFinished: boolean;
    deadlineTime: string | null;
    newGameweekStartedAt: string | null;
    gwMatchesStarted: boolean;
  } | null>(null);

  const baselineStandings = data?.standings || [];
  const baselineById = useMemo(() => {
    const map: Record<string, Standing> = {};
    baselineStandings.forEach((s) => {
      map[s.team_id] = s;
    });
    return map;
  }, [baselineStandings]);

  const rowsToRender = isLiveGameweek && liveStandings ? liveStandings : baselineStandings;

  useEffect(() => {
    baselineRanksRef.current = null;
    let eventFinished = true;

    async function fetchStandings(): Promise<boolean> {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ division });
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-standings?${params}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: LeagueStandingsResponse = await res.json();

        if (!res.ok || (payload as any)?.error) {
          throw new Error((payload as any)?.error?.message || "Failed to fetch league standings");
        }

        let entryIdToTeamId: Record<string, string> = {};
        if (Array.isArray(payload.standings)) {
          payload.standings.forEach((s: any) => {
            const entryId = (s as any).entry_id;
            const teamId = (s as any).team_id;
            if (entryId != null && teamId) {
              entryIdToTeamId[String(entryId)] = String(teamId);
            }
          });
        }

        setData(payload);

        try {
          const gwRes = await fetch(
            `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
            { headers: getSupabaseFunctionHeaders() },
          );
          const gwData = gwRes.ok ? await gwRes.json() : null;
          const currentGw = gwData?.current_gameweek || 0;

          let matches: any[] = [];
          let leagueEntries: any[] = [];
          try {
            const matchParams = new URLSearchParams({ division });
            const matchRes = await fetch(
              `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-standings/matches?${matchParams}`,
              { headers: getSupabaseFunctionHeaders() },
            );
            if (matchRes.ok) {
              const matchJson = await matchRes.json();
              matches = Array.isArray(matchJson?.matches) ? matchJson.matches : [];
              leagueEntries = Array.isArray(matchJson?.league_entries) ? matchJson.league_entries : [];
            }
          } catch {
            matches = [];
          }

          if (Array.isArray(leagueEntries) && leagueEntries.length && Array.isArray(payload.standings) && payload.standings.length) {
            const nameByEntryId: Record<string, { entry_name: string; manager_name: string }> = {};
            leagueEntries.forEach((e: any) => {
              const fplId = String(e.entry_id ?? e.entry ?? "").trim();
              if (!fplId) return;
              const firstName = String(e.player_first_name ?? "").trim();
              const lastName = String(e.player_last_name ?? "").trim();
              const draftName = [firstName, lastName].filter(Boolean).join(" ");
              const looksDeleted = !firstName || firstName.toLowerCase() === "deleted";
              nameByEntryId[fplId] = {
                entry_name: String(e.entry_name ?? "").trim() || fplId,
                manager_name: looksDeleted ? "" : draftName || fplId,
              };
            });

            if (Object.keys(nameByEntryId).length > 0) {
              payload.standings = payload.standings.map((s: any) => {
                const fplId = String((s as any).entry_id ?? "");
                const names = fplId ? nameByEntryId[fplId] : null;
                return names
                  ? {
                      ...s,
                      entry_name: names.entry_name || s.entry_name,
                      manager_name: names.manager_name || s.manager_name,
                    }
                  : s;
              });
              setData({ ...payload });
            }
          }

          if (Array.isArray(leagueEntries)) {
            leagueEntries.forEach((e: any) => {
              const internalId = String(e.id ?? e.league_entry_id ?? "").trim();
              const fplId = String(e.entry_id ?? e.entry ?? "").trim();
              const teamRow = payload.standings.find((s: any) => String(s.entry_id) === fplId);
              if (internalId && teamRow?.team_id) {
                entryIdToTeamId[internalId] = String(teamRow.team_id);
              }
              if (fplId && teamRow?.team_id) {
                entryIdToTeamId[fplId] = String(teamRow.team_id);
              }
            });
          }

          const finishedMatches = matches.filter((m: any) => {
            const event = Number(m?.event || 0);
            if (event <= 0) return false;
            if (currentGw > 0 && event < currentGw) return true;
            return m?.finished === true;
          });
          if (finishedMatches.length && payload.standings?.length) {
            payload.standings = overlayAverageMargins(
              payload.standings,
              finishedMatches,
              entryIdToTeamId,
            );
            setData({ ...payload });
          }

          const gwMatches = matches.filter((m: any) => Number(m?.event) === currentGw);
          const hasCurrentGwMatches = currentGw > 0 && gwMatches.length > 0;
          const gwStarted = gwMatches.some((m: any) => m?.started === true);
          const gwFullyFinished = gwMatches.length > 0 && gwMatches.every((m: any) => m?.finished === true);
          const gwInProgress = gwStarted && !gwFullyFinished;
          eventFinished = gwData?.current_event_finished === true;

          let phase: GwPhase;
          if (!gwStarted) phase = "pre";
          else if (gwInProgress) phase = "live";
          else if (gwFullyFinished && !eventFinished) phase = "post";
          else phase = "settled";
          setGwPhase(phase);

          const movementInput = {
            currentGameweek: currentGw,
            currentEventFinished: eventFinished,
            deadlineTime: gwData?.deadline_time || null,
            newGameweekStartedAt: gwData?.new_gameweek_started_at || gwData?.trades_time || gwData?.waivers_time || gwData?.deadline_time || null,
            gwMatchesStarted: gwStarted,
          };
          movementInputRef.current = movementInput;
          const visibility = resolveRankMovementVisibility(movementInput);
          setShowRankMovement(visibility.show);
          setHideMovementAt(visibility.hideAt);

          const movementGw = visibility.movementGameweek;
          const template = payload.standings || [];
          const priorMatches = matches.filter(
            (m: any) => Number(m?.event) > 0 && movementGw != null && Number(m.event) < movementGw,
          );
          const fromRows = template.length
            ? applyMatchesToStandings(zeroedStandings(template), priorMatches, entryIdToTeamId)
            : [];
          const replayWorked = fromRows.some((row) => row.played > 0) || priorMatches.length === 0;
          const startRows = replayWorked && fromRows.length ? fromRows : template;
          if (visibility.show && startRows.length) {
            const nextFromRanks = ranksByTeamId(startRows);
            setFromRanks(nextFromRanks);
            baselineRanksRef.current = nextFromRanks;
          } else {
            setFromRanks(null);
            baselineRanksRef.current = null;
          }

          if (!currentGw || !hasCurrentGwMatches || !payload.standings?.length) {
            setLiveStandings(null);
            setIsLiveGameweek(false);
            setShowLiveColumns(false);
          } else {
            switch (phase) {
              case "pre":
                setLiveStandings(null);
                setIsLiveGameweek(false);
                setShowLiveColumns(false);
                break;
              case "live":
                setLiveStandings(applyMatchesToStandings(startRows, gwMatches, entryIdToTeamId));
                setIsLiveGameweek(true);
                setShowLiveColumns(true);
                break;
              case "post":
                setLiveStandings(applyMatchesToStandings(startRows, gwMatches, entryIdToTeamId));
                setIsLiveGameweek(true);
                setShowLiveColumns(false);
                break;
              case "settled":
                setLiveStandings(null);
                setIsLiveGameweek(true);
                setShowLiveColumns(false);
                break;
            }
          }
        } catch {
          setGwPhase("pre");
          setIsLiveGameweek(false);
          setShowLiveColumns(false);
          setShowRankMovement(false);
          setFromRanks(null);
          setHideMovementAt(null);
          setLiveStandings(null);
          movementInputRef.current = null;
        }
      } catch (err: any) {
        setError(err.message || "Failed to load league standings");
      } finally {
        setLoading(false);
      }
      return eventFinished;
    }

    fetchStandings().then((finished) => {
      if (!finished) {
        pollingIntervalRef.current = setInterval(fetchStandings, 300_000);
      }
    });

    movementTickRef.current = setInterval(() => {
      const input = movementInputRef.current;
      if (!input) return;
      const visibility = resolveRankMovementVisibility(input);
      setShowRankMovement(visibility.show);
      setHideMovementAt(visibility.hideAt);
      if (!visibility.show) {
        setFromRanks(null);
        baselineRanksRef.current = null;
      }
    }, 30_000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (movementTickRef.current) {
        clearInterval(movementTickRef.current);
        movementTickRef.current = null;
      }
      if (hideMovementTimerRef.current) {
        clearTimeout(hideMovementTimerRef.current);
        hideMovementTimerRef.current = null;
      }
    };
  }, [division]);

  useEffect(() => {
    if (hideMovementTimerRef.current) {
      clearTimeout(hideMovementTimerRef.current);
      hideMovementTimerRef.current = null;
    }
    if (hideMovementAt == null) return;
    const delay = hideMovementAt - Date.now();
    if (delay <= 0) {
      setShowRankMovement(false);
      setFromRanks(null);
      baselineRanksRef.current = null;
      return;
    }
    hideMovementTimerRef.current = setTimeout(() => {
      setShowRankMovement(false);
      setFromRanks(null);
      baselineRanksRef.current = null;
      hideMovementTimerRef.current = null;
    }, delay);
    return () => {
      if (hideMovementTimerRef.current) {
        clearTimeout(hideMovementTimerRef.current);
        hideMovementTimerRef.current = null;
      }
    };
  }, [hideMovementAt]);

  return {
    data,
    loading,
    error,
    rowsToRender,
    baselineById,
    baselineRanksRef,
    fromRanks,
    showRankMovement,
    isLiveGameweek,
    showLiveColumns,
    gwPhase,
  };
}
