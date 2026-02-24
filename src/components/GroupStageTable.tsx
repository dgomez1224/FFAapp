"use client";

import React, { useEffect, useState } from "react";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";

interface Standing {
  team_id: string;
  entry_name: string;
  manager_name: string;
  manager_short_name: string;
  total_points: number;
  captain_points: number;
  rank: number;
}

interface StandingsResponse {
  start_gameweek: number;
  end_gameweek: number;
  standings: Standing[];
}

interface Props {
  tournamentId: string;
}

const REFRESH_INTERVAL = 30_000; // 30 seconds

export default function GroupStageTable({ tournamentId }: Props) {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStandings = async () => {
    try {
      setError(null);
      const res = await fetch(
        `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/group-standings/${tournamentId}`,
        { headers: getSupabaseFunctionHeaders() }
      );
      if (!res.ok) throw new Error("Failed to fetch standings");
      const data: StandingsResponse = await res.json();
      setStandings(data.standings);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unknown error");
    }
  };

  useEffect(() => {
    fetchStandings();
    const interval = setInterval(fetchStandings, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [tournamentId]);

  if (loading) return <p>Loading group stage standings…</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  // Determine advancing threshold (top 80%)
  const advancingCount = Math.ceil(standings.length * 0.8);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-300 divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Rank</th>
            <th className="px-4 py-2 text-left">Team</th>
            <th className="px-4 py-2 text-left">Manager</th>
            <th className="px-4 py-2 text-right">Total Points</th>
            <th className="px-4 py-2 text-right">Captain Points</th>
            <th className="px-4 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {standings.map((team, idx) => {
            const advancing = team.rank <= advancingCount;
            return (
              <tr
                key={team.team_id}
                className={advancing ? "bg-green-50 font-semibold" : ""}
              >
                <td className="px-4 py-2">{team.rank}</td>
                <td className="px-4 py-2">{team.entry_name}</td>
                <td className="px-4 py-2">{team.manager_name}</td>
                <td className="px-4 py-2 text-right">{team.total_points}</td>
                <td className="px-4 py-2 text-right">{team.captain_points}</td>
                <td className="px-4 py-2 text-center">
                  {advancing ? "Advancing" : "Eliminated"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
