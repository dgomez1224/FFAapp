import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import PlayerStatsTable from "../components/PlayerStatsTable";
import { PlayerStats, PlayerStatsModal } from "../components/PlayerStatsModal";

type Payload = {
  type: "cup" | "league";
  gameweek: number;
  has_started: boolean;
  total_points: number;
  team: {
    id: string;
    entry_name: string | null;
    manager_name: string | null;
  };
  lineup: Array<{
    player_id: number;
    player_name: string;
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
      setSelectedPlayer({
        player_id: player.player_id,
        player_name: player.player_name,
        position: pos,
        raw_points: livePts,
        effective_points: player.is_captain ? livePts * 2 : livePts,
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

  return (
    <div className="space-y-4">
      <div>
        <Link to={`/manager/${String(data.team.manager_name || "").toLowerCase()}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to manager
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          {data.team.manager_name || "Manager"} • GW {data.gameweek} {data.type === "cup" ? "Cup" : "League"} Lineup
        </h1>
      </div>

      <Card className="p-6">
        <div className="mb-3">
          <p className="text-sm text-muted-foreground">{data.team.entry_name || "Team"}</p>
          <p className="text-lg font-semibold">Total Points: {Number(data.total_points || 0).toFixed(1)}</p>
        </div>
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
