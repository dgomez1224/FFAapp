/**
 * Player Insights - Public Read-Only
 */

import React, { useEffect, useMemo, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";

interface PlayerInsight {
  player_id: number;
  player_name: string;
  position?: number | null;
  team?: number | null;
  team_name?: string | null;
  availability?: string | null;
  goals_scored?: number;
  assists?: number;
  defensive_contribution_returns?: number;
  defensive_contributions?: number;
  points_per_game_played?: number;
  minutes_per_game_played?: number;
  points_per_minute_played?: number;
  points_per_90_played?: number;
  average_points_home?: number | null;
  average_points_away?: number | null;
  home_games?: number;
  away_games?: number;
  home_points?: number;
  away_points?: number;
  total_points?: number;
  games_played?: number;
  selected_count?: number;
  captain_count?: number;
  captain_frequency?: number;
  total_points_contributed?: number;
  teams_using?: number;
  selected_by_percent?: number;
  ownership_status?: string;
  owner_team?: string | null;
  owned_by?: string[];
  total_minutes?: number;
}

interface PlayerInsightsResponse {
  insights?: PlayerInsight[];
  managers?: string[];
  source: "database" | "fpl_bootstrap";
}

const POSITION_NAMES: Record<number, string> = {
  1: "GK",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  a: "Available",
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
};

/** Normalize manager name for strict comparison: trim, collapse spaces, lowercase. */
function normalizeManagerNameForMatch(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Canonical form used elsewhere (e.g. teams.manager_name): uppercase, first token.
 * "David Gomez" -> "DAVID", so dropdown "DAVID" can match table "David Gomez".
 */
function canonicalManagerFromFullName(name: string): string {
  const upper = String(name || "").trim().toUpperCase();
  const first = upper.split(/[^A-Z]+/).filter(Boolean)[0] || "";
  return first || upper;
}

/** True when owner is the same person: full name match OR canonical match (e.g. DAVID === David Gomez). */
function ownerMatchesFilter(owner: string, selectedFilter: string): boolean {
  const o = String(owner || "").trim();
  const f = String(selectedFilter || "").trim();
  if (!o || !f) return false;
  if (normalizeManagerNameForMatch(o) === normalizeManagerNameForMatch(f)) return true;
  const ownerCanonical = canonicalManagerFromFullName(o);
  const filterCanonical = f.toUpperCase();
  return ownerCanonical !== "" && filterCanonical !== "" && ownerCanonical === filterCanonical;
}

export default function PlayerInsights() {
  const [data, setData] = useState<PlayerInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("total_points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [filterPosition, setFilterPosition] = useState<string>("");
  const [filterTeam, setFilterTeam] = useState<string>("");
  const [filterAvailability, setFilterAvailability] = useState<string>("");
  const [filterOwnership, setFilterOwnership] = useState<string>("all");
  const [pendingMinAvgMinutes, setPendingMinAvgMinutes] = useState<number>(0);
  const [pendingMaxAvgMinutes, setPendingMaxAvgMinutes] = useState<number>(90);
  const [filterMinAvgMinutes, setFilterMinAvgMinutes] = useState<number>(0);
  const [filterMaxAvgMinutes, setFilterMaxAvgMinutes] = useState<number>(90);
  const [pendingSearch, setPendingSearch] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState<string>("");

  // Debounce slider (avg min) so dragging doesn't re-filter every pixel
  useEffect(() => {
    const t = setTimeout(() => {
      setFilterMinAvgMinutes(pendingMinAvgMinutes);
      setFilterMaxAvgMinutes(pendingMaxAvgMinutes);
    }, 450);
    return () => clearTimeout(t);
  }, [pendingMinAvgMinutes, pendingMaxAvgMinutes]);

  // Debounce search so typing doesn't re-filter on every keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      setFilterSearch(pendingSearch);
    }, 500);
    return () => clearTimeout(t);
  }, [pendingSearch]);

  // Single fetch: API returns all players; filtering is client-side
  useEffect(() => {
    async function fetchInsights() {
      try {
        setLoading(true);
        setError(null);
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-insights`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload: PlayerInsightsResponse = await res.json();

        if (!res.ok || (payload as any)?.error) {
          throw new Error((payload as any)?.error?.message || "Failed to fetch player insights");
        }

        setData(payload);
      } catch (err: any) {
        setError(err.message || "Failed to load player insights");
      } finally {
        setLoading(false);
      }
    }

    fetchInsights();
  }, []);

  const allPlayers = data?.insights || [];

  // Client-side filters (API returns all players)
  const filteredPlayers = useMemo(() => {
    let rows = allPlayers;
    if (filterPosition) {
      const pos = Number(filterPosition);
      if (Number.isFinite(pos)) rows = rows.filter((p) => Number(p.position) === pos);
    }
    if (filterTeam) {
      const team = Number(filterTeam);
      if (Number.isFinite(team)) rows = rows.filter((p) => Number(p.team) === team);
    }
    if (filterAvailability) {
      const avail = String(filterAvailability).toLowerCase();
      rows = rows.filter((p) => String(p.availability || "").toLowerCase() === avail);
    }
    if (filterOwnership && filterOwnership !== "all") {
      if (filterOwnership === "free_agent" || filterOwnership === "unowned") {
        rows = rows.filter((p) => !(p.owned_by || []).length);
      } else {
        rows = rows.filter((p) =>
          (p.owned_by || []).some((o) => ownerMatchesFilter(String(o || ""), filterOwnership))
        );
      }
    }
    const minAvg = Number(filterMinAvgMinutes);
    const maxAvg = Number(filterMaxAvgMinutes);
    if (Number.isFinite(minAvg) || Number.isFinite(maxAvg)) {
      rows = rows.filter((p) => {
        const mpg = Number(p.minutes_per_game_played ?? 0);
        if (Number.isFinite(minAvg) && mpg < minAvg) return false;
        if (Number.isFinite(maxAvg) && mpg > maxAvg) return false;
        return true;
      });
    }
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      rows = rows.filter((p) => String(p.player_name || "").toLowerCase().includes(q));
    }
    return rows;
  }, [
    allPlayers,
    filterPosition,
    filterTeam,
    filterAvailability,
    filterOwnership,
    filterMinAvgMinutes,
    filterMaxAvgMinutes,
    filterSearch,
  ]);

  const sortedPlayers = useMemo(() => {
    const rows = [...filteredPlayers];
    rows.sort((a, b) => {
      const av = (a as any)?.[sortKey];
      const bv = (b as any)?.[sortKey];
      const an = Number(av);
      const bn = Number(bv);

      let cmp = 0;
      if (!Number.isNaN(an) && !Number.isNaN(bn) && av !== "" && bv !== "") {
        cmp = an - bn;
      } else {
        cmp = String(av ?? "").localeCompare(String(bv ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [filteredPlayers, sortDir, sortKey]);

  const teamOptions = useMemo(() => {
    const set = new Set<number>();
    allPlayers.forEach((p) => {
      if (typeof p.team === "number" && Number.isFinite(p.team)) set.add(p.team);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [allPlayers]);

  if (loading) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Player Insights</h1>
        <p className="text-sm text-muted-foreground">Loading player insights...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Player Insights</h1>
        <p className="text-sm text-destructive">{error}</p>
      </Card>
    );
  }

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const sortLabel = (key: string) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Player Insights</h1>
        <p className="text-sm text-muted-foreground">
          Expanded player analytics with filters and sortable advanced metrics.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            className="rounded-md border px-3 py-2 text-sm"
            placeholder="Search by name"
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
          />
          <select className="rounded-md border px-3 py-2 text-sm" value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)}>
            <option value="">All Positions</option>
            <option value="1">GK</option>
            <option value="2">DEF</option>
            <option value="3">MID</option>
            <option value="4">FWD</option>
          </select>
          <select className="rounded-md border px-3 py-2 text-sm" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
            <option value="">All Teams</option>
            {teamOptions.map((team) => (
              <option key={team} value={String(team)}>
                {(allPlayers.find((p) => p.team === team)?.team_name || `Team ${team}`)}
              </option>
            ))}
          </select>
          <select className="rounded-md border px-3 py-2 text-sm" value={filterAvailability} onChange={(e) => setFilterAvailability(e.target.value)}>
            <option value="">All Availability</option>
            <option value="a">Available</option>
            <option value="d">Doubtful</option>
            <option value="i">Injured</option>
            <option value="s">Suspended</option>
            <option value="u">Unavailable</option>
          </select>
          <select className="rounded-md border px-3 py-2 text-sm" value={filterOwnership} onChange={(e) => setFilterOwnership(e.target.value)}>
            <option value="all">All Managers</option>
            <option value="free_agent">Free agent</option>
            {(data?.managers || []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <div className="rounded-md border px-3 py-2 text-sm">
            <div className="mb-1 text-xs text-muted-foreground">
              Min/Game: {pendingMinAvgMinutes} - {pendingMaxAvgMinutes}
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={pendingMinAvgMinutes}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  // Filters directly against minutes_per_game_played (Min/Game column).
                  setPendingMinAvgMinutes(Math.min(next, pendingMaxAvgMinutes));
                }}
              />
              <input
                type="range"
                min={0}
                max={90}
                step={1}
                value={pendingMaxAvgMinutes}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  // Filters directly against minutes_per_game_played (Min/Game column).
                  setPendingMaxAvgMinutes(Math.max(next, pendingMinAvgMinutes));
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("player_name")}>Player{sortLabel("player_name")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("position")}>Pos{sortLabel("position")}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("team_name")}>Team{sortLabel("team_name")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("goals_scored")}>Goals{sortLabel("goals_scored")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("assists")}>Assists{sortLabel("assists")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("total_points")}>Total Pts{sortLabel("total_points")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("games_played")}>Games{sortLabel("games_played")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("total_minutes")}>Total Min{sortLabel("total_minutes")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("defensive_contribution_returns")}>Def Returns{sortLabel("defensive_contribution_returns")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("defensive_contributions")}>Def Contrib{sortLabel("defensive_contributions")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("points_per_game_played")}>Pts/Game{sortLabel("points_per_game_played")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("minutes_per_game_played")}>Min/Game{sortLabel("minutes_per_game_played")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("points_per_90_played")}>Pts/90{sortLabel("points_per_90_played")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("home_games")}>Home GP{sortLabel("home_games")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("away_games")}>Away GP{sortLabel("away_games")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("home_points")}>Home Pts{sortLabel("home_points")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("away_points")}>Away Pts{sortLabel("away_points")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("average_points_home")}>Avg Home Pts{sortLabel("average_points_home")}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("average_points_away")}>Avg Away Pts{sortLabel("average_points_away")}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("ownership_status")}>Ownership{sortLabel("ownership_status")}</TableHead>
                <TableHead className="text-right">Injury status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayers.map((p) => (
                <TableRow key={p.player_id}>
                  <TableCell className="font-medium">{p.player_name}</TableCell>
                  <TableCell className="text-right">{p.position ? POSITION_NAMES[p.position] : "—"}</TableCell>
                  <TableCell>{p.team_name || "—"}</TableCell>
                  <TableCell className="text-right">{p.goals_scored ?? 0}</TableCell>
                  <TableCell className="text-right">{p.assists ?? 0}</TableCell>
                  <TableCell className="text-right">{p.total_points ?? 0}</TableCell>
                  <TableCell className="text-right">{p.games_played ?? 0}</TableCell>
                  <TableCell className="text-right">{p.total_minutes ?? 0}</TableCell>
                  <TableCell className="text-right">{p.defensive_contribution_returns ?? 0}</TableCell>
                  <TableCell className="text-right">{p.defensive_contributions ?? 0}</TableCell>
                  <TableCell className="text-right">{(p.points_per_game_played ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{(p.minutes_per_game_played ?? 0).toFixed(1)}</TableCell>
                  <TableCell className="text-right">{(p.points_per_90_played ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{p.home_games ?? 0}</TableCell>
                  <TableCell className="text-right">{p.away_games ?? 0}</TableCell>
                  <TableCell className="text-right">{p.home_points ?? 0}</TableCell>
                  <TableCell className="text-right">{p.away_points ?? 0}</TableCell>
                  <TableCell className="text-right">{p.average_points_home == null ? "—" : p.average_points_home.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{p.average_points_away == null ? "—" : p.average_points_away.toFixed(2)}</TableCell>
                  <TableCell>{p.owner_team || "Free Agent"}</TableCell>
                  <TableCell className="text-right">{AVAILABILITY_LABELS[String(p.availability || "")] || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
