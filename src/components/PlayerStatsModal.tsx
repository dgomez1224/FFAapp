/**
 * Player Stats Modal
 * Shows detailed player stats when clicking on a player in the pitch
 */

import React from "react";
import {
  getPlayerInitialsAbbrev,
  getProxiedImageUrl,
  handlePlayerImageErrorWithWikipediaFallback,
} from "../lib/playerImage";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export interface PlayerStats {
  player_id: number;
  player_name: string;
  player_image_url?: string | null;
  position: number;
  raw_points: number;
  effective_points: number;
  is_captain: boolean;
  is_vice_captain: boolean;
  is_cup_captain: boolean;
  multiplier: number;
  goals_scored?: number;
  assists?: number;
  minutes?: number;
  bonus?: number;
  saves?: number;
  defensive_contributions?: number;
  /** DEF 10+ or MID/FWD 12+ = defensive return (already in API score) */
  defensive_return?: boolean;
  clean_sheets?: number;
  goals_conceded?: number;
  yellow_cards?: number;
  red_cards?: number;
  penalties_missed?: number;
  penalties_saved?: number;
  // For history view
  history?: {
    gameweek: number;
    points: number;
    goals?: number;
    own_goals?: number;
    assists?: number;
    minutes?: number;
    clean_sheets?: number;
    goals_conceded?: number;
    bonus?: number;
    saves?: number;
    yellow_cards?: number;
    red_cards?: number;
    penalties_saved?: number;
    penalties_missed?: number;
    defensive_contributions?: number;
    expected_goals?: number;
    expected_assists?: number;
    expected_goal_involvements?: number;
    expected_goals_conceded?: number;
    fixture_difficulty?: number | null;
    is_upcoming?: boolean;
    opponent_team_name?: string | null;
    was_home?: boolean;
    fixture?: string | null;
    result?: string | null;
    kickoff_time?: string | null;
  }[];
}

const POSITION_NAMES: Record<number, string> = {
  1: "Goalkeeper",
  2: "Defender",
  3: "Midfielder",
  4: "Forward",
};

interface PlayerStatsModalProps {
  player: PlayerStats;
  isOpen: boolean;
  onClose: () => void;
  showHistory?: boolean;
  /** When false, hide Gameweek Statistics (e.g. when fixture hasn't started or not current/last GW). */
  showGameweekStats?: boolean;
  onSelectCaptain?: (playerId: number) => void;
  onSelectViceCaptain?: (playerId: number) => void;
  showEffectivePoints?: boolean;
}

