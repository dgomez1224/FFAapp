import React, { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";

interface PotmRow {
  player_id: number;
  player_name: string;
  manager_name: string;
  team_name?: string | null;
  total_points: number;
  bonus: number;
  player_image_url?: string | null;
}

interface FixtureRow {
  season: string;
  gameweek: number;
  team_1: {
    manager_name: string;
    team_name: string | null;
    entry_id?: string | null;
    points: number;
  };
  team_2: {
    manager_name: string;
    team_name: string | null;
    entry_id?: string | null;
    points: number;
  };
  potm: PotmRow[];
}

interface Payload {
  season: string;
  gameweek: number;
  fixtures: FixtureRow[];
}

export function PreviousWeekResults() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/league-activity/previous-week-results`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load previous week results");
        }
        setData(payload);
      } catch (err: any) {
        setError(err?.message || "Failed to load previous week results");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">Last Week&apos;s Results</h2>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }

  if (error || !data || !data.fixtures?.length) {
    return (
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-2">Last Week&apos;s Results</h2>
        <p className="text-sm text-muted-foreground">
          {error ? error : "No completed fixtures from last week yet."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-1">Last Week&apos;s Results</h2>
      <p className="text-xs text-muted-foreground mb-3">
        League fixtures and Player of the Match for GW {data.gameweek}.
      </p>
      <div className="fpl-table-container">
        <Table>
          <TableHeader>
            <TableRow className="fpl-table-header">
              <TableHead>Team 1</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead>Team 2</TableHead>
              <TableHead className="flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" />
                <span>POTM</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.fixtures.map((f) => {
              const team1Label = f.team_1.team_name || f.team_1.manager_name;
              const team2Label = f.team_2.team_name || f.team_2.manager_name;
              const scoreLabel = `${Math.round(f.team_1.points)} – ${Math.round(f.team_2.points)}`;
              return (
                <TableRow
                  key={`${f.team_1.manager_name}-${f.team_2.manager_name}`}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() =>
                    navigate(
                      `/matchup/league/${f.gameweek}/${encodeURIComponent(
                        String(f.team_1.entry_id || ""),
                      )}/${encodeURIComponent(String(f.team_2.entry_id || ""))}`,
                    )
                  }
                >
                  <TableCell className="align-top">
                    <div className="text-sm font-medium">{team1Label}</div>
                  </TableCell>
                  <TableCell className="text-center align-top text-sm font-semibold whitespace-nowrap">
                    {scoreLabel}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="text-sm font-medium">{team2Label}</div>
                  </TableCell>
                  <TableCell className="align-top text-xs text-muted-foreground">
                    {f.potm && f.potm.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {f.potm.map((p) => (
                          <div key={`${p.player_id}-${p.manager_name}`} className="flex items-center gap-2">
                            {p.player_image_url ? (
                              <img
                                src={p.player_image_url}
                                alt={p.player_name}
                                className="h-6 w-6 rounded-full border object-cover"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full border bg-muted flex items-center justify-center text-[10px]">
                                {p.player_name.charAt(0)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-[11px] font-medium">
                                {p.player_name} ({p.total_points} pts) / {p.team_name || p.manager_name}
                              </span>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px]">
                                {p.goals_scored ? <span>⚽{xOrOne(p.goals_scored)}</span> : null}
                                {p.assists ? <span>👟{xOrOne(p.assists)}</span> : null}
                                {p.clean_sheets ? <span>🛡️</span> : null}
                                {p.defensive_return ? <span>🔒</span> : null}
                                {p.penalties_saved ? <span>🧤{xOrOne(p.penalties_saved)}</span> : null}
                                {p.saves ? <span>🧤{xOrOne(p.saves)}</span> : null}
                                {p.bonus ? (
                                  <span className="text-emerald-600 font-semibold">+{p.bonus}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function xOrOne(value?: number) {
  const n = Number(value || 0);
  if (!n || n === 1) return "";
  return `×${n}`;
}

