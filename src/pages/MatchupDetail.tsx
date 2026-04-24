import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import {
  getPlayerInitialsAbbrev,
  getProxiedImageUrl,
  handlePlayerImageErrorWithWikipediaFallback,
} from "../lib/playerImage";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { FootballPitch, pitchPlayerDisplayName, PitchPlayer } from "../components/FootballPitch";
import PlayerStatsTable from "../components/PlayerStatsTable";
import { PlayerStatsModal, PlayerStats } from "../components/PlayerStatsModal";
import pitchBg from "../assets/backgrounds/FPL Site Pitch.png";

type LineupPlayer = {
player_id: number;
player_name: string;
web_name?: string | null;
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

type CupTieSummary = {
  leg_1_gameweek: number;
  leg_2_gameweek: number;
  team_1_leg_1: number | null;
  team_1_leg_2: number | null;
  team_2_leg_1: number | null;
  team_2_leg_2: number | null;
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
/** Two-leg aggregate (cup knockout with matchupId); null for league or missing data. */
cup_tie?: CupTieSummary | null;
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
matchupId,
}: {
type: "league" | "cup";
gw: number;
teamId: string;
opponentsByGw?: Record<string, string>;
matchupId?: string | null;
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
const sp = new URLSearchParams();
if (matchupId) sp.set("matchupId", matchupId);
const qs = sp.toString();
navigate(`/matchup/${type}/${targetGw}/${teamId}/${opp}${qs ? `?${qs}` : ""}`);
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

function SubsStrip({
  players,
  side,
  onPlayerClick,
}: {
  players: PitchPlayer[];
  side: "top" | "bottom";
  onPlayerClick?: (p: PitchPlayer) => void;
}) {
if (players.length === 0) return null;
return (
<div className={`flex items-center gap-1 px-1 py-0.5 ${side === "top" ? "justify-start" : "justify-end"}`}>
<span className="text-[9px] text-white/60 shrink-0">{side === "top" ? "↓" : "↓"}</span>
{players.map((p) => {
const Wrapper = onPlayerClick ? "button" : "div";
return (
<Wrapper
key={p.player_id}
type={onPlayerClick ? "button" : undefined}
onClick={onPlayerClick ? () => onPlayerClick(p) : undefined}
className={`relative flex flex-col items-center opacity-60 ${onPlayerClick ? "cursor-pointer border-0 bg-transparent p-0" : ""}`}
>
    {p.is_auto_subbed_off && (
      <div className="absolute -top-1 -left-1 z-20 w-3 h-3 rounded-full bg-red-500 text-white text-[7px] font-bold flex items-center justify-center shadow-md leading-none">
        ↑
      </div>
    )}
    {p.is_auto_subbed_on && (
      <div className="absolute -top-1 -left-1 z-20 w-3 h-3 rounded-full bg-green-500 text-white text-[7px] font-bold flex items-center justify-center shadow-md leading-none">
        ↓
      </div>
    )}
    <div className="relative w-5 h-6 rounded overflow-hidden bg-gray-700 flex items-center justify-center">
{p.player_image_url ? (
<img
src={getProxiedImageUrl(p.player_image_url) ?? undefined}
alt={p.player_name}
className="w-full h-full object-cover object-top"
onError={(e) =>
handlePlayerImageErrorWithWikipediaFallback(e, p.player_name, {
fallbackClassName: "absolute inset-0 flex items-center justify-center bg-gray-700 text-white text-[9px] font-bold",
})
}
/>
) : (
<span className="text-[9px] font-bold text-white">{getPlayerInitialsAbbrev(p.player_name)}</span>
)}
</div>
<span className="text-[7px] text-white leading-none" style={{ textShadow: "0 1px 2px rgba(0,0,0,1)" }}>
{pitchPlayerDisplayName(p).slice(0, 6)}
</span>
</Wrapper>
);
})}
</div>
);
}

function SharedPitch({
team1,
team2,
team1Bench,
team2Bench,
onPlayerClick1,
onPlayerClick2,
}: {
team1: PitchPlayer[];
team2: PitchPlayer[];
team1Bench: PitchPlayer[];
team2Bench: PitchPlayer[];
onPlayerClick1: (p: PitchPlayer) => void;
onPlayerClick2: (p: PitchPlayer) => void;
}) {
return (
<div className="w-full flex flex-col rounded-lg overflow-hidden">
    {/* Both bench strips above the pitch, side by side */}
    <div className="flex justify-between mb-1">
      <SubsStrip players={team1Bench} side="top" />
      <SubsStrip players={team2Bench} side="top" />
    </div>

  {/* ONE shared pitch with both teams on it */}
  <div
    className="relative w-full rounded-lg overflow-hidden"
    style={{
      aspectRatio: "16/9",
      backgroundImage: `url(${pitchBg})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }}
  >
    {/* Team 1 players — left half (noBackground so they sit on shared bg) */}
    <div className="absolute inset-y-0 left-0 w-1/2">
      <FootballPitch
        players={team1}
        onPlayerClick={onPlayerClick1}
        showCaptain={true}
        orientation="landscape"
        side="left"
        noBackground={true}
      />
    </div>

    {/* Center line */}
    <div className="absolute inset-y-0 left-1/2 -translate-x-px w-px bg-white/60 z-10" />

    {/* Team 2 players — right half */}
    <div className="absolute inset-y-0 right-0 w-1/2">
      <FootballPitch
        players={team2}
        onPlayerClick={onPlayerClick2}
        showCaptain={true}
        orientation="landscape"
        side="right"
        noBackground={true}
      />
    </div>
  </div>
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
hidePitch = false,
}: {
team: TeamDetail;
matchupType: "league" | "cup";
showGameweekStats?: boolean;
gameweek: number;
livePoints: Record<number, number>;
liveStats: Record<number, any>;
hidePitch?: boolean;
}) {
const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

const starters = team.lineup
.filter((p) => !p.is_bench)
.sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99));
const bench = team.lineup
.filter((p) => !!p.is_bench)
.sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99));

const pitchPlayers: PitchPlayer[] = starters.map((p) => ({
player_id: p.player_id,
player_name: p.player_name,
web_name: p.web_name ?? null,
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

const mult = fullPlayer.multiplier ?? 1;
const raw = fullPlayer.raw_points ?? 0;
const effectiveFromMultiplier = mult > 1 ? Math.round(raw * mult) : fullPlayer.effective_points;

try {
  const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-history?player_id=${encodeURIComponent(String(player.player_id))}`;
  const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
  const payload = await res.json();
  if (!res.ok || payload?.error) {
    throw new Error(payload?.error?.message || "Failed to fetch player history");
  }

  setSelectedPlayer({
    ...fullPlayer,
    effective_points: effectiveFromMultiplier,
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
    effective_points: effectiveFromMultiplier,
    position: fullPlayer.position,
    history: [],
  });
}

};

return (
<Card className="p-3">
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

  {!hidePitch && (
    <div className="mb-3">
      <FootballPitch players={pitchPlayers} onPlayerClick={handlePlayerClick} showCaptain={true} />
    </div>
  )}

  <PlayerStatsTable
    players={(matchupType === "cup"
      ? [...(team.lineup || [])].sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99))
      : team.lineup || []
    ).map((p) => ({
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

  {matchupType === "cup" && (team.lineup || []).length > 0 && (
    <p className="mt-4 text-xs text-muted-foreground">
      Full squad (slots 1–15) — all players score. Order follows draft lineup slots below.
    </p>
  )}

  {/* Substitute/Bench info — league only (cup lists full squad on pitch + table) */}
  {matchupType === "league" && starters.length > 0 && (
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
const [h2hModalPlayer, setH2hModalPlayer] = useState<PlayerStats | null>(null);

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
const matchupIdFromUrl = searchParams.get("matchupId");
const opponentGwKeys =
  data.team_1_opponents_by_gw != null
    ? Object.keys(data.team_1_opponents_by_gw)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b)
    : [];
const isCupKnockoutByMatchupId =
  data.type === "cup" && !!matchupIdFromUrl && opponentGwKeys.length >= 1;
const isCupGroupStage = data.type === "cup" && currentGwNum >= 29 && currentGwNum <= 32;

let minGw = data.type === "cup" ? 29 : 1;
let maxGw = data.current_gameweek ?? currentGwNum;
if (isCupKnockoutByMatchupId) {
  minGw = opponentGwKeys[0]!;
  maxGw = opponentGwKeys[opponentGwKeys.length - 1]!;
}

const goToGw = (gw: number) => {
  if (gw < minGw || gw > maxGw) return;
  setGw1(gw);
  setGw2(gw);
  const sp = new URLSearchParams();
  const mid = searchParams.get("matchupId");
  if (mid) sp.set("matchupId", mid);
  const qs = sp.toString();
  navigate(`/matchup/${type}/${gw}/${team1}/${team2}${qs ? `?${qs}` : ""}`);
};

const team1Lineup = gw1 === Number(gameweek) ? data.team_1.lineup : (team1Data ?? data.team_1).lineup;
const team2Lineup = gw2 === Number(gameweek) ? data.team_2.lineup : (team2Data ?? data.team_2).lineup;

const makeStarters = (lineup: typeof team1Lineup): PitchPlayer[] =>
(lineup || [])
.filter((p) => !p.is_bench)
.sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99))
.map((p) => ({
player_id: p.player_id,
player_name: p.player_name,
web_name: p.web_name ?? null,
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
is_auto_subbed_off: p.is_auto_subbed_off,
}));

const makeBench = (lineup: typeof team1Lineup): PitchPlayer[] =>
(lineup || [])
.filter((p) => !!p.is_bench)
.sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99))
.map((p) => ({
player_id: p.player_id,
player_name: p.player_name,
web_name: p.web_name ?? null,
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
is_auto_subbed_off: p.is_auto_subbed_off,
}));

/** Cup: entire squad on the pitch (slots 1–15), same card mapping as starters. */
const makeFullSquadPitch = (lineup: typeof team1Lineup): PitchPlayer[] =>
(lineup || [])
.sort((a, b) => (a.lineup_slot ?? 99) - (b.lineup_slot ?? 99))
.map((p) => ({
player_id: p.player_id,
player_name: p.player_name,
web_name: p.web_name ?? null,
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
is_auto_subbed_off: p.is_auto_subbed_off,
}));

const team1PitchPlayers =
  data.type === "cup" ? makeFullSquadPitch(team1Lineup) : makeStarters(team1Lineup);
const team2PitchPlayers =
  data.type === "cup" ? makeFullSquadPitch(team2Lineup) : makeStarters(team2Lineup);
const team1BenchPlayers = data.type === "cup" ? [] : makeBench(team1Lineup);
const team2BenchPlayers = data.type === "cup" ? [] : makeBench(team2Lineup);

const openH2hPlayerModal = async (fullPlayer: LineupPlayer | undefined) => {
  if (!fullPlayer) return;
  const multH = fullPlayer.multiplier ?? 1;
  const rawH = fullPlayer.raw_points ?? 0;
  const effectiveH = multH > 1 ? Math.round(rawH * multH) : fullPlayer.effective_points;
  try {
    const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/player-history?player_id=${encodeURIComponent(String(fullPlayer.player_id))}`;
    const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
    const payload = await res.json();
    if (!res.ok || payload?.error) {
      throw new Error(payload?.error?.message || "Failed to fetch player history");
    }
    setH2hModalPlayer({
      ...fullPlayer,
      effective_points: effectiveH,
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
    setH2hModalPlayer({
      ...fullPlayer,
      effective_points: effectiveH,
      position: fullPlayer.position,
      history: [],
    });
  }
};

const team1ClickHandler = (p: PitchPlayer) => {
  const full = team1Lineup.find((x) => x.player_id === p.player_id);
  void openH2hPlayerModal(full);
};
const team2ClickHandler = (p: PitchPlayer) => {
  const full = team2Lineup.find((x) => x.player_id === p.player_id);
  void openH2hPlayerModal(full);
};
const leagueLiveTeam1 = (data.team_1.lineup || []).reduce(
(sum, player) => sum + (player.is_bench ? 0 : Number(player.effective_points || 0)),
0,
);
const leagueLiveTeam2 = (data.team_2.lineup || []).reduce(
(sum, player) => sum + (player.is_bench ? 0 : Number(player.effective_points || 0)),
0,
);
/** Cup: header uses live lineup totals (captain + full squad). DB leg columns are often 0 until synced — `??` would keep 0. */
const team1Points =
  data.type === "league"
    ? leagueLiveTeam1
    : Number(data.matchup.live_team_1_points ?? data.matchup.team_1_points ?? 0);
const team2Points =
  data.type === "league"
    ? leagueLiveTeam2
    : Number(data.matchup.live_team_2_points ?? data.matchup.team_2_points ?? 0);
const team1Score = Math.round(team1Points);
const team2Score = Math.round(team2Points);

const legFmt = (n: number | null | undefined) =>
  n == null || Number.isNaN(Number(n)) ? "–" : String(Math.round(Number(n)));
const cupTie = data.cup_tie;
const cupAgg1 =
  cupTie == null
    ? null
    : (cupTie.team_1_leg_1 ?? 0) + (cupTie.team_1_leg_2 ?? 0);
const cupAgg2 =
  cupTie == null
    ? null
    : (cupTie.team_2_leg_1 ?? 0) + (cupTie.team_2_leg_2 ?? 0);
const cupTieHasAnyLeg =
  cupTie != null &&
  [cupTie.team_1_leg_1, cupTie.team_1_leg_2, cupTie.team_2_leg_1, cupTie.team_2_leg_2].some(
    (v) => v != null && !Number.isNaN(Number(v)),
  );

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
        <p className="text-[11px] text-muted-foreground mt-0.5">This gameweek (cup squad total)</p>
        {data.type === "cup" && cupTie && cupTieHasAnyLeg && (
          <div className="mt-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
            <p className="font-medium text-foreground">
              Tie aggregate: {cupAgg1 ?? "–"} – {cupAgg2 ?? "–"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
              GW{cupTie.leg_1_gameweek}: {legFmt(cupTie.team_1_leg_1)} / {legFmt(cupTie.team_2_leg_1)} · GW
              {cupTie.leg_2_gameweek}: {legFmt(cupTie.team_1_leg_2)} / {legFmt(cupTie.team_2_leg_2)}
            </p>
          </div>
        )}
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

  {/* Shared H2H pitch — works on all screen sizes */}
  <div>
    <div className="flex justify-between items-center mb-2 px-1">
      <span className="text-sm font-semibold">{data.team_1.manager_name}</span>
      <span className="text-xs text-muted-foreground">vs</span>
      <span className="text-sm font-semibold">{data.team_2.manager_name}</span>
    </div>
    <SharedPitch
      team1={team1PitchPlayers}
      team2={team2PitchPlayers}
      team1Bench={team1BenchPlayers}
      team2Bench={team2BenchPlayers}
      onPlayerClick1={team1ClickHandler}
      onPlayerClick2={team2ClickHandler}
    />
  </div>

  {/* Per-team bench + stats (pitch hidden) */}
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div>
      {data.type === "league" || !isCupGroupStage ? (
        <GwNav label={data.team_1.manager_name} gw={gw1} minGw={minGw} maxGw={maxGw} onChange={setGw1} />
      ) : null}
      <ViewMatchupLink
        type={data.type}
        gw={gw1}
        teamId={team1!}
        opponentsByGw={data.team_1_opponents_by_gw}
        matchupId={matchupIdFromUrl}
      />
      <TeamPitchDisplay
        team={gw1 === Number(gameweek) ? data.team_1 : (team1Data ?? data.team_1)}
        matchupType={data.type}
        showGameweekStats={gw1 <= data.current_gameweek || !!data.matchup?.has_started}
        gameweek={gw1}
        livePoints={livePoints}
        liveStats={liveStats}
        hidePitch={true}
      />
    </div>
    <div>
      {data.type === "league" || !isCupGroupStage ? (
        <GwNav label={data.team_2.manager_name} gw={gw2} minGw={minGw} maxGw={maxGw} onChange={setGw2} />
      ) : null}
      <ViewMatchupLink
        type={data.type}
        gw={gw2}
        teamId={team2!}
        opponentsByGw={data.team_2_opponents_by_gw}
        matchupId={matchupIdFromUrl}
      />
      <TeamPitchDisplay
        team={gw2 === Number(gameweek) ? data.team_2 : (team2Data ?? data.team_2)}
        matchupType={data.type}
        showGameweekStats={gw2 <= data.current_gameweek || !!data.matchup?.has_started}
        gameweek={gw2}
        livePoints={livePoints}
        liveStats={liveStats}
        hidePitch={true}
      />
    </div>
  </div>

  <PlayerStatsModal
    player={h2hModalPlayer!}
    isOpen={!!h2hModalPlayer}
    onClose={() => setH2hModalPlayer(null)}
    showHistory={true}
    showGameweekStats={currentGwNum <= data.current_gameweek || !!data.matchup?.has_started}
    showEffectivePoints={data.type === "cup"}
  />
</div>

);
}