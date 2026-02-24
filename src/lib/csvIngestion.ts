/**
 * CSV Ingestion Utilities
 * 
 * Handles parsing and normalizing CSV data for legacy statistics.
 * 
 * Key Rules:
 * - Only ALL TIME LEADERS.csv includes manager_name column
 * - All other CSVs use index-based alignment to canonical managers
 * - Manager order in CSVs matches canonical list exactly
 * - Season 2025/26 is excluded from imports
 */

import { CANONICAL_MANAGERS, normalizeManagerName, getManagerByIndex, type CanonicalManager } from "./canonicalManagers";
import { HISTORICAL_STATS_CUTOFF_SEASON } from "./constants";

export interface ParsedCSVRow {
  [key: string]: string | number | null;
}

/**
 * Parses a CSV string into rows
 * Handles quoted fields and commas within quotes
 */
export function parseCSV(csvContent: string): ParsedCSVRow[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse header
  const header = parseCSVLine(lines[0]);
  const rows: ParsedCSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: ParsedCSVRow = {};
    header.forEach((col, idx) => {
      const value = values[idx]?.trim() || '';
      // Try to parse as number if possible
      const numValue = parseFloat(value);
      row[col] = isNaN(numValue) || value !== String(numValue) ? value : numValue;
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parses a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result.map(field => field.trim().replace(/^"|"$/g, ''));
}

/**
 * Maps index-based CSV rows to canonical managers
 * Used when CSV doesn't have manager_name column
 */
export function mapRowsToManagers<T extends ParsedCSVRow>(
  rows: T[],
  managerIndexColumn?: string
): Array<T & { manager_name: CanonicalManager }> {
  return rows
    .map((row, index) => {
      let managerName: CanonicalManager | null = null;

      // If CSV has manager_name column, use it
      if (managerIndexColumn && row[managerIndexColumn]) {
        managerName = normalizeManagerName(String(row[managerIndexColumn]));
      } else {
        // Otherwise, use index-based mapping
        managerName = getManagerByIndex(index);
      }

      if (!managerName) {
        console.warn(`Could not map row ${index} to canonical manager`);
        return null;
      }

      return {
        ...row,
        manager_name: managerName,
      };
    })
    .filter((row): row is T & { manager_name: CanonicalManager } => row !== null);
}

/**
 * Filters out current season (2025/26) from data
 */
export function filterCurrentSeason<T extends { season?: string }>(
  data: T[]
): T[] {
  return data.filter(row => {
    const season = row.season;
    if (!season) return true; // Keep rows without season
    return season < HISTORICAL_STATS_CUTOFF_SEASON;
  });
}

/**
 * Parses season standings from Home.csv format
 * Format: Rank, Manager Name, W, D, L, +, PTS
 */
export interface SeasonStandingRow {
  season: string;
  manager_name: CanonicalManager;
  final_rank: number;
  wins: number;
  draws: number;
  losses: number;
  points_for: number;
  points: number;
  competition_type: 'league' | 'goblet';
}

export function parseSeasonStandings(
  csvContent: string,
  season: string
): SeasonStandingRow[] {
  const rows = parseCSV(csvContent);
  const standings: SeasonStandingRow[] = [];

  // Find rows that match the season standings format
  // Look for rows with rank (C or number) and manager name
  rows.forEach((row, index) => {
    // Check if this looks like a standings row
    const rankStr = String(row[0] || '').trim();
    const managerNameStr = String(row[1] || '').trim().toUpperCase();
    
    if (!rankStr || !managerNameStr) return;

    // Parse rank (C = 1, or number)
    let rank = 0;
    if (rankStr === 'C' || rankStr === '1') {
      rank = 1;
    } else {
      const parsed = parseInt(rankStr);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
        rank = parsed;
      } else {
        return; // Not a valid standings row
      }
    }

    const managerName = normalizeManagerName(managerNameStr);
    if (!managerName) return;

    // Parse stats (columns vary by CSV structure)
    const wins = parseInt(String(row[2] || 0)) || 0;
    const draws = parseInt(String(row[3] || 0)) || 0;
    const losses = parseInt(String(row[4] || 0)) || 0;
    const pointsFor = parseInt(String(row[5] || 0)) || 0;
    const points = parseInt(String(row[6] || 0)) || 0;

    // Determine competition type from context (league vs goblet)
    // This may need adjustment based on actual CSV structure
    const competitionType: 'league' | 'goblet' = 'league'; // Default, may need detection

    standings.push({
      season,
      manager_name: managerName,
      final_rank: rank,
      wins,
      draws,
      losses,
      points_for: pointsFor,
      points,
      competition_type: competitionType,
    });
  });

  return standings;
}

/**
 * Parses all-time stats from ALL TIME LEADERS.csv
 * This CSV has manager_name column explicitly
 */
export interface AllTimeStatsRow {
  manager_name: CanonicalManager;
  wins: number;
  losses: number;
  draws: number;
  total_points: number;
  points_plus: number;
  total_transactions: number;
  points_per_game: number;
  league_titles: number;
  cup_wins: number;
  goblet_wins: number;
  fifty_plus_weeks: number;
  sub_twenty_weeks: number;
  largest_margin_win: number;
  largest_margin_loss: number;
  avg_margin_win: number;
  avg_margin_loss: number;
  longest_win_streak: number;
  longest_loss_streak: number;
  longest_undefeated_streak: number;
  elo_rating: number;
}

export function parseAllTimeStats(csvContent: string): AllTimeStatsRow[] {
  const rows = parseCSV(csvContent);
  const stats: AllTimeStatsRow[] = [];

  // Find the section with all-time stats
  // Look for rows with manager_name column
  rows.forEach((row) => {
    const managerNameStr = String(row.manager_name || row['manager_name'] || '').trim();
    if (!managerNameStr) return;

    const managerName = normalizeManagerName(managerNameStr);
    if (!managerName) {
      console.warn(`Invalid manager name: ${managerNameStr}`);
      return;
    }

    stats.push({
      manager_name: managerName,
      wins: parseInt(String(row.WINS || row.wins || 0)) || 0,
      losses: parseInt(String(row.LOSSES || row.losses || 0)) || 0,
      draws: parseInt(String(row.DRAWS || row.draws || 0)) || 0,
      total_points: parseInt(String(row.POINTS || row.points || 0)) || 0,
      points_plus: parseInt(String(row['+'] || row.plus || 0)) || 0,
      total_transactions: parseInt(String(row.TRANSACTIONS || row.transactions || 0)) || 0,
      points_per_game: parseFloat(String(row.PPG || row.ppg || 0)) || 0,
      league_titles: parseInt(String(row['League Titles'] || row.league_titles || 0)) || 0,
      cup_wins: parseInt(String(row['FFA Cups'] || row.cup_wins || 0)) || 0,
      goblet_wins: parseInt(String(row.Goblets || row.goblets || 0)) || 0,
      fifty_plus_weeks: parseInt(String(row['50+ PTS'] || row.fifty_plus_weeks || 0)) || 0,
      sub_twenty_weeks: parseInt(String(row['20- PTS'] || row.sub_twenty_weeks || 0)) || 0,
      largest_margin_win: parseFloat(String(row['Margin Win'] || row.largest_margin_win || 0)) || 0,
      largest_margin_loss: parseFloat(String(row['Margin Loss'] || row.largest_margin_loss || 0)) || 0,
      avg_margin_win: parseFloat(String(row['Avg MARGIN OF VICTORY'] || row.avg_margin_win || 0)) || 0,
      avg_margin_loss: parseFloat(String(row['Avg MARGIN OF DEFEAT'] || row.avg_margin_loss || 0)) || 0,
      longest_win_streak: parseInt(String(row['LONGEST W STREAK'] || row.longest_win_streak || 0)) || 0,
      longest_loss_streak: parseInt(String(row['LONGEST L STREAK'] || row.longest_loss_streak || 0)) || 0,
      longest_undefeated_streak: parseInt(String(row['LONGEST UNDEFEATED STREAK'] || row.longest_undefeated_streak || 0)) || 0,
      elo_rating: parseFloat(String(row.ELO || row.elo_rating || 0)) || 0,
    });
  });

  return stats;
}

/**
 * Parses H2H stats from manager profile CSV
 */
export interface H2HStatsRow {
  manager_name: CanonicalManager;
  opponent_name: CanonicalManager;
  season: string | null; // null for all-time
  wins: number;
  draws: number;
  losses: number;
  avg_points: number;
  games_played: number;
}

export function parseH2HStats(
  csvContent: string,
  managerName: CanonicalManager,
  season: string | null = null
): H2HStatsRow[] {
  const rows = parseCSV(csvContent);
  const h2hStats: H2HStatsRow[] = [];

  // Look for H2H record sections
  // Format varies, but typically has opponent names and W/D/L
  rows.forEach((row) => {
    // This will need to be customized based on actual CSV structure
    // For now, placeholder implementation
  });

  return h2hStats;
}

/**
 * Validates that all managers in data are canonical
 */
export function validateCanonicalManagers<T extends { manager_name: string }>(
  data: T[]
): { valid: T[]; invalid: Array<{ row: T; reason: string }> } {
  const valid: T[] = [];
  const invalid: Array<{ row: T; reason: string }> = [];

  data.forEach((row) => {
    const managerName = normalizeManagerName(row.manager_name);
    if (!managerName) {
      invalid.push({
        row,
        reason: `Invalid manager name: ${row.manager_name}`,
      });
    } else {
      valid.push({ ...row, manager_name: managerName } as T);
    }
  });

  return { valid, invalid };
}