export function PlayerStatsModal({
  player,
  isOpen,
  onClose,
  showHistory = false,
  showGameweekStats = true,
  onSelectCaptain,
  onSelectViceCaptain,
  showEffectivePoints = true,
}: PlayerStatsModalProps) {
  const getFormDot = (entry: NonNullable<PlayerStats["history"]>[number]) => {
    const pos = player.position ?? 3;
    const goals = entry.goals ?? 0;
    const assists = entry.assists ?? 0;
    const cs = entry.clean_sheets ?? 0;
    const dc = entry.defensive_contributions ?? 0;
    const mins = entry.minutes ?? 0;
    if (mins === 0) return { color: "bg-gray-400", title: "DNP" };
    if (pos === 1) {
      if (cs >= 1 || (entry.saves ?? 0) >= 3) return { color: "bg-green-500", title: "Good" };
      if (mins >= 60) return { color: "bg-amber-400", title: "Ok" };
      return { color: "bg-red-400", title: "Poor" };
    }
    if (pos === 2) {
      if (goals >= 1 || assists >= 1 || cs >= 1 || dc >= 10) return { color: "bg-green-500", title: "Good" };
      if (mins >= 60) return { color: "bg-amber-400", title: "Ok" };
      return { color: "bg-red-400", title: "Poor" };
    }
    if (pos === 3) {
      if (goals >= 1 || assists >= 1 || dc >= 12) return { color: "bg-green-500", title: "Good" };
      if (mins >= 60) return { color: "bg-amber-400", title: "Ok" };
      return { color: "bg-red-400", title: "Poor" };
    }
    // FWD
    if (goals >= 1 || assists >= 1) return { color: "bg-green-500", title: "Good" };
    if (mins >= 60) return { color: "bg-amber-400", title: "Ok" };
    return { color: "bg-red-400", title: "Poor" };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Close button */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
                {player.player_image_url ? (
                  <img
                    src={getProxiedImageUrl(player.player_image_url) ?? undefined}
                    alt={player.player_name}
                    className="h-full w-full object-cover"
                    onError={(e) =>
                      handlePlayerImageErrorWithWikipediaFallback(e, player.player_name, {
                        fallbackClassName:
                          "absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-xs font-bold",
                      })
                    }
                  />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">{getPlayerInitialsAbbrev(player.player_name)}</span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">{player.player_name}</h2>
                <p className="text-sm text-muted-foreground">
                  {player.position === 1 ? "GK" :
                   player.position === 2 ? "DEF" :
                   player.position === 3 ? "MID" : "FWD"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-2xl font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Position and captain info */}
          <div className="mb-4 p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Position</p>
            <p className="text-lg font-semibold">{POSITION_NAMES[player.position]}</p>
            {(player.is_captain || player.is_cup_captain || player.is_vice_captain) && (
              <div className="mt-2 text-sm">
                {player.is_cup_captain && <span className="inline-block bg-amber-100 text-amber-900 px-2 py-1 rounded mr-2">Captain (2x)</span>}
                {player.is_vice_captain && <span className="inline-block bg-blue-100 text-blue-900 px-2 py-1 rounded mr-2">Vice Captain</span>}
              </div>
            )}
          </div>

          {/* Points breakdown */}
          <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground">Raw Points</span>
                  <span className="font-semibold">{Math.round(player.raw_points)}</span>
                </div>
            {showEffectivePoints && player.multiplier > 1 && (
              <div className="flex justify-between items-center border-b pb-2">
                <span className="text-muted-foreground">Multiplier</span>
                <span className="font-semibold text-amber-600">×{player.multiplier}</span>
              </div>
            )}
            {showEffectivePoints && (
              <div className="flex justify-between items-center text-lg font-bold bg-green-50 dark:bg-green-950 p-2 rounded">
                <span>Effective Points</span>
                <span className="text-green-600 dark:text-green-400">{Math.round(player.effective_points)}</span>
              </div>
            )}
          </div>

          {/* Match stats — only show for current/last completed GW when value ≥ 1 */}
          {showGameweekStats && (
          <div className="space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Gameweek Statistics</h3>
            <div className="grid grid-cols-2 gap-2">
              {(player.goals_scored ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Goals</p>
                  <p className="text-lg font-bold">{player.goals_scored}</p>
                </div>
              )}
              {(player.assists ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Assists</p>
                  <p className="text-lg font-bold">{player.assists}</p>
                </div>
              )}
              {(player.minutes ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Minutes</p>
                  <p className="text-lg font-bold">{player.minutes}</p>
                </div>
              )}
              {(player.bonus ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Bonus</p>
                  <p className="text-lg font-bold">{player.bonus}</p>
                </div>
              )}
              {(player.saves ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Saves</p>
                  <p className="text-lg font-bold">{player.saves}</p>
                </div>
              )}
              {(player.defensive_contributions ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Def. Cont.</p>
                  <p className="text-lg font-bold">{player.defensive_contributions}</p>
                </div>
              )}
              {(() => {
                const pos = player.position ?? 0;
                const contrib = player.defensive_contributions ?? 0;
                const hasReturn = player.defensive_return === true || (pos === 2 && contrib >= 10) || ([3, 4].includes(pos) && contrib >= 12);
                return hasReturn ? (
                  <div className="p-2 bg-muted rounded">
                    <p className="text-muted-foreground text-xs">Defensive Return</p>
                    <p className="text-sm font-medium">✓</p>
                  </div>
                ) : null;
              })()}
              {(player.clean_sheets ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Clean Sheets</p>
                  <p className="text-lg font-bold">{player.clean_sheets}</p>
                </div>
              )}
              {(player.goals_conceded ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Goals Conceded</p>
                  <p className="text-lg font-bold">{player.goals_conceded}</p>
                </div>
              )}
              {(player.penalties_saved ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Penalty Saves</p>
                  <p className="text-lg font-bold">{player.penalties_saved}</p>
                </div>
              )}
              {(player.penalties_missed ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Penalties Missed</p>
                  <p className="text-lg font-bold">{player.penalties_missed}</p>
                </div>
              )}
              {(player.yellow_cards ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Yellow Cards</p>
                  <p className="text-lg font-bold">{player.yellow_cards}</p>
                </div>
              )}
              {(player.red_cards ?? 0) >= 1 && (
                <div className="p-2 bg-muted rounded">
                  <p className="text-muted-foreground text-xs">Red Cards</p>
                  <p className="text-lg font-bold">{player.red_cards}</p>
                </div>
              )}
            </div>
          </div>
          )}

          {showHistory && (
            <div className="space-y-2 text-sm mt-4">
              {player.history && player.history.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Recent Form (last {Math.min(10, player.history.filter((h) => !h.is_upcoming).length)} GW)
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {player.history
                      .filter((h) => !h.is_upcoming)
                      .slice(-10)
                      .map((entry) => {
                        const dot = getFormDot(entry);
                        return (
                          <div
                            key={entry.gameweek}
                            title={`GW${entry.gameweek}: ${dot.title} (${entry.points ?? 0}pts)`}
                            className={`w-4 h-4 rounded-full ${dot.color} cursor-default`}
                          />
                        );
                      })}
                  </div>
                </div>
              )}
              <h3 className="font-semibold mb-3">Gameweek History</h3>
              {player.history && player.history.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {player.history.map((entry) => {
                    const pos = player.position ?? 3;
                    const mins = entry.minutes ?? 0;
                    const goals = entry.goals ?? 0;
                    const assists = entry.assists ?? 0;
                    const ownGoals = entry.own_goals ?? 0;
                    const bonus = entry.bonus ?? 0;
                    const yellowCards = entry.yellow_cards ?? 0;
                    const redCards = entry.red_cards ?? 0;
                    const penMissed = entry.penalties_missed ?? 0;
                    const penSaved = entry.penalties_saved ?? 0;
                    const saves = entry.saves ?? 0;
                    const cleanSheets = entry.clean_sheets ?? 0;
                    const goalsConceded = entry.goals_conceded ?? 0;
                    const defContrib = entry.defensive_contributions ?? 0;
                    const xG = entry.expected_goals ?? 0;
                    const xA = entry.expected_assists ?? 0;
                    const xGA = entry.expected_goal_involvements ?? 0;
                    const xGC = entry.expected_goals_conceded ?? 0;

                    // FDR color
                    const fdr = entry.fixture_difficulty;
                    const fdrBg =
                      fdr === 5 ? "bg-red-700 text-white" :
                      fdr === 4 ? "bg-red-400 text-white" :
                      fdr === 3 ? "bg-amber-400 text-black" :
                      fdr === 2 ? "bg-green-400 text-black" :
                      fdr === 1 ? "bg-green-700 text-white" :
                      "bg-muted text-muted-foreground";

                    // Build stat chips — each is { icon, label, color }
                    type Chip = { icon: string; label: string; color?: string };
                    const chips: Chip[] = [];

                    // Universal stats (all positions)
                    if (redCards >= 1) chips.push({ icon: "🟥", label: String(redCards), color: "text-red-600" });
                    if (yellowCards >= 1) chips.push({ icon: "🟨", label: String(yellowCards) });
                    if (mins >= 1) chips.push({ icon: "⏱", label: `${mins}` });
                    if (goals >= 1) chips.push({ icon: "⚽", label: String(goals), color: "text-green-600 font-bold" });
                    if (assists >= 1) chips.push({ icon: "👟", label: String(assists), color: "text-blue-500" });
                    if (ownGoals >= 1) chips.push({ icon: "⚽❌", label: String(ownGoals), color: "text-red-500" });
                    if (penMissed >= 1) chips.push({ icon: "❌", label: `${penMissed}PM`, color: "text-red-500" });
                    if (bonus >= 1) chips.push({ icon: "⭐", label: String(bonus), color: "text-amber-500" });

                    // Position-specific stats
                    if (pos === 1) {
                      // GK
                      if (saves >= 3) chips.push({ icon: "🧤", label: `${saves}Sv`, color: "text-blue-600" });
                      if (cleanSheets >= 1) chips.push({ icon: "🛡️", label: "CS", color: "text-green-600" });
                      if (penSaved >= 1) chips.push({ icon: "🧤", label: `${penSaved}PSv`, color: "text-purple-600" });
                      if (goalsConceded >= 1) chips.push({ icon: "🥅", label: `${goalsConceded}GC`, color: "text-red-400" });
                      if (xGC > 0) chips.push({ icon: "", label: `xGC:${xGC.toFixed(1)}`, color: "text-muted-foreground text-[10px]" });
                    }
                    if (pos === 2) {
                      // DEF
                      if (cleanSheets >= 1) chips.push({ icon: "🛡️", label: "CS", color: "text-green-600" });
                      if (defContrib >= 10) chips.push({ icon: "🔒", label: `DR(${defContrib})`, color: "text-green-600 font-bold" });
                      else if (defContrib >= 5) chips.push({ icon: "🔒", label: `DC:${defContrib}`, color: "text-muted-foreground" });
                      if (goalsConceded >= 1) chips.push({ icon: "🥅", label: `${goalsConceded}GC`, color: "text-red-400" });
                      if (xGC > 0) chips.push({ icon: "", label: `xGC:${xGC.toFixed(1)}`, color: "text-muted-foreground text-[10px]" });
                    }
                    if (pos === 3) {
                      // MID
                      if (cleanSheets >= 1) chips.push({ icon: "🛡️", label: "CS", color: "text-green-600" });
                      if (defContrib >= 12) chips.push({ icon: "🔒", label: `DR(${defContrib})`, color: "text-green-600 font-bold" });
                      else if (defContrib >= 7) chips.push({ icon: "🔒", label: `DC:${defContrib}`, color: "text-muted-foreground" });
                      if (xG > 0) chips.push({ icon: "", label: `xG:${xG.toFixed(2)}`, color: "text-muted-foreground text-[10px]" });
                      if (xA > 0) chips.push({ icon: "", label: `xA:${xA.toFixed(2)}`, color: "text-muted-foreground text-[10px]" });
                      if (xGA > 0) chips.push({ icon: "", label: `xG+A:${xGA.toFixed(2)}`, color: "text-muted-foreground text-[10px]" });
                    }
                    if (pos === 4) {
                      // FWD
                      if (cleanSheets >= 1) chips.push({ icon: "🛡️", label: "CS", color: "text-green-600" });
                      if (defContrib >= 12) chips.push({ icon: "🔒", label: `DR(${defContrib})`, color: "text-green-600 font-bold" });
                      else if (defContrib >= 7) chips.push({ icon: "🔒", label: `DC:${defContrib}`, color: "text-muted-foreground" });
                      if (xG > 0) chips.push({ icon: "", label: `xG:${xG.toFixed(2)}`, color: "text-muted-foreground text-[10px]" });
                      if (xA > 0) chips.push({ icon: "", label: `xA:${xA.toFixed(2)}`, color: "text-muted-foreground text-[10px]" });
                      if (xGA > 0) chips.push({ icon: "", label: `xG+A:${xGA.toFixed(2)}`, color: "text-muted-foreground text-[10px]" });
                    }

                    return (
                      <div
                        key={entry.gameweek}
                        className="p-2 rounded flex justify-between items-start gap-2 bg-muted"
                      >
                        <div className="flex-1 min-w-0">
                          {/* GW header row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs">
                              GW {entry.gameweek}{entry.is_upcoming ? " (Upcoming)" : ""}
                            </span>
                            {/* FDR badge */}
                            {fdr != null && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${fdrBg}`}>
                                FDR {fdr}
                              </span>
                            )}
                            {/* Fixture info */}
                            {(entry.opponent_team_name || entry.fixture) && (
                              <span className="text-xs text-muted-foreground truncate">
                                {entry.was_home != null ? (entry.was_home ? "vs " : "@ ") : ""}
                                {entry.opponent_team_name || entry.fixture}
                                {entry.result ? ` ${entry.result}` : ""}
                              </span>
                            )}
                          </div>

                          {/* Stat chips */}
                          {chips.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {chips.map((chip, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-0.5 text-xs px-1 py-0.5 rounded bg-background ${chip.color ?? ""}`}
                                >
                                  {chip.icon && <span>{chip.icon}</span>}
                                  <span>{chip.label}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Points */}
                        {!entry.is_upcoming && (
                          <span className="font-bold text-green-600 text-sm shrink-0">
                            {Math.round(entry.points)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No history available</p>
              )}
            </div>
          )}

          {/* Close button */}
          <div className="grid grid-cols-1 gap-2">
            {onSelectCaptain && (
              <Button onClick={() => onSelectCaptain(player.player_id)} className="w-full" variant="secondary">
                Select As Captain
              </Button>
            )}
            {onSelectViceCaptain && (
              <Button onClick={() => onSelectViceCaptain(player.player_id)} className="w-full" variant="secondary">
                Select As Vice Captain
              </Button>
            )}
            <Button onClick={onClose} className="w-full mt-0" variant="outline">
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
