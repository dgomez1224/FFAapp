/**
 * LiveMatchups Component - DraftFPL Live-style
 * 
 * Displays live H2H matchups with real-time point updates.
 * Polls every 60 seconds for live data and recomputes scores.
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useEntryId } from "../lib/useEntryId";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  computeSquadPoints,
  type LivePlayerStats,
  type Pick,
  type ElementType,
  type ScoringRules,
} from "../lib/scoring";
import type {
  ContextResponse,
  LiveDataResponse,
  H2HResponse,
  PickResponse,
} from "../lib/types/api";

interface MatchupWithScores {
  entry_1: number;
  entry_1_name: string;
  entry_2: number;
  entry_2_name: string;
  picks_1: Pick[];
  picks_2: Pick[];
  points_1: number;
  points_2: number;
  lastUpdated: string;
}

const POLL_INTERVAL = 300000; // 5 minutes
const DEFAULT_RULES: ScoringRules = {
  applyAutosubs: true,
  applyBonus: true,
  bonusReliableAt60: true,
  captainMultiplier: 2,
};

export function LiveMatchups() {
  const { entryId } = useEntryId();
  const [context, setContext] = useState<ContextResponse | null>(null);
  const [matchups, setMatchups] = useState<MatchupWithScores[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const bootstrapRef = useRef<{
    elementTypeMap: Map<number, number>;
    elementTeamMap: Map<number, number>;
    elementTypes: Map<number, ElementType>;
  } | null>(null);

  // Fetch context once
  useEffect(() => {
    if (!entryId) {
      setLoading(false);
      return;
    }

    async function fetchContext() {
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/context?entryId=${entryId}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        if (!res.ok) throw new Error("Failed to fetch context");
        const data: ContextResponse = await res.json();
        setContext(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load context");
        setLoading(false);
      }
    }

    fetchContext();
  }, [entryId]);

  // Fetch H2H matchups once
  useEffect(() => {
    if (!context || !entryId) return;

    async function fetchH2H() {
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/h2h?entryId=${entryId}&event=${context!.currentEvent}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        if (!res.ok) throw new Error("Failed to fetch H2H matchups");
        const data: H2HResponse = await res.json();
        
        // Initialize matchups with zero scores
        const initialMatchups: MatchupWithScores[] = data.matchups.map((m) => ({
          ...m,
          points_1: 0,
          points_2: 0,
          lastUpdated: new Date().toISOString(),
        }));
        setMatchups(initialMatchups);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load matchups");
        setLoading(false);
      }
    }

    fetchH2H();
  }, [context, entryId]);

  // Polling function
  const pollLiveData = useCallback(async () => {
    if (!context || !entryId || abortControllerRef.current?.signal.aborted) return;

    setIsPolling(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let anyGameLive = false;

    try {
      // Fetch live data
      const liveUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/live?event=${context!.currentEvent}`;
      const liveRes = await fetch(liveUrl, {
        headers: getSupabaseFunctionHeaders(),
        signal: controller.signal,
      });

      if (!liveRes.ok) throw new Error("Failed to fetch live data");
      const liveData: LiveDataResponse = await liveRes.json();

      // Build live stats map (Draft API elements is a keyed object)
      const liveStatsMap = new Map<number, LivePlayerStats>();
      Object.entries(liveData.elements as any).forEach(([key, val]: [string, any]) => {
        const id = Number(key);
        if (!id) return;
        liveStatsMap.set(id, {
          element: id,
          stats: val.stats ?? val,
          explain: val.explain ?? [],
        });
      });

      // Only fetch bootstrap once - it doesn't change during a GW
      if (!bootstrapRef.current) {
        const bootstrapUrl = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/bootstrap`;
        const bootstrap = await fetch(bootstrapUrl, {
          headers: getSupabaseFunctionHeaders(),
          signal: controller.signal,
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        const elementTypeMap = new Map<number, number>();
        const elementTeamMap = new Map<number, number>();
        const elementTypes = new Map<number, ElementType>();

        for (const el of bootstrap?.elements ?? []) {
          elementTypeMap.set(el.id, el.element_type);
          elementTeamMap.set(el.id, el.team);
        }
        for (const et of bootstrap?.element_types ?? []) {
          elementTypes.set(et.id, et as ElementType);
        }

        bootstrapRef.current = { elementTypeMap, elementTeamMap, elementTypes };
      }

      const { elementTypeMap, elementTeamMap, elementTypes } = bootstrapRef.current!;

      // Build fixture status per team, then map to elements
      const teamFixtureStatus = new Map<
        number,
        { status: "not_started" | "live" | "finished"; elapsed: number }
      >();

      anyGameLive = liveData.fixtures.some((f: any) => f.started && !f.finished);

      for (const fixture of liveData.fixtures) {
        const status: "not_started" | "live" | "finished" = fixture.finished
          ? "finished"
          : fixture.started
          ? "live"
          : "not_started";
        const elapsed = fixture.elapsed ?? 0;

        const updateTeam = (teamId: number) => {
          const existing = teamFixtureStatus.get(teamId);
          if (!existing) {
            teamFixtureStatus.set(teamId, { status, elapsed });
          } else {
            if (existing.status === "finished" && status !== "finished") {
              teamFixtureStatus.set(teamId, { status, elapsed });
            }
            if (elapsed > existing.elapsed) {
              teamFixtureStatus.set(teamId, {
                status:
                  existing.status === "finished" && status === "finished"
                    ? "finished"
                    : status === "not_started"
                    ? existing.status
                    : status,
                elapsed: Math.max(elapsed, existing.elapsed),
              });
            }
          }
        };

        updateTeam(fixture.team_h);
        updateTeam(fixture.team_a);
      }

      const fixtureStatusMap = new Map<
        number,
        { status: "not_started" | "live" | "finished"; elapsed: number }
      >();

      elementTeamMap.forEach((teamId, elementId) => {
        const status =
          teamFixtureStatus.get(teamId) ?? ({ status: "not_started", elapsed: 0 } as const);
        fixtureStatusMap.set(elementId, status);
      });
      
      const updatedMatchups: MatchupWithScores[] = matchups.map((matchup) => {
        // Convert PickResponse to Pick format
        const picks1: Pick[] = matchup.picks_1.map((p: PickResponse) => ({
          element: p.element,
          position: p.position,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
          multiplier: p.multiplier,
        }));
        const picks2: Pick[] = matchup.picks_2.map((p: PickResponse) => ({
          element: p.element,
          position: p.position,
          is_captain: p.is_captain,
          is_vice_captain: p.is_vice_captain,
          multiplier: p.multiplier,
        }));
        
        const points1 = computeSquadPoints(
          picks1,
          liveStatsMap,
          fixtureStatusMap,
          elementTypes,
          elementTeamMap,
          elementTypeMap,
          DEFAULT_RULES,
        );
        const points2 = computeSquadPoints(
          picks2,
          liveStatsMap,
          fixtureStatusMap,
          elementTypes,
          elementTeamMap,
          elementTypeMap,
          DEFAULT_RULES,
        );

        return {
          ...matchup,
          points_1: points1,
          points_2: points2,
          lastUpdated: liveData.timestamp,
        };
      });

      setMatchups(updatedMatchups);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Poll error:", err);
        setError(err.message);
      }
    } finally {
      setIsPolling(false);
      // Only continue polling if PL games are currently live
      if (!controller.signal.aborted && anyGameLive) {
        timeoutRef.current = window.setTimeout(pollLiveData, POLL_INTERVAL);
      }
    }
  }, [context, entryId, matchups]);

  // Start polling when context and matchups are loaded
  useEffect(() => {
    if (!context || matchups.length === 0 || loading) return;

    // Initial poll
    pollLiveData();

    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [context, matchups.length, loading, pollLiveData]);

  const handleRefresh = useCallback(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    pollLiveData();
  }, [pollLiveData]);

  if (!entryId) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-2">Live Matchups</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Select an entry ID to view live matchups.
        </p>
        <a
          href="/set-entry"
          className="text-sm text-primary hover:underline"
        >
          Set Entry ID →
        </a>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-2">Live Matchups</h2>
        <p className="text-sm text-muted-foreground">Loading matchups...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-2">Live Matchups</h2>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Live Matchups</h2>
          <p className="text-sm text-muted-foreground">
            Gameweek {context?.currentEvent || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isPolling ? (
            <Badge variant="outline" className="text-xs">Updating...</Badge>
          ) : (
            <button
              onClick={handleRefresh}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              title="Refresh now"
            >
              ↻ Refresh
            </button>
          )}
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {matchups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matchups available for this gameweek.</p>
      ) : (
        <div className="space-y-4">
          {matchups.map((matchup, idx) => (
            <div
              key={`${matchup.entry_1}-${matchup.entry_2}-${idx}`}
              className="border rounded-lg p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">{matchup.entry_1_name}</div>
                  <div className="text-2xl font-bold text-primary">
                    {matchup.points_1.toFixed(1)}
                  </div>
                </div>
                <div className="text-muted-foreground px-4">vs</div>
                <div className="flex-1 text-right">
                  <div className="font-medium">{matchup.entry_2_name}</div>
                  <div className="text-2xl font-bold text-primary">
                    {matchup.points_2.toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                Last updated: {new Date(matchup.lastUpdated).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
