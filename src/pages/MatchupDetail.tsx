import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";
import PlayerStatsTable from "../components/PlayerStatsTable";
import { PlayerStatsModal, PlayerStats } from "../components/PlayerStatsModal";

type LineupPlayer = {
  player_id: number;
  player_name: string;
  player_image_url?: string | null;
  position: number;
  lineup_slot?: number | null;
  is_bench?: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_cup_captain: boolean;
  raw_points: number;
  multiplier: number;
  effective_points: number;
  goals_scored: number;
  assists: number;
  minutes: number;
  defensive_contributions: number;
  clean_sheets: number;
  goals_conceded: number;
  yellow_cards: number;
  red_cards: number;
  penalties_missed: number;
  penalties_saved: number;
  is_auto_subbed_off?: boolean;
  is_auto_subbed_on?: boolean;
  subbed_on_by?: number;
  subbed_off_for?: number;
};

type TeamDetail = {
  id: string;
  manager_name: string;
  entry_name: string;
  club_crest_url?: string | null;
  rank: number | null;
  total_points: number;
  lineup: LineupPlayer[];
  auto_subs?: Array<{
    player_off_id: number;
    player_off_name: string;
    player_on_id: number;
    player_on_name: string;
  }>;
};

type Payload = {
  type: "league" | "cup";
  gameweek: number;
  current_gameweek: number;
  matchup: {
    team_1_points: number | null;
    team_2_points: number | null;
    live_team_1_points: number;
    live_team_2_points: number;
    round: string | null;
    matchup_id: string | null;
    has_started?: boolean;
  };
  team_1: TeamDetail;
  team_2: TeamDetail;
  team_1_opponents_by_gw?: Record<string, string>;
  team_2_opponents_by_gw?: Record<string, string>;
};

function GwNav({
  label,
  gw,
  minGw,
  maxGw,
  onChange,
}: {
  label: string;
  gw: number;
  minGw: number;
  maxGw: number;
  onChange: (gw: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-1 py-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(gw - 1)}
          disabled={gw <= minGw}
          className="px-2 py-0.5 text-sm rounded border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ←
        </button>
        <select
          value={gw}
          onChange={(e) => onChange(Number(e.target.value))}
          className="text-xs rounded border px-1 py-0.5 bg-background"
        >
          {Array.from({ length: maxGw - minGw + 1 }, (_, i) => minGw + i).map((g) => (
            <option key={g} value={g}>
              GW {g}
            </option>
          ))}
        </select>
        <button
          onClick={() => onChange(gw + 1)}
          disabled={gw >= maxGw}
          className="px-2 py-0.5 text-sm rounded border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>
    </div>
  );
}

function ViewMatchupLink({
  type,
  gw,
  teamId,
  opponentsByGw,
}: {
  type: "league" | "cup";
  gw: number;
  teamId: string;
  opponentsByGw?: Record<string, string>;
}) {
  const navigate = useNavigate();
  const entries = Object.entries(opponentsByGw || {});
  const gameweeks = entries
    .map(([g]) => Number(g))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const currentIdx = gameweeks.indexOf(gw);
  const prevGw = currentIdx > 0 ? gameweeks[currentIdx - 1] : undefined;
  const nextGw = currentIdx >= 0 && currentIdx + 1 < gameweeks.length ? gameweeks[currentIdx + 1] : undefined;
  const opponentId = opponentsByGw?.[String(gw)];
  const disabled = !opponentId;

  const goTo = (targetGw: number | undefined) => {
    if (!targetGw) return;
    const opp = opponentsByGw?.[String(targetGw)];
    if (!opp) return;
    navigate(`/matchup/${type}/${targetGw}/${teamId}/${opp}`);
  };

  return (
    <div className="px-1 pb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goTo(prevGw)}
            disabled={!prevGw}
            className="px-1.5 py-0.5 text-[11px] rounded border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev GW
          </button>
          <button
            type="button"
            onClick={() => goTo(nextGw)}
            disabled={!nextGw}
            className="px-1.5 py-0.5 text-[11px] rounded border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next GW →
          </button>
        </div>
        <button
          type="button"
          onClick={() => goTo(gw)}
          disabled={disabled}
          className="text-xs text-primary hover:underline font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          View matchup vs opponent in GW {gw} →
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        Use the arrows to jump to this manager’s previous/next fixture, or the link to open this gameweek’s matchup.
      </p>
    </div>
  );
}

