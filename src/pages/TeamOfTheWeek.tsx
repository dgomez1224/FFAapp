/**
 * Team of the Week — best legal FPL XI from owned league players.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import { PlayerStats, PlayerStatsModal } from "../components/PlayerStatsModal";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import type { TotwPlayer, TotwPool, TotwScope, TotwResponse } from "../lib/teamOfTheWeek";
import { totwFromPool, fetchTotwPool } from "../lib/teamOfTheWeek";

function toPitchPlayers(players: TotwPlayer[]): PitchPlayer[] {
  return players.map((p) => ({
    player_id: p.player_id,
    player_name: p.player_name,
    web_name: p.web_name,
    player_image_url: p.player_image_url,
    position: p.position,
    raw_points: p.points,
    effective_points: p.points,
    is_captain: false,
    is_vice_captain: false,
    is_cup_captain: false,
    multiplier: 1,
    goals_scored: p.goals,
    assists: p.assists,
    minutes: p.minutes,
    manager_name: p.manager_name || undefined,
    manager_names: p.manager_names,
  }));
}

const SCOPE_OPTIONS: Array<{ id: TotwScope; label: string }> = [
  { id: "all", label: "Combined League" },
  { id: "division_one", label: "Division 1" },
  { id: "division_two", label: "Division 2" },
];

export function TeamOfTheWeekPanel({
  compact = false,
  fillHeight = false,
}: {
  compact?: boolean;
  fillHeight?: boolean;
}) {
  const [pool, setPool] = useState<TotwPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [scope, setScope] = useState<TotwScope>("all");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const payload = await fetchTotwPool(selectedGw || undefined);
        if (!cancelled) setPool(payload);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load Team of the Week");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedGw]);

  const data: TotwResponse | null = useMemo(() => (pool ? totwFromPool(pool, scope) : null), [pool, scope]);

  const allPlayers = useMemo(() => {
    if (!data) return [] as TotwPlayer[];
    return [
      ...(data.lineup?.GK || []),
      ...(data.lineup?.DEF || []),
      ...(data.lineup?.MID || []),
      ...(data.lineup?.FWD || []),
      ...(data.bench || []),
    ];
  }, [data]);

  const pitchPlayers = useMemo(
    () =>
      toPitchPlayers([
        ...(data?.lineup?.GK || []),
        ...(data?.lineup?.DEF || []),
        ...(data?.lineup?.MID || []),
        ...(data?.lineup?.FWD || []),
      ]),
    [data],
  );

  const gwOptions = useMemo(() => {
    const latest = data?.latest_completed || data?.gameweek || 1;
    return Array.from({ length: Math.max(1, latest) }, (_, i) => i + 1);
  }, [data]);

  const handlePlayerClick = async (player: PitchPlayer | TotwPlayer) => {
    const totw = allPlayers.find((p) => p.player_id === player.player_id);
    const points = Number(
      ("raw_points" in player ? player.raw_points : undefined) ?? totw?.points ?? 0,
    );
    const position = Number(player.position || totw?.position || 0);
    const base: PlayerStats = {
      player_id: player.player_id,
      player_name: player.player_name,
      player_image_url: totw?.player_image_url || ("player_image_url" in player ? player.player_image_url : undefined),
      position,
      raw_points: points,
      effective_points: points,
      is_captain: false,
      is_vice_captain: false,
      is_cup_captain: false,
      multiplier: 1,
      goals_scored: totw?.goals ?? ("goals_scored" in player ? player.goals_scored : 0),
      assists: totw?.assists ?? ("assists" in player ? player.assists : 0),
      minutes: totw?.minutes ?? ("minutes" in player ? player.minutes : 0),
      bonus: totw?.bonus,
    };
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-history?player_id=${encodeURIComponent(String(player.player_id))}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error("Failed to fetch player history");
      setSelectedPlayer({
        ...base,
        history: (payload.history || []).map((h: any) => ({
          gameweek: h.gameweek,
          points: h.points ?? 0,
          goals: h.goals ?? 0,
          assists: h.assists ?? 0,
          minutes: h.minutes ?? 0,
          clean_sheets: h.clean_sheets ?? 0,
          goals_conceded: h.goals_conceded ?? 0,
          bonus: h.bonus ?? 0,
          saves: h.saves ?? 0,
          yellow_cards: h.yellow_cards ?? 0,
          red_cards: h.red_cards ?? 0,
          penalties_saved: h.penalties_saved ?? 0,
          penalties_missed: h.penalties_missed ?? 0,
          opponent_team_name: h.opponent_team_name ?? null,
          was_home: h.was_home,
          fixture: h.fixture ?? null,
          result: h.result ?? null,
          kickoff_time: h.kickoff_time ?? null,
        })),
      });
    } catch {
      setSelectedPlayer(base);
    }
  };

  const shell = `rounded-lg border bg-background p-3 ${
    fillHeight ? "flex h-full min-h-0 flex-col" : ""
  }`;

  if (loading && !data) {
    return (
      <div className={shell}>
        <h2 className="text-base font-semibold">Team of the Week</h2>
        <p className="mt-2 text-sm text-muted-foreground">Selecting the best legal XI…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={shell}>
        <h2 className="text-base font-semibold">Team of the Week</h2>
        <p className="mt-2 text-sm text-destructive">{error || "No Team of the Week yet."}</p>
      </div>
    );
  }

  const scopeButtons = (
    <div className="flex flex-wrap items-center gap-1">
      {SCOPE_OPTIONS.map((option) => (
        <Button
          key={option.id}
          type="button"
          size="sm"
          variant={scope === option.id ? "default" : "outline"}
          onClick={() => setScope(option.id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );

  return (
    <div className={shell}>
      <div className="mb-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Team of the Week</h2>
          <p className="text-xs text-muted-foreground">
            GW {data.gameweek} · {data.formation} · {data.total_points} pts
            {compact ? (
              <>
                {" · "}
                <Link to="/team-of-the-week" className="text-primary hover:underline">
                  Full XI
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scopeButtons}
          {!compact
            ? gwOptions.slice(Math.max(0, gwOptions.length - 8)).map((gw) => (
                <Button
                  key={gw}
                  type="button"
                  size="sm"
                  variant={(selectedGw || data.gameweek) === gw ? "default" : "outline"}
                  onClick={() => setSelectedGw(gw)}
                >
                  GW {gw}
                </Button>
              ))
            : null}
        </div>
      </div>

      {pitchPlayers.length ? (
        <div
          className={
            fillHeight
              ? "min-h-[280px] w-full flex-1 lg:min-h-0"
              : `mx-auto w-full ${compact ? "max-w-[220px]" : "max-w-[280px]"}`
          }
        >
          <FootballPitch
            players={pitchPlayers}
            showCaptain={false}
            onPlayerClick={handlePlayerClick}
            plainBackground
            size="sm"
            fillHeight={fillHeight}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Not enough completed performances for a full XI yet.</p>
      )}

      {data.bench?.length && !fillHeight ? (
        <div className="mt-3 shrink-0">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bench</p>
          <div className={`grid gap-1.5 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
            {data.bench.map((p) => (
              <button
                key={p.player_id}
                type="button"
                onClick={() => handlePlayerClick(p)}
                className="rounded-md border bg-background p-1.5 text-left text-xs hover:bg-accent/50"
              >
                <p className="truncate font-medium">{p.web_name || p.player_name}</p>
                <p className="text-[10px] tabular-nums text-muted-foreground">{p.points} pts</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {p.manager_names?.length ? p.manager_names.join(", ") : p.manager_name}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <PlayerStatsModal
        player={selectedPlayer!}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        showHistory
      />
    </div>
  );
}

export default function TeamOfTheWeekPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Team of the Week</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Highest-scoring owned players in a legal FPL lineup: 1 GK, 3–5 DEF, 3–5 MID, 1–3 FWD.
        </p>
      </div>
      <TeamOfTheWeekPanel />
    </div>
  );
}
