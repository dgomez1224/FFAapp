import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import PlayerStatsTable from "../components/PlayerStatsTable";
import { PlayerStats, PlayerStatsModal } from "../components/PlayerStatsModal";

type Payload = {
  type: "cup" | "league";
  gameweek: number;
  current_gameweek: number;
  has_started: boolean;
  total_points: number;
  opponents_by_gw?: Record<string, string>;
  status?: string;
  status_message?: string;
  team: {
    id: string;
    entry_name: string | null;
    manager_name: string | null;
  };
  lineup: Array<{
    player_id: number;
    player_name: string;
    web_name?: string | null;
    player_image_url?: string | null;
    position: number;
    is_captain: boolean;
    is_vice_captain: boolean;
    is_cup_captain: boolean;
    raw_points: number;
    multiplier: number;
    effective_points: number;
    goals_scored?: number;
    assists?: number;
    minutes?: number;
  }>;
};

export default function LineupDetailPage() {
  const { type, gameweek, teamId } = useParams<{ type: "cup" | "league"; gameweek: string; teamId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [livePoints, setLivePoints] = useState<Record<number, number>>({});
  const [liveStats, setLiveStats] = useState<Record<number, any>>({});

  useEffect(() => {
    async function load() {
      if (!type || !gameweek || !teamId) return;
      try {
        setLoading(true);
        setError(null);
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/lineup?team=${encodeURIComponent(teamId)}&gameweek=${encodeURIComponent(gameweek)}&type=${encodeURIComponent(type)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to fetch lineup");
        }
        setData(payload);

        try {
          const gwNum = Number(gameweek);
          const liveRes = await fetch(
            `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/api/live?event=${gwNum}`,
            { headers: getSupabaseFunctionHeaders() as HeadersInit }
          );
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            const pts: Record<number, number> = {};
            const stats: Record<number, any> = {};
            const elementsObj = liveData?.elements ?? {};
            Object.entries(elementsObj).forEach(([key, el]: [string, any]) => {
              const id = Number(key);
              if (!id) return;
              pts[id] = el?.stats?.total_points ?? 0;
              if (el?.stats) stats[id] = el.stats;
            });
            setLivePoints(pts);
            setLiveStats(stats);
          }
        } catch {
          // non-fatal
        }
      } catch (err: any) {
        setError(err?.message || "Failed to fetch lineup");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [type, gameweek, teamId]);

  const handlePlayerClick = async (player: PitchPlayer) => {
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-history?player_id=${encodeURIComponent(String(player.player_id))}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload = await res.json();
      if (!res.ok || payload?.error) throw new Error("Failed to fetch player history");
      const s = liveStats[player.player_id];
      const pos = player.position;
      const livePts = livePoints[player.player_id] ?? player.raw_points ?? 0;
      const mult = player.multiplier ?? 1;
      setSelectedPlayer({
        player_id: player.player_id,
        player_name: player.player_name,
        position: pos,
        raw_points: livePts,
        effective_points: Math.round(livePts * mult),
        is_captain: player.is_captain,
        is_vice_captain: player.is_vice_captain,
        is_cup_captain: player.is_cup_captain,
        multiplier: player.multiplier,
        goals_scored: s?.goals_scored ?? 0,
        assists: s?.assists ?? 0,
        minutes: s?.minutes ?? 0,
        bonus: s?.bonus ?? 0,
        // Position exclusions for modal: GK hide DefCon; DEF/MID hide saves; FWD hide clean_sheets
        defensive_contributions: pos !== 1 ? (s?.defensive_contribution ?? 0) : undefined,
        clean_sheets: pos !== 4 ? (s?.clean_sheets ?? 0) : undefined,
        saves: pos === 1 ? (s?.saves ?? 0) : undefined,
        yellow_cards: s?.yellow_cards ?? 0,
        red_cards: s?.red_cards ?? 0,
        goals_conceded: s?.goals_conceded ?? 0,
        penalties_saved: s?.penalties_saved ?? 0,
        penalties_missed: s?.penalties_missed ?? 0,
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
      setSelectedPlayer({ ...player, history: [] });
    }
  };

  if (loading) return <Card className="p-6"><p className="text-sm text-muted-foreground">Loading lineup...</p></Card>;
  if (error || !data) return <Card className="p-6"><p className="text-sm text-destructive">{error || "Failed to load lineup"}</p></Card>;

  const players: PitchPlayer[] = data.lineup.map((p) => ({ ...p }));
  const gwNum = data.gameweek;
  const isCup = data.type === "cup";
  const opponentsByGw = data.opponents_by_gw || {};
  let gwKeys = Object.keys(opponentsByGw)
    .map((g) => Number(g))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const isCupGroupStage = isCup && gwNum >= 29 && gwNum <= 32;
  if (isCupGroupStage && gwKeys.length === 0) {
    // Fallback: treat the first four cup gameweeks as 29–32 even if
    // we don't have explicit opponents yet, so lineup navigation works.
    gwKeys = [29, 30, 31, 32];
  }
  const currentIdx = gwKeys.indexOf(gwNum);
  const prevGw = currentIdx > 0 ? gwKeys[currentIdx - 1] : undefined;
  const nextGw = currentIdx >= 0 && currentIdx + 1 < gwKeys.length ? gwKeys[currentIdx + 1] : undefined;
  const opponentThisGw = opponentsByGw[String(gwNum)];

  const goToLineupGw = (targetGw: number | undefined) => {
    if (!targetGw || !type || !teamId) return;
    navigate(`/lineup/${type}/${targetGw}/${teamId}`);
  };

  const goToMatchupGw = (targetGw: number) => {
    if (!type || !teamId) return;
    const opp = opponentsByGw[String(targetGw)];
    if (!opp) return;
    navigate(`/matchup/${type}/${targetGw}/${teamId}/${opp}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/manager/${String(data.team.manager_name || "").toLowerCase()}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to manager
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          {data.team.manager_name || "Manager"} • GW {data.gameweek} {data.type === "cup" ? "Cup" : "League"} Lineup
        </h1>
        {isCup && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium">Cup nav:</span>
            <button
              type="button"
              onClick={() => goToLineupGw(prevGw)}
              disabled={!prevGw}
              className="px-2 py-0.5 rounded border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev GW
            </button>
            <button
              type="button"
              onClick={() => goToLineupGw(nextGw)}
              disabled={!nextGw}
              className="px-2 py-0.5 rounded border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next GW →
            </button>
            {!isCupGroupStage && gwKeys.length > 0 && (
              <select
                value={gwNum}
                onChange={(e) => goToLineupGw(Number(e.target.value))}
                className="rounded border px-1.5 py-0.5 bg-background"
              >
                {gwKeys.map((g) => (
                  <option key={g} value={g}>
                    GW {g}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => goToMatchupGw(gwNum)}
              disabled={!opponentThisGw}
              className="ml-auto text-[11px] text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              View matchup vs opponent in GW {gwNum}
            </button>
          </div>
        )}
      </div>

      <Card className="p-6">
        <div className="mb-3">
          <p className="text-sm text-muted-foreground">{data.team.entry_name || "Team"}</p>
          {data.lineup.length === 0 && data.status === "none" ? (
            <p className="text-lg font-semibold">None scheduled / not started</p>
          ) : (
            <p className="text-lg font-semibold">Total Points: {Number(data.total_points || 0).toFixed(1)}</p>
          )}
        </div>
        {data.lineup.length === 0 && data.status === "none" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Not started / none scheduled for this gameweek.
          </p>
        ) : (
          <>
            <FootballPitch players={players} onPlayerClick={handlePlayerClick} showCaptain={true} />
            <PlayerStatsTable
              players={(data.lineup || []).map((p) => ({
                id: p.player_id,
                name: p.player_name,
                image_url: p.player_image_url,
                position: p.position,
              }))}
              livePoints={livePoints}
              liveStats={liveStats}
              captainId={(data.lineup.find((p) => p.is_cup_captain || p.is_captain))?.player_id ?? null}
              gameweek={data.gameweek}
            />
          </>
        )}
      </Card>

      <PlayerStatsModal
        player={selectedPlayer!}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        showHistory={true}
      />
    </div>
  );
}
