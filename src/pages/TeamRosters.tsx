/**
 * Team Rosters — all 20 managers with collapsible latest squads.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import { DivisionBadge } from "../components/DivisionBadge";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { useCurrentGameweek } from "../lib/useCurrentGameweek";
import { useManagerCrestMap } from "../lib/useManagerCrestMap";
import {
  CANONICAL_MANAGERS,
  getManagerDivision,
  normalizeManagerName,
} from "../lib/canonicalManagers";
import {
  DIVISION_ONE_MANAGERS,
  DIVISION_TWO_MANAGERS,
  getManagerEntryId,
  getDivisionLabel,
  type Division,
} from "../lib/divisions";
import type { Standing } from "../lib/useDivisionStandings";

type LineupPlayer = PitchPlayer & {
  is_bench?: boolean;
  is_auto_subbed_on?: boolean;
  is_auto_subbed_off?: boolean;
};

type RosterPayload = {
  gameweek: number;
  total_points: number;
  team: {
    id: string;
    entry_name: string | null;
    manager_name: string | null;
  };
  lineup: LineupPlayer[];
};

type ManagerRosterRow = {
  manager_name: string;
  division: Division;
  team_id: string | null;
  entry_id: string | null;
  entry_name: string;
  season_points: number;
  league_points: number;
  rank: number | null;
};

async function fetchDivisionStandings(division: Division): Promise<Standing[]> {
  const params = new URLSearchParams({ division });
  const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/h2h-standings?${params}`;
  const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
  const payload = await res.json();
  if (!res.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Failed to load ${division} standings`);
  }
  return Array.isArray(payload?.standings) ? payload.standings : [];
}

function RosterBody({
  row,
  gameweek,
}: {
  row: ManagerRosterRow;
  gameweek: number;
}) {
  const [data, setData] = useState<RosterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const teamKey = row.team_id || row.entry_id;
      if (!teamKey || !gameweek) {
        setLoading(false);
        setError("No team id available for this manager.");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          team: String(teamKey),
          gameweek: String(gameweek),
          type: "league",
        });
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/lineup?${params}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load roster");
        }
        if (!cancelled) setData(payload);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load roster");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [row.team_id, row.entry_id, gameweek]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading latest roster…</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-destructive">{error || "Failed to load roster"}</p>;
  }

  const starters = (data.lineup || []).filter((p) => !p.is_bench && !p.is_auto_subbed_off);
  const bench = (data.lineup || []).filter((p) => p.is_bench || p.is_auto_subbed_off);
  const pitchPlayers: PitchPlayer[] = starters.map((p) => ({ ...p }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          {row.entry_name || data.team.entry_name} · GW {data.gameweek} league squad
        </p>
        <p className="font-semibold tabular-nums">
          GW points: {Number(data.total_points || 0).toFixed(1)}
        </p>
      </div>
      {pitchPlayers.length ? (
        <FootballPitch players={pitchPlayers} showCaptain={true} />
      ) : (
        <p className="text-sm text-muted-foreground">No squad returned for this gameweek.</p>
      )}
      {bench.length ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bench</p>
          <p className="text-sm">
            {bench.map((p) => p.web_name || p.player_name).join(" · ")}
          </p>
        </div>
      ) : null}
      {starters.length ? (
        <p className="text-xs text-muted-foreground">
          Starting XI: {starters.map((p) => p.web_name || p.player_name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function DivisionRosterList({
  title,
  rows,
  gameweek,
  getCrest,
}: {
  title: string;
  rows: ManagerRosterRow[];
  gameweek: number;
  getCrest: (name?: string | null) => string | null;
}) {
  const [openId, setOpenId] = useState<string>("");

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Card className="p-2 sm:p-4">
        <Accordion type="single" collapsible value={openId} onValueChange={setOpenId}>
          {rows.map((row) => {
            const crest = getCrest(row.manager_name);
            return (
              <AccordionItem key={row.manager_name} value={row.manager_name}>
                <AccordionTrigger className="px-2 hover:no-underline sm:px-3">
                  <div className="flex w-full items-center gap-3 pr-2">
                    {crest ? (
                      <img
                        src={crest}
                        alt=""
                        className="h-8 w-8 rounded-full border object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted text-[10px] font-bold">
                        {row.manager_name.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-wide">{row.manager_name}</span>
                        <DivisionBadge division={row.division} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.entry_name}
                        {row.rank != null ? ` · ${row.rank}${row.rank === 1 ? "st" : row.rank === 2 ? "nd" : row.rank === 3 ? "rd" : "th"}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold tabular-nums">{row.season_points}</div>
                      <div className="text-[11px] text-muted-foreground">season pts</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-2 sm:px-3">
                  {openId === row.manager_name ? (
                    <RosterBody row={row} gameweek={gameweek} />
                  ) : null}
                  <div className="mt-3 text-xs">
                    <Link
                      to={`/manager/${row.manager_name.toLowerCase()}`}
                      className="text-primary hover:underline"
                    >
                      Open manager profile →
                    </Link>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Card>
    </section>
  );
}

export default function TeamRostersPage() {
  const { currentGameweek, loading: gwLoading } = useCurrentGameweek();
  const { getCrest } = useManagerCrestMap();
  const [rows, setRows] = useState<ManagerRosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [d1, d2] = await Promise.all([
        fetchDivisionStandings("division_one"),
        fetchDivisionStandings("division_two"),
      ]);
      const byName: Record<string, Standing> = {};
      [...d1, ...d2].forEach((s) => {
        const name = normalizeManagerName(s.manager_name);
        if (name) byName[name] = s;
      });

      const next = CANONICAL_MANAGERS.map((name) => {
        const standing = byName[name];
        const division = getManagerDivision(name) || "division_one";
        return {
          manager_name: name,
          division,
          team_id: standing?.team_id ? String(standing.team_id) : null,
          entry_id: standing?.entry_id ? String(standing.entry_id) : getManagerEntryId(name),
          entry_name: standing?.entry_name || name,
          season_points: Number(standing?.points_for || 0),
          league_points: Number(standing?.points || 0),
          rank: standing?.rank ?? null,
        };
      });
      setRows(next);
    } catch (err: any) {
      setError(err?.message || "Failed to load team rosters");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const sortRows = (names: readonly string[]) =>
      names
        .map((name) => rows.find((r) => r.manager_name === name))
        .filter((r): r is ManagerRosterRow => !!r)
        .sort((a, b) => b.season_points - a.season_points || a.manager_name.localeCompare(b.manager_name));
    return {
      division_one: sortRows(DIVISION_ONE_MANAGERS),
      division_two: sortRows(DIVISION_TWO_MANAGERS),
    };
  }, [rows]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">Team Rosters</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          All 20 managers. Expand a row for the latest league squad and season points scored.
          {currentGameweek ? ` Showing GW ${currentGameweek} lineups.` : ""}
        </p>
      </div>

      {loading || gwLoading ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Loading managers…</p>
        </Card>
      ) : error ? (
        <Card className="p-6">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      ) : (
        <>
          <DivisionRosterList
            title={getDivisionLabel("division_one")}
            rows={grouped.division_one}
            gameweek={currentGameweek}
            getCrest={getCrest}
          />
          <DivisionRosterList
            title={getDivisionLabel("division_two")}
            rows={grouped.division_two}
            gameweek={currentGameweek}
            getCrest={getCrest}
          />
        </>
      )}
    </div>
  );
}
