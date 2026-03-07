import React, { useState } from "react";

export interface PlayerStatsTableProps {
  players: Array<{
    id: number;
    name: string;
    image_url?: string | null;
    position: number | null;
  }>;
  livePoints: Record<number, number>;
  liveStats: Record<number, any>;
  captainId?: number | null;
  viceCaptainId?: number | null;
  gameweek?: number;
}

export default function PlayerStatsTable({
  players,
  livePoints,
  liveStats,
  captainId = null,
  viceCaptainId = null,
  gameweek,
}: PlayerStatsTableProps) {
  const [statsOpen, setStatsOpen] = useState(false);

  if (players.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setStatsOpen((prev) => !prev)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{statsOpen ? "▾" : "▸"}</span>
        <span>Player Stats (GW{gameweek ?? "—"})</span>
      </button>

      {statsOpen && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-1 px-1 text-left w-7"></th>
                <th className="py-1 px-1 text-left">Player</th>
                <th className="py-1 px-1 text-center">Pos</th>
                <th className="py-1 px-1 text-center">Pts</th>
                <th className="py-1 px-1 text-center">G</th>
                <th className="py-1 px-1 text-center">A</th>
                <th className="py-1 px-1 text-center">CS</th>
                <th className="py-1 px-1 text-center">DefCon</th>
                <th className="py-1 px-1 text-center">DR</th>
                <th className="py-1 px-1 text-center">Min</th>
                <th className="py-1 px-1 text-center">Bon</th>
                <th className="py-1 px-1 text-center">xG</th>
                <th className="py-1 px-1 text-center">xA</th>
                <th className="py-1 px-1 text-center">xG+A</th>
                <th className="py-1 px-1 text-center">Saves</th>
                <th className="py-1 px-1 text-center">Cards</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const s = liveStats[player.id];
                const pos = player.position ?? 3;
                const posLabel = pos === 1 ? "GK" : pos === 2 ? "DEF" : pos === 3 ? "MID" : "FWD";

                const cleanSheets = s?.clean_sheets ?? 0;
                const saves = s?.saves ?? 0;
                const defCon = s?.defensive_contribution ?? 0;

                const pts = livePoints[player.id] ?? 0;
                const drThreshold = pos === 1 || pos === 2 ? 10 : 12;
                const defensiveReturn = defCon >= drThreshold;

                const yellowCards = s?.yellow_cards ?? 0;
                const redCards = s?.red_cards ?? 0;

                return (
                  <tr key={player.id} className="border-b hover:bg-muted/30">
                    <td className="py-1 px-1">
                      <div className="relative h-6 w-5">
                        <div className="absolute inset-0 h-6 w-5 rounded bg-muted" aria-hidden="true" />
                        {player.image_url ? (
                          <img
                            src={player.image_url}
                            alt=""
                            className="relative h-6 w-5 object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>
                    </td>
                    <td className="py-1 px-1 font-medium">
                      {player.name}
                      {player.id === captainId && (
                        <span className="ml-1 font-bold text-amber-600">C</span>
                      )}
                      {player.id === viceCaptainId && (
                        <span className="ml-1 text-muted-foreground">V</span>
                      )}
                    </td>
                    <td className="py-1 px-1 text-center text-muted-foreground">{posLabel}</td>
                    <td className="py-1 px-1 text-center font-semibold">{pts}</td>
                    <td className="py-1 px-1 text-center">{s?.goals_scored ?? 0}</td>
                    <td className="py-1 px-1 text-center">{s?.assists ?? 0}</td>
                    <td className="py-1 px-1 text-center">{cleanSheets}</td>
                    <td className="py-1 px-1 text-center">{defCon}</td>
                    <td className="py-1 px-1 text-center">
                      {defensiveReturn ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-1 px-1 text-center">{s?.minutes ?? 0}</td>
                    <td className="py-1 px-1 text-center">{s?.bonus ?? 0}</td>
                    <td className="py-1 px-1 text-center">
                      {s?.expected_goals != null ? Number(s.expected_goals).toFixed(2) : "—"}
                    </td>
                    <td className="py-1 px-1 text-center">
                      {s?.expected_assists != null ? Number(s.expected_assists).toFixed(2) : "—"}
                    </td>
                    <td className="py-1 px-1 text-center">
                      {s?.expected_goal_involvements != null
                        ? Number(s.expected_goal_involvements).toFixed(2)
                        : "—"}
                    </td>
                    <td className="py-1 px-1 text-center">{saves > 0 ? saves : "—"}</td>
                    <td className="py-1 px-1 text-center">
                      {redCards > 0 ? (
                        <span title="Red card">🟥</span>
                      ) : yellowCards > 0 ? (
                        <span title="Yellow card">🟨</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
