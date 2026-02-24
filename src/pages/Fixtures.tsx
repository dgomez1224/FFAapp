import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/card";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { FootballPitch, PitchPlayer } from "../components/FootballPitch";

type TeamRef = {
  id: string;
  entry_name: string | null;
  manager_name: string | null;
};

type Fixture = {
  fixture_id: string;
  matchup_id?: string;
  type: "league" | "cup";
  gameweek: number;
  round?: string;
  leg?: number;
  team_1_id: string;
  team_2_id: string;
  team_1_points: number;
  team_2_points: number;
  team_1_rank?: number | null;
  team_2_rank?: number | null;
  team_1: TeamRef | null;
  team_2: TeamRef | null;
};

type FixtureGroup = {
  gameweek: number;
  matchups: Fixture[];
};

type Payload = {
  season: string;
  current_gameweek: number;
  league: FixtureGroup[];
  cup: FixtureGroup[];
};

function FixtureRow({ fixture }: { fixture: Fixture }) {
  const baseHref = `/matchup/${fixture.type}/${fixture.gameweek}/${fixture.team_1_id}/${fixture.team_2_id}`;
  const href = fixture.matchup_id ? `${baseHref}?matchupId=${encodeURIComponent(fixture.matchup_id)}` : baseHref;
  // If fixture contains last_lineup fields (upcoming/unstarted), render pitch for each team
  if ((fixture as any).last_lineup_1 || (fixture as any).last_lineup_2) {
    const last1 = (fixture as any).last_lineup_1 || [];
    const last2 = (fixture as any).last_lineup_2 || [];
    const convert = (rows: any[]): PitchPlayer[] =>
      rows.map((r) => ({
        player_id: r.player_id,
        player_name: r.player_name,
        position: r.position || 3,
        raw_points: r.points ?? 0,
        effective_points: r.points ?? 0,
        is_captain: !!r.is_captain,
        is_vice_captain: false,
        is_cup_captain: !!r.is_captain,
        multiplier: !!r.is_captain ? 2 : 1,
      }));

    return (
      <Link to={href} className="block w-full rounded-md border p-3 hover:bg-muted/40 transition-colors">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{fixture.team_1?.entry_name || "—"}</div>
            <FootballPitch players={convert(last1)} onPlayerClick={() => {}} showCaptain={true} />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{fixture.team_1_points} - {fixture.team_2_points}</div>
            {fixture.type === "cup" && fixture.leg ? (
              <div className="text-xs text-muted-foreground">{fixture.round || "Cup"} • Leg {fixture.leg}</div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{fixture.team_2?.entry_name || "—"}</div>
            <FootballPitch players={convert(last2)} onPlayerClick={() => {}} showCaptain={true} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={href} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md border p-3 hover:bg-muted/40 transition-colors">
      <div className="text-right">
        {fixture.team_1_rank != null ? (
          <div className="text-xs text-muted-foreground">#{fixture.team_1_rank}</div>
        ) : null}
        <div className="font-medium">{fixture.team_1?.manager_name || "—"}</div>
        <div className="text-xs text-muted-foreground">{fixture.team_1?.entry_name || "—"}</div>
      </div>
      <div className="text-center font-semibold">
        {fixture.team_1_points} - {fixture.team_2_points}
        {fixture.type === "cup" && fixture.leg ? (
          <div className="text-xs text-muted-foreground">{fixture.round || "Cup"} • Leg {fixture.leg}</div>
        ) : null}
      </div>
      <div>
        {fixture.team_2_rank != null ? (
          <div className="text-xs text-muted-foreground">#{fixture.team_2_rank}</div>
        ) : null}
        <div className="font-medium">{fixture.team_2?.manager_name || "—"}</div>
        <div className="text-xs text-muted-foreground">{fixture.team_2?.entry_name || "—"}</div>
      </div>
    </Link>
  );
}

export default function FixturesPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/fixtures`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) {
          throw new Error(payload?.error?.message || "Failed to load fixtures");
        }
        setData(payload);
      } catch (err: any) {
        setError(err.message || "Failed to load fixtures");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <Card className="p-6"><p className="text-sm text-muted-foreground">Loading fixtures…</p></Card>;
  }
  if (error || !data) {
    return <Card className="p-6"><p className="text-sm text-destructive">{error || "Failed to load fixtures"}</p></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Season Fixtures</h1>
        <p className="text-sm text-muted-foreground mt-2">League and cup fixtures by gameweek. Click any matchup for lineups.</p>
      </div>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-3">League Fixtures</h2>
        <div className="space-y-4">
          {data.league.map((group) => (
            <div key={`league-${group.gameweek}`} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">GW {group.gameweek}</h3>
              {group.matchups.map((fixture) => (
                <FixtureRow key={fixture.fixture_id} fixture={fixture} />
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-xl font-semibold mb-3">Cup Fixtures</h2>
        <div className="space-y-4">
          {data.cup.map((group) => (
            <div key={`cup-${group.gameweek}`} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">GW {group.gameweek}</h3>
              {group.matchups.map((fixture) => (
                <FixtureRow key={fixture.fixture_id} fixture={fixture} />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
