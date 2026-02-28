/**
 * Player Stats Modal
 * Shows detailed player stats when clicking on a player in the pitch
 */

import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export interface PlayerStats {
  player_id: number;
  player_name: string;
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
    assists?: number;
    minutes?: number;
    clean_sheets?: number;
    goals_conceded?: number;
    penalties_saved?: number;
    penalties_missed?: number;
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Close button */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">{player.player_name}</h2>
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
              <h3 className="font-semibold mb-3">Gameweek History</h3>
              {player.history && player.history.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {player.history.map((entry) => {
                      const statParts: string[] = [];
                      if ((entry.goals ?? 0) >= 1) statParts.push(`${entry.goals}G`);
                      if ((entry.assists ?? 0) >= 1) statParts.push(`${entry.assists}A`);
                      if ((entry.minutes ?? 0) >= 1) statParts.push(`${entry.minutes}M`);
                      if ((entry.clean_sheets ?? 0) >= 1) statParts.push(`${entry.clean_sheets}CS`);
                      if ((entry.goals_conceded ?? 0) >= 1) statParts.push(`${entry.goals_conceded}GC`);
                      if ((entry.penalties_saved ?? 0) >= 1) statParts.push(`${entry.penalties_saved}PSv`);
                      if ((entry.penalties_missed ?? 0) >= 1) statParts.push(`${entry.penalties_missed}PM`);
                      return (
                        <div key={entry.gameweek} className="p-2 bg-muted rounded flex justify-between items-center">
                          <div>
                            <p className="font-medium">GW {entry.gameweek}{entry.is_upcoming ? " (Upcoming)" : ""}</p>
                            {(entry.opponent_team_name || entry.fixture || entry.result) && (
                              <p className="text-xs text-muted-foreground">
                                {entry.was_home != null ? (entry.was_home ? "vs " : "@ ") : ""}
                                {entry.opponent_team_name || entry.fixture || "Fixture"}
                                {entry.fixture_difficulty != null ? ` (FDR: ${entry.fixture_difficulty})` : ""}
                                {entry.result ? ` • ${entry.result}` : ""}
                              </p>
                            )}
                            {statParts.length > 0 && (
                              <p className="text-xs text-muted-foreground">{statParts.join(" ")}</p>
                            )}
                          </div>
                          {!entry.is_upcoming ? <p className="font-bold text-green-600">{Math.round(entry.points)}</p> : null}
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