function TeamPitchDisplay({
  team,
  matchupType,
  showGameweekStats = true,
  gameweek,
  livePoints,
  liveStats,
}: {
  team: TeamDetail;
  matchupType: "league" | "cup";
  showGameweekStats?: boolean;
  gameweek: number;
  livePoints: Record<number, number>;
  liveStats: Record<number, any>;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  const starters = team.lineup
    .filter((p) => !p.is_bench)
    .sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99));
  const bench = team.lineup
    .filter((p) => !!p.is_bench)
    .sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99));

  const subbedOff = team.lineup.filter((p) => p.is_auto_subbed_off);

  const pitchPlayers: PitchPlayer[] = starters.map((p) => ({
    player_id: p.player_id,
    player_name: p.player_name,
    player_image_url: p.player_image_url || null,
    position: p.position,
    raw_points: p.raw_points,
    effective_points: p.effective_points,
    is_captain: p.is_captain,
    is_vice_captain: p.is_vice_captain,
    is_cup_captain: p.is_cup_captain,
    multiplier: p.multiplier,
    goals_scored: p.goals_scored,
    assists: p.assists,
    minutes: p.minutes,
    is_auto_subbed_on: p.is_auto_subbed_on,
  }));

  const handlePlayerClick = async (player: PitchPlayer) => {
    const fullPlayer = team.lineup.find((p) => p.player_id === player.player_id);
    if (!fullPlayer) return;

    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-history?player_id=${encodeURIComponent(String(player.player_id))}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
      const payload = await res.json();
      if (!res.ok || payload?.error) {
        throw new Error(payload?.error?.message || "Failed to fetch player history");
      }

      setSelectedPlayer({
        ...fullPlayer,
        player_image_url: fullPlayer.player_image_url ?? null,
        position: fullPlayer.position,
        history: (payload.history || []).map((h: any) => ({
          gameweek: h.gameweek,
          points: h.points ?? 0,
          goals: h.goals ?? 0,
          assists: h.assists ?? 0,
          minutes: h.minutes ?? 0,
          clean_sheets: h.clean_sheets ?? 0,
          goals_conceded: h.goals_conceded ?? 0,
          penalties_saved: h.penalties_saved ?? 0,
          penalties_missed: h.penalties_missed ?? 0,
          fixture_difficulty: h.fixture_difficulty ?? null,
          is_upcoming: !!h.is_upcoming,
          opponent_team_name: h.opponent_team_name ?? null,
          was_home: h.was_home,
          fixture: h.fixture ?? null,
          result: h.result ?? null,
          kickoff_time: h.kickoff_time ?? null,
        })),
      });
    } catch {
      setSelectedPlayer({
        ...fullPlayer,
        position: fullPlayer.position,
        history: [],
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          {team.rank != null ? `#${team.rank} ` : ""}
          <span className="inline-flex items-center gap-2">
            {team.club_crest_url ? <img src={team.club_crest_url} alt="" className="h-5 w-5 rounded object-cover border" /> : null}
            {team.manager_name}
          </span>
        </h3>
        <p className="text-sm text-muted-foreground">{team.entry_name}</p>
      </div>

      <div className="mb-4">
        <FootballPitch players={pitchPlayers} onPlayerClick={handlePlayerClick} showCaptain={true} />
      </div>

      {subbedOff.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground mr-1">↓ Off:</span>
          {subbedOff.map((p) => {
            const subOn = team.lineup.find((s) => s.player_id === p.subbed_on_by);
            return (
              <div
                key={p.player_id}
                className="relative opacity-50"
                title={`${p.player_name} subbed off → ${subOn?.player_name ?? "?"}`}
              >
                <div className="relative h-8 w-8 rounded-full overflow-hidden border border-muted">
                  {p.player_image_url ? (
                    <img
                      src={p.player_image_url}
                      alt={p.player_name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="h-full w-full bg-muted flex items-center justify-center text-xs">
                      {p.player_name.charAt(0)}
                    </div>
                  )}
                </div>
                <span className="absolute -bottom-1 -right-1 text-xs">↓</span>
              </div>
            );
          })}
        </div>
      )}

      <PlayerStatsTable
        players={(team.lineup || []).map((p) => ({
          id: p.player_id,
          name: p.player_name,
          image_url: p.player_image_url ?? null,
          position: p.position,
          is_auto_subbed_off: p.is_auto_subbed_off,
          is_auto_subbed_on: p.is_auto_subbed_on,
          subbed_on_by: p.subbed_on_by,
          subbed_off_for: p.subbed_off_for,
        }))}
        livePoints={livePoints}
        liveStats={liveStats}
        captainId={team.lineup.find((p) => p.is_cup_captain || p.is_captain)?.player_id ?? null}
        viceCaptainId={team.lineup.find((p) => p.is_vice_captain)?.player_id ?? null}
        gameweek={gameweek}
        autoSubs={team.auto_subs ?? []}
      />

      <PlayerStatsModal
        player={selectedPlayer!}
        isOpen={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        showHistory={true}
        showGameweekStats={showGameweekStats}
        showEffectivePoints={matchupType === "cup"}
      />

      {/* Substitute/Bench info */}
      {starters.length > 0 && (
        <div className="mt-4 text-sm space-y-2">
          <p className="text-muted-foreground">
            {starters.filter((p) => p.position === 1).length} GK • {starters.filter((p) => p.position === 2).length} DEF •{" "}
            {starters.filter((p) => p.position === 3).length} MID • {starters.filter((p) => p.position === 4).length} FWD
          </p>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Bench</p>
            {bench.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {bench.map((p) => (
                  <button
                    key={`${p.player_id}-bench`}
                    onClick={() =>
                      handlePlayerClick({
                        player_id: p.player_id,
                        player_name: p.player_name,
                        position: p.position,
                        raw_points: p.raw_points,
                        effective_points: p.effective_points,
                        is_captain: p.is_captain,
                        is_vice_captain: p.is_vice_captain,
                        is_cup_captain: p.is_cup_captain,
                        multiplier: p.multiplier,
                        goals_scored: p.goals_scored,
                        assists: p.assists,
                        minutes: p.minutes,
                      })
                    }
                    className="rounded border px-2 py-1 text-xs hover:bg-muted"
                  >
                    {p.player_name} ({Math.round(p.effective_points)})
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No bench data</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function MatchupDetailPage() {
  const navigate = useNavigate();
  const { type, gameweek, team1, team2 } = useParams<{ type: "league" | "cup"; gameweek: string; team1: string; team2: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [livePoints, setLivePoints] = useState<Record<number, number>>({});
  const [liveStats, setLiveStats] = useState<Record<number, any>>({});
  const [gw1, setGw1] = useState<number>(Number(gameweek) || 1);
  const [gw2, setGw2] = useState<number>(Number(gameweek) || 1);
  const [team1Data, setTeam1Data] = useState<TeamDetail | null>(null);
  const [team2Data, setTeam2Data] = useState<TeamDetail | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: number | null = null;

    async function load(silent = false): Promise<boolean> {
      if (!type || !gameweek || !team1 || !team2) return false;

      let shouldPoll = false;
      try {
        const gwRes = await fetch(
          `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/current-gameweek`,
          { headers: getSupabaseFunctionHeaders() as HeadersInit }
        );
        const gwData = gwRes.ok ? await gwRes.json() : null;
        const currentGw = gwData?.current_gameweek ?? 0;
        const eventFinished =
          gwData?.current_event_finished === true || gwData?.event_finished === true;
        shouldPoll = Number(gameweek) === currentGw && !eventFinished;
      } catch {
        shouldPoll = false;
      }

      try {
        if (!silent) {
          setLoading(true);
          setError(null);
        }
        const params = new URLSearchParams({
          type,
          gameweek,
          team1,
          team2,
        });
        const matchupId = searchParams.get("matchupId");
        if (matchupId) params.set("matchupId", matchupId);

        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/matchup?${params.toString()}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load matchup detail");
        }
        if (!mounted) return false;
        setData(payload);
        setTeam1Data(payload.team_1);
        setTeam2Data(payload.team_2);
        setLastUpdated(Date.now());

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
        if (!mounted) return false;
        if (!silent) {
          setError(err.message || "Failed to load matchup detail");
        }
      } finally {
        if (!mounted) return false;
        if (!silent) {
          setLoading(false);
        }
      }
      return shouldPoll;
    }

    load(false).then((isActive) => {
      if (!isActive) return;
      timer = window.setInterval(() => {
        load(true);
      }, 10000);
    });

    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, [type, gameweek, team1, team2, searchParams]);

  // Sync per-team GW from URL when route gameweek changes
  useEffect(() => {
    const gw = Number(gameweek) || 1;
    setGw1(gw);
    setGw2(gw);
  }, [gameweek]);

  const fetchTeamLineup = async (
    teamId: string,
    gw: number,
    setTeamData: React.Dispatch<React.SetStateAction<TeamDetail | null>>
  ) => {
    if (!type) return;
    try {
      const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures/lineup?team=${encodeURIComponent(teamId)}&gameweek=${gw}&type=${type}`;
      const res = await fetch(url, { headers: getSupabaseFunctionHeaders() as HeadersInit });
      if (res.ok) {
        const payload = await res.json();
        setTeamData((prev) =>
          prev ? { ...prev, lineup: (payload.lineup ?? []) as LineupPlayer[] } : prev
        );
      }
    } catch {
      /* non-fatal */
    }
  };

  useEffect(() => {
    if (!team1 || !type || gw1 === Number(gameweek)) return;
    if (data?.team_1) {
      fetchTeamLineup(team1, gw1, setTeam1Data);
    }
  }, [gw1, team1, type, gameweek, data?.team_1]);

  useEffect(() => {
    if (!team2 || !type || gw2 === Number(gameweek)) return;
    if (data?.team_2) {
      fetchTeamLineup(team2, gw2, setTeam2Data);
    }
  }, [gw2, team2, type, gameweek, data?.team_2]);

  if (loading) return <Card className="p-6"><p className="text-sm text-muted-foreground">Loading matchup…</p></Card>;
  if (error || !data) return <Card className="p-6"><p className="text-sm text-destructive">{error || "Failed to load matchup"}</p></Card>;

  const currentGwNum = Number(gameweek);
  const minGw = data.type === "cup" ? 29 : 1;
  const maxGw = data.current_gameweek ?? currentGwNum;
  const isCupGroupStage = data.type === "cup" && currentGwNum >= 29 && currentGwNum <= 32;
  const goToGw = (gw: number) => {
    if (gw < minGw || gw > maxGw) return;
    setGw1(gw);
    setGw2(gw);
    navigate(`/matchup/${type}/${gw}/${team1}/${team2}`);
  };

  const leagueLiveTeam1 = (data.team_1.lineup || []).reduce(
    (sum, player) => sum + (player.is_bench ? 0 : Number(player.effective_points || 0)),
    0,
  );
  const leagueLiveTeam2 = (data.team_2.lineup || []).reduce(
    (sum, player) => sum + (player.is_bench ? 0 : Number(player.effective_points || 0)),
    0,
  );
  const team1Points = data.type === "league" ? leagueLiveTeam1 : (data.matchup.team_1_points ?? data.matchup.live_team_1_points);
  const team2Points = data.type === "league" ? leagueLiveTeam2 : (data.matchup.team_2_points ?? data.matchup.live_team_2_points);
  const team1Score = Math.round(team1Points);
  const team2Score = Math.round(team2Points);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <Link to="/fixtures" className="text-sm text-muted-foreground hover:underline">
            ← Back to Fixtures
          </Link>

          {/* Shared GW Navigation (updates both teams and URL) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToGw(currentGwNum - 1)}
              disabled={currentGwNum <= minGw}
              className="px-2 py-1 text-sm rounded border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous gameweek"
            >
              ←
            </button>
            <select
              value={currentGwNum}
              onChange={(e) => goToGw(Number(e.target.value))}
              className="text-sm rounded border px-2 py-1 bg-background"
            >
              {Array.from({ length: maxGw - minGw + 1 }, (_, i) => minGw + i).map((gw) => (
                <option key={gw} value={gw}>GW {gw}</option>
              ))}
            </select>
            <button
              onClick={() => goToGw(currentGwNum + 1)}
              disabled={currentGwNum >= maxGw}
              className="px-2 py-1 text-sm rounded border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next gameweek"
            >
              →
            </button>
          </div>
        </div>

        <h1 className="text-3xl font-bold mt-2">{data.type === "cup" ? "Cup Matchup" : "League Matchup"} • GW {data.gameweek}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Live updates every 10s{lastUpdated ? ` • Last refresh ${new Date(lastUpdated).toLocaleTimeString()}` : ""}
        </p>
        {(data.type === "league" || !isCupGroupStage) && (
          <p className="mt-2 text-xs text-muted-foreground max-w-2xl">
            Each manager’s dropdown changes <strong>which lineup is shown</strong> for that side only. Use <strong>«View matchup vs opponent in GW X»</strong> below to jump to that manager’s actual fixture that gameweek (according to the schedule).
          </p>
        )}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div className="text-right">
            <p className="font-semibold inline-flex items-center gap-2 justify-end">
              {data.team_1.club_crest_url ? (
                <img
                  src={data.team_1.club_crest_url}
                  alt=""
                  className="h-5 w-5 rounded object-cover border"
                />
              ) : null}
              {data.team_1.manager_name}
            </p>
            <p className="text-sm text-muted-foreground">{data.team_1.entry_name}</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">
              {team1Score} - {team2Score}
            </p>
            {data.matchup.round && <p className="text-xs text-muted-foreground mt-1">{data.matchup.round}</p>}
          </div>
          <div>
            <p className="font-semibold inline-flex items-center gap-2">
              {data.team_2.club_crest_url ? (
                <img
                  src={data.team_2.club_crest_url}
                  alt=""
                  className="h-5 w-5 rounded object-cover border"
                />
              ) : null}
              {data.team_2.manager_name}
            </p>
            <p className="text-sm text-muted-foreground">{data.team_2.entry_name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          {data.type === "league" || !isCupGroupStage ? (
            <GwNav
              label={data.team_1.manager_name}
              gw={gw1}
              minGw={minGw}
              maxGw={maxGw}
              onChange={setGw1}
            />
          ) : null}
          <ViewMatchupLink type={data.type} gw={gw1} teamId={team1!} opponentsByGw={data.team_1_opponents_by_gw} />
          <TeamPitchDisplay
            team={gw1 === Number(gameweek) ? data.team_1 : (team1Data ?? data.team_1)}
            matchupType={data.type}
            showGameweekStats={gw1 <= data.current_gameweek || !!data.matchup?.has_started}
            gameweek={gw1}
            livePoints={livePoints}
            liveStats={liveStats}
          />
        </div>
        <div>
          {data.type === "league" || !isCupGroupStage ? (
            <GwNav
              label={data.team_2.manager_name}
              gw={gw2}
              minGw={minGw}
              maxGw={maxGw}
              onChange={setGw2}
            />
          ) : null}
          <ViewMatchupLink type={data.type} gw={gw2} teamId={team2!} opponentsByGw={data.team_2_opponents_by_gw} />
          <TeamPitchDisplay
            team={gw2 === Number(gameweek) ? data.team_2 : (team2Data ?? data.team_2)}
            matchupType={data.type}
            showGameweekStats={gw2 <= data.current_gameweek || !!data.matchup?.has_started}
            gameweek={gw2}
            livePoints={livePoints}
            liveStats={liveStats}
          />
        </div>
      </div>
    </div>
  );
}
