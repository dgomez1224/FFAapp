import React, { useState } from "react";
import {
  getPlayerInitialsAbbrev,
  getProxiedImageUrl,
  handlePlayerImageErrorWithWikipediaFallback,
} from "../lib/playerImage";

export interface PlayerStatsTableProps {
  players: Array<{
    id: number;
    name: string;
    image_url?: string | null;
    position: number | null;
    is_auto_subbed_off?: boolean;
    is_auto_subbed_on?: boolean;
    subbed_on_by?: number;
    subbed_off_for?: number;
  }>;
  livePoints: Record<number, number>;
  liveStats: Record<number, any>;
  captainId?: number | null;
  viceCaptainId?: number | null;
  gameweek?: number;
  autoSubs?: Array<{
    player_off_id: number;
    player_off_name: string;
    player_on_id: number;
    player_on_name: string;
  }>;
}

export default function PlayerStatsTable({
  players,
  livePoints,
  liveStats,
  captainId = null,
  viceCaptainId = null,
  gameweek,
}: PlayerStatsTableProps) {
  const [statsOpen, setStatsOpen] = useState(true);

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
                <th className="py-1 px-1 text-center">OG</th>
                <th className="py-1 px-1 text-center">GC</th>
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
                            src={getProxiedImageUrl(player.image_url) ?? undefined}
                            alt=""
                            className="relative z-10 h-6 w-5 object-cover rounded"
                            onError={(e) =>
                              handlePlayerImageErrorWithWikipediaFallback(e, player.name, {
                                fallbackClassName:
                                  "absolute inset-0 flex items-center justify-center bg-muted rounded text-xs font-semibold text-muted-foreground",
                              })
                            }
                          />
                        ) : (
                          <div className="relative z-10 flex h-6 w-5 items-center justify-center rounded bg-muted text-[9px] font-semibold text-muted-foreground">
                            {getPlayerInitialsAbbrev(player.name)}
                          </div>
                        )}
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
                      {player.is_auto_subbed_on && (
                        <span
                          className="ml-1 text-green-600 text-xs font-bold"
                          title="Auto subbed on"
                        >
                          ↑
                        </span>
                      )}
                      {player.is_auto_subbed_off && (
                        <span
                          className="ml-1 text-red-500 text-xs font-bold"
                          title="Auto subbed off"
                        >
                          ↓
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-1 text-center text-muted-foreground">{posLabel}</td>
                    <td className="py-1 px-1 text-center font-semibold">{pts}</td>
                    <td className="py-1 px-1 text-center">{s?.goals_scored ?? 0}</td>
                    <td className="py-1 px-1 text-center">{s?.assists ?? 0}</td>
                    <td className="py-1 px-1 text-center">{s?.own_goals ?? 0}</td>
                    <td className="py-1 px-1 text-center">
                      {(s?.clean_sheets ?? 0) > 0 && (
                        <span title="Clean sheet" className="mr-1">🧤</span>
                      )}
                      {s?.goals_conceded ?? 0}
                    </td>
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
              {players.some((p) => p.is_auto_subbed_off) && (
                <>
                  <tr>
                    <td
                      colSpan={17}
                      className="py-1 px-1 text-xs text-muted-foreground border-t"
                    >
                      Substituted off
                    </td>
                  </tr>
                  {players
                    .filter((player) => player.is_auto_subbed_off)
                    .map((player) => {
                      const s = liveStats[player.id];
                      const pos = player.position ?? 3;
                      const posLabel =
                        pos === 1 ? "GK" : pos === 2 ? "DEF" : pos === 3 ? "MID" : "FWD";
                      const pts = livePoints[player.id] ?? 0;
                      return (
                        <tr
                          key={`suboff-${player.id}`}
                          className="border-b opacity-50"
                        >
                          <td className="py-1 px-1">
                            <div className="relative h-6 w-5">
                              <div className="absolute inset-0 h-6 w-5 rounded bg-muted" aria-hidden="true" />
                              {player.image_url ? (
                                <img
                                  src={getProxiedImageUrl(player.image_url) ?? undefined}
                                  alt=""
                                  className="relative z-10 h-6 w-5 object-cover rounded"
                                  onError={(e) =>
                                    handlePlayerImageErrorWithWikipediaFallback(e, player.name, {
                                      fallbackClassName:
                                        "absolute inset-0 flex items-center justify-center bg-muted rounded text-xs font-semibold text-muted-foreground",
                                    })
                                  }
                                />
                              ) : (
                                <div className="relative z-10 flex h-6 w-5 items-center justify-center rounded bg-muted text-[9px] font-semibold text-muted-foreground">
                                  {getPlayerInitialsAbbrev(player.name)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-1 px-1 font-medium">
                            {player.name}
                            <span className="ml-1 text-red-500 text-xs font-bold">↓</span>
                          </td>
                          <td className="py-1 px-1 text-center text-muted-foreground">
                            {posLabel}
                          </td>
                          <td className="py-1 px-1 text-center font-semibold">
                            {pts}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.goals_scored ?? 0}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.assists ?? 0}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.own_goals ?? 0}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.goals_conceded ?? 0}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.defensive_contribution ?? 0}
                          </td>
                          <td className="py-1 px-1 text-center text-muted-foreground">
                            —
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.minutes ?? 0}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.bonus ?? 0}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.expected_goals != null
                              ? Number(s.expected_goals).toFixed(2)
                              : "—"}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.expected_assists != null
                              ? Number(s.expected_assists).toFixed(2)
                              : "—"}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.expected_goal_involvements != null
                              ? Number(s.expected_goal_involvements).toFixed(2)
                              : "—"}
                          </td>
                          <td className="py-1 px-1 text-center">
                            {s?.saves > 0 ? s.saves : "—"}
                          </td>
                          <td className="py-1 px-1 text-center text-muted-foreground">
                            —
                          </td>
                        </tr>
                      );
                    })}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
