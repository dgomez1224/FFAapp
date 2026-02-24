# FFA Cup Tournament Logic - Implementation Specification

## Tournament Initialization

### Calculation: Starting Gameweek

```typescript
function calculateStartingGameweek(numberOfTeams: number): number {
  const GROUP_STAGE_WEEKS = 4;
  const FINAL_GAMEWEEK = 38;
  const ADVANCE_PERCENTAGE = 0.8;
  
  // Calculate number of teams advancing
  const teamsAdvancing = Math.ceil(numberOfTeams * ADVANCE_PERCENTAGE);
  
  // Calculate knockout rounds needed (each round is 2 gameweeks for two-leg format)
  const knockoutRounds = Math.ceil(Math.log2(teamsAdvancing));
  const knockoutGameweeks = knockoutRounds * 2;
  
  // Total gameweeks needed
  const totalGameweeks = GROUP_STAGE_WEEKS + knockoutGameweeks;
  
  // Starting gameweek
  const startingGameweek = FINAL_GAMEWEEK - totalGameweeks + 1;
  
  return startingGameweek;
}

// Examples:
// 10 teams → 8 advance → 3 rounds (QF, SF, F) → 6 GWs → Start: 38-(4+6)+1 = GW 29
// 20 teams → 16 advance → 4 rounds (R16, QF, SF, F) → 8 GWs → Start: 38-(4+8)+1 = GW 27
// 5 teams → 4 advance → 2 rounds (SF, F) → 4 GWs → Start: 38-(4+4)+1 = GW 31
```

### Tournament Structure Metadata

```typescript
interface TournamentStructure {
  totalTeams: number;
  groupStageStart: number;      // e.g., GW 29
  groupStageEnd: number;         // e.g., GW 32
  teamsAdvancing: number;        // ceil(0.8 * totalTeams)
  knockoutRounds: Array<{
    round: string;               // 'R16', 'QF', 'SF', 'F'
    leg1Gameweek: number;
    leg2Gameweek: number;
    matchupsCount: number;       // teams/2 for that round
  }>;
}

function generateTournamentStructure(
  numberOfTeams: number,
  startGameweek: number
): TournamentStructure {
  const teamsAdvancing = Math.ceil(numberOfTeams * 0.8);
  const rounds = [];
  let currentGw = startGameweek + 4; // After group stage
  let teamsInRound = teamsAdvancing;
  
  const roundNames = ['R32', 'R16', 'QF', 'SF', 'F'];
  let roundIndex = roundNames.length - Math.ceil(Math.log2(teamsAdvancing));
  
  while (teamsInRound >= 2) {
    rounds.push({
      round: roundNames[roundIndex],
      leg1Gameweek: currentGw,
      leg2Gameweek: currentGw + 1,
      matchupsCount: teamsInRound / 2
    });
    
    currentGw += 2;
    teamsInRound /= 2;
    roundIndex++;
  }
  
  return {
    totalTeams: numberOfTeams,
    groupStageStart: startGameweek,
    groupStageEnd: startGameweek + 3,
    teamsAdvancing,
    knockoutRounds: rounds
  };
}
```

---

## Group Stage Scoring

### Captain Selection Logic

```typescript
interface CaptainSelection {
  teamId: string;
  gameweek: number;
  captainElementId: number;
  viceCaptainElementId: number;
  validatedAt: Date | null;
}

async function applyCaptainSelection(
  teamId: string,
  gameweek: number,
  captainSelection?: CaptainSelection
): Promise<{ captainId: number; viceCaptainId: number }> {
  
  // Step 1: Check if captain selected for this gameweek
  if (captainSelection && captainSelection.validatedAt) {
    return {
      captainId: captainSelection.captainElementId,
      viceCaptainId: captainSelection.viceCaptainElementId
    };
  }
  
  // Step 2: No selection for current GW, check previous GW
  const previousGw = gameweek - 1;
  const previousSelection = await db.captain_selections
    .where({ teamId, gameweek: previousGw })
    .first();
  
  if (previousSelection && previousSelection.validatedAt) {
    // Apply previous captain selection
    console.log(`Team ${teamId} GW${gameweek}: Using previous captain from GW${previousGw}`);
    return {
      captainId: previousSelection.captainElementId,
      viceCaptainId: previousSelection.viceCaptainElementId
    };
  }
  
  // Step 3: No valid captain found - forfeit captaincy
  console.log(`Team ${teamId} GW${gameweek}: No valid captain - captaincy forfeited`);
  return {
    captainId: null,
    viceCaptainId: null
  };
}
```

### Roster Validation (API-Driven)

```typescript
async function validateCaptainAgainstRoster(
  entryId: number,
  gameweek: number,
  captainElementId: number,
  viceCaptainElementId: number
): Promise<{ valid: boolean; error?: string; availablePlayers?: number[] }> {
  
  // Fetch squad from FPL API
  const squadResponse = await fplApiClient.getSquad(entryId, gameweek);
  
  if (!squadResponse.ok) {
    return {
      valid: false,
      error: 'Unable to fetch squad from FPL API. Please try again.'
    };
  }
  
  const { picks } = squadResponse.data;
  const playerIds = picks.map(p => p.element);
  
  // Validate captain is in squad
  if (!playerIds.includes(captainElementId)) {
    return {
      valid: false,
      error: `Captain (ID: ${captainElementId}) is not in your squad for GW${gameweek}.`,
      availablePlayers: playerIds
    };
  }
  
  // Validate vice-captain is in squad
  if (!playerIds.includes(viceCaptainElementId)) {
    return {
      valid: false,
      error: `Vice-Captain (ID: ${viceCaptainElementId}) is not in your squad for GW${gameweek}.`,
      availablePlayers: playerIds
    };
  }
  
  // Validate captain ≠ vice-captain
  if (captainElementId === viceCaptainElementId) {
    return {
      valid: false,
      error: 'Captain and Vice-Captain must be different players.'
    };
  }
  
  return { valid: true };
}
```

### Gameweek Score Calculation (API-Driven)

```typescript
interface GameweekScoreCalculation {
  totalPoints: number;
  captainPoints: number;      // Points contributed by captain (after 2x)
  benchPoints: number;
  breakdown: Array<{
    playerId: number;
    playerName: string;
    points: number;
    isCaptain: boolean;
    isViceCaptain: boolean;
    multiplier: number;
  }>;
}

async function calculateGameweekScore(
  entryId: number,
  gameweek: number,
  captainSelection: { captainId: number | null; viceCaptainId: number | null }
): Promise<GameweekScoreCalculation> {
  
  // Fetch squad (who played)
  const squadResponse = await fplApiClient.getSquad(entryId, gameweek);
  const { picks } = squadResponse.data;
  
  // Fetch live player stats
  const liveResponse = await fplApiClient.getLiveGameweek(gameweek);
  const playerStats = liveResponse.data.elements;
  
  // Fetch player names from bootstrap-static (cached)
  const bootstrap = await fplApiClient.getBootstrapStatic();
  const playerMap = new Map(
    bootstrap.data.elements.map(p => [p.id, p.web_name])
  );
  
  let totalPoints = 0;
  let captainPoints = 0;
  let benchPoints = 0;
  const breakdown = [];
  
  for (const pick of picks) {
    const playerId = pick.element;
    const stats = playerStats.find(s => s.id === playerId);
    const rawPoints = stats?.stats?.total_points || 0;
    
    let multiplier = 1;
    let isCaptain = false;
    let isViceCaptain = false;
    
    // Apply captain multiplier
    if (captainSelection.captainId && playerId === captainSelection.captainId) {
      multiplier = 2;
      isCaptain = true;
    }
    
    if (captainSelection.viceCaptainId && playerId === captainSelection.viceCaptainId) {
      isViceCaptain = true;
    }
    
    const finalPoints = rawPoints * multiplier;
    
    // FFA Cup Rule: All players count (starters + bench)
    totalPoints += finalPoints;
    
    if (isCaptain) {
      captainPoints = finalPoints; // Already multiplied by 2
    }
    
    // Track bench separately for analytics
    if (pick.position > 11) {
      benchPoints += finalPoints;
    }
    
    breakdown.push({
      playerId,
      playerName: playerMap.get(playerId) || 'Unknown',
      points: rawPoints,
      isCaptain,
      isViceCaptain,
      multiplier
    });
  }
  
  return {
    totalPoints,
    captainPoints,
    benchPoints,
    breakdown
  };
}
```

### Group Stage Final Ranking

```typescript
interface GroupStageResult {
  teamId: string;
  totalPoints: number;
  captainPointsSum: number;
  rank: number;
  advancing: boolean;
}

async function calculateGroupStageStandings(
  tournamentId: string
): Promise<GroupStageResult[]> {
  
  // Fetch tournament config
  const tournament = await db.tournaments.get(tournamentId);
  const { start_gameweek, group_stage_gameweeks, teams_advance_pct } = tournament;
  const endGameweek = start_gameweek + group_stage_gameweeks - 1;
  
  // Aggregate scores for all teams
  const standings = await db.gameweek_scores
    .where('tournament_id', tournamentId)
    .whereBetween('gameweek', [start_gameweek, endGameweek])
    .groupBy('team_id')
    .select(
      'team_id',
      db.raw('SUM(total_points) as total_points'),
      db.raw('SUM(captain_points) as captain_points_sum')
    );
  
  // Sort by total points DESC, then captain points DESC
  standings.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    return b.captain_points_sum - a.captain_points_sum;
  });
  
  // Assign ranks and determine advancing teams
  const totalTeams = standings.length;
  const advancingCount = Math.ceil(totalTeams * teams_advance_pct);
  
  const results: GroupStageResult[] = standings.map((team, index) => ({
    teamId: team.team_id,
    totalPoints: team.total_points,
    captainPointsSum: team.captain_points_sum,
    rank: index + 1,
    advancing: index < advancingCount
  }));
  
  // Update teams table with seeds
  for (const result of results) {
    await db.teams
      .where('id', result.teamId)
      .update({
        seed: result.rank,
        group_stage_points: result.totalPoints,
        group_stage_captain_points: result.captainPointsSum
      });
  }
  
  return results;
}
```

---

## Knockout Stage Logic

### Bracket Generation (Seeding-Based)

```typescript
interface MatchupPairing {
  round: string;
  matchupNumber: number;
  team1Seed: number;
  team2Seed: number;
  team1Id: string;
  team2Id: string;
  leg1Gameweek: number;
  leg2Gameweek: number;
}

async function generateKnockoutBracket(
  tournamentId: string,
  structure: TournamentStructure
): Promise<MatchupPairing[]> {
  
  // Fetch advancing teams sorted by seed
  const advancingTeams = await db.teams
    .where('tournament_id', tournamentId)
    .where('seed', '<=', structure.teamsAdvancing)
    .orderBy('seed', 'asc');
  
  const matchups: MatchupPairing[] = [];
  
  // Generate first round pairings
  const firstRound = structure.knockoutRounds[0];
  const teamsInRound = advancingTeams.length;
  
  for (let i = 0; i < teamsInRound / 2; i++) {
    const higherSeed = advancingTeams[i];
    const lowerSeed = advancingTeams[teamsInRound - 1 - i];
    
    matchups.push({
      round: firstRound.round,
      matchupNumber: i + 1,
      team1Seed: higherSeed.seed,
      team2Seed: lowerSeed.seed,
      team1Id: higherSeed.id,
      team2Id: lowerSeed.id,
      leg1Gameweek: firstRound.leg1Gameweek,
      leg2Gameweek: firstRound.leg2Gameweek
    });
  }
  
  // Create placeholder matchups for future rounds
  for (let roundIdx = 1; roundIdx < structure.knockoutRounds.length; roundIdx++) {
    const round = structure.knockoutRounds[roundIdx];
    
    for (let i = 0; i < round.matchupsCount; i++) {
      matchups.push({
        round: round.round,
        matchupNumber: i + 1,
        team1Seed: null, // TBD
        team2Seed: null, // TBD
        team1Id: null,
        team2Id: null,
        leg1Gameweek: round.leg1Gameweek,
        leg2Gameweek: round.leg2Gameweek
      });
    }
  }
  
  // Insert matchups into database
  for (const matchup of matchups) {
    await db.matchups.insert({
      tournament_id: tournamentId,
      round: matchup.round,
      matchup_number: matchup.matchupNumber,
      team_1_id: matchup.team1Id,
      team_2_id: matchup.team2Id,
      leg_1_gameweek: matchup.leg1Gameweek,
      leg_2_gameweek: matchup.leg2Gameweek,
      status: matchup.team1Id ? 'pending' : 'awaiting_teams'
    });
  }
  
  return matchups;
}
```

### Matchup Winner Determination

```typescript
interface TieBreakerResult {
  winner: 'team_1' | 'team_2';
  method: 'aggregate' | 'highest_gw' | 'captain_sum';
  team1Aggregate: number;
  team2Aggregate: number;
  team1HighestGw?: number;
  team2HighestGw?: number;
  team1CaptainSum?: number;
  team2CaptainSum?: number;
}

async function determineMatchupWinner(
  matchupId: string
): Promise<TieBreakerResult> {
  
  const matchup = await db.matchups.get(matchupId);
  
  // Calculate aggregates
  const team1Aggregate = matchup.team_1_leg_1_points + matchup.team_1_leg_2_points;
  const team2Aggregate = matchup.team_2_leg_1_points + matchup.team_2_leg_2_points;
  
  // Check if aggregate scores differ
  if (team1Aggregate !== team2Aggregate) {
    const winner = team1Aggregate > team2Aggregate ? 'team_1' : 'team_2';
    
    await db.matchups.update(matchupId, {
      winner_id: winner === 'team_1' ? matchup.team_1_id : matchup.team_2_id,
      tie_breaker_applied: null,
      status: 'complete'
    });
    
    return {
      winner,
      method: 'aggregate',
      team1Aggregate,
      team2Aggregate
    };
  }
  
  // Tie-breaker 1: Highest single gameweek score
  const team1HighestGw = Math.max(
    matchup.team_1_leg_1_points,
    matchup.team_1_leg_2_points
  );
  const team2HighestGw = Math.max(
    matchup.team_2_leg_1_points,
    matchup.team_2_leg_2_points
  );
  
  if (team1HighestGw !== team2HighestGw) {
    const winner = team1HighestGw > team2HighestGw ? 'team_1' : 'team_2';
    
    await db.matchups.update(matchupId, {
      winner_id: winner === 'team_1' ? matchup.team_1_id : matchup.team_2_id,
      tie_breaker_applied: 'highest_gw',
      status: 'complete'
    });
    
    return {
      winner,
      method: 'highest_gw',
      team1Aggregate,
      team2Aggregate,
      team1HighestGw,
      team2HighestGw
    };
  }
  
  // Tie-breaker 2: Sum of captain points across both legs
  const team1CaptainSum = await db.gameweek_scores
    .where('team_id', matchup.team_1_id)
    .whereIn('gameweek', [matchup.leg_1_gameweek, matchup.leg_2_gameweek])
    .sum('captain_points');
  
  const team2CaptainSum = await db.gameweek_scores
    .where('team_id', matchup.team_2_id)
    .whereIn('gameweek', [matchup.leg_1_gameweek, matchup.leg_2_gameweek])
    .sum('captain_points');
  
  const winner = team1CaptainSum > team2CaptainSum ? 'team_1' : 'team_2';
  
  await db.matchups.update(matchupId, {
    winner_id: winner === 'team_1' ? matchup.team_1_id : matchup.team_2_id,
    tie_breaker_applied: 'captain_sum',
    status: 'complete'
  });
  
  return {
    winner,
    method: 'captain_sum',
    team1Aggregate,
    team2Aggregate,
    team1HighestGw,
    team2HighestGw,
    team1CaptainSum,
    team2CaptainSum
  };
}
```

### Advancing Winners to Next Round

```typescript
async function advanceWinnerToNextRound(
  completedMatchupId: string,
  winnerId: string
): Promise<void> {
  
  const completedMatchup = await db.matchups.get(completedMatchupId);
  const currentRound = completedMatchup.round;
  
  // Determine next round
  const roundOrder = ['R32', 'R16', 'QF', 'SF', 'F'];
  const currentRoundIndex = roundOrder.indexOf(currentRound);
  
  if (currentRoundIndex === roundOrder.length - 1) {
    // This was the final - no next round
    console.log(`Tournament complete! Winner: ${winnerId}`);
    await db.tournaments.update(completedMatchup.tournament_id, {
      status: 'completed'
    });
    return;
  }
  
  const nextRound = roundOrder[currentRoundIndex + 1];
  
  // Find the next matchup position
  // Even matchup numbers (2, 4, 6...) feed team_1
  // Odd matchup numbers (1, 3, 5...) feed team_2
  const nextMatchupNumber = Math.ceil(completedMatchup.matchup_number / 2);
  const isTeam1Slot = completedMatchup.matchup_number % 2 === 1;
  
  const nextMatchup = await db.matchups
    .where('tournament_id', completedMatchup.tournament_id)
    .where('round', nextRound)
    .where('matchup_number', nextMatchupNumber)
    .first();
  
  // Update next matchup with winner
  const updateField = isTeam1Slot ? 'team_1_id' : 'team_2_id';
  await db.matchups.update(nextMatchup.id, {
    [updateField]: winnerId,
    status: nextMatchup.team_1_id && nextMatchup.team_2_id ? 'pending' : 'awaiting_teams'
  });
  
  console.log(`Advanced winner ${winnerId} to ${nextRound} Match ${nextMatchupNumber}`);
}
```

---

## Automated Workflow (Edge Functions)

### Cron Job: Update Live Scores

```typescript
// Supabase Edge Function: update-live-scores
// Triggered every 90 seconds during active gameweeks

export async function updateLiveScores() {
  const now = new Date();
  
  // Check if there's an active tournament
  const activeTournaments = await db.tournaments
    .whereIn('status', ['group_stage', 'knockout'])
    .all();
  
  if (activeTournaments.length === 0) {
    console.log('No active tournaments');
    return;
  }
  
  // Determine current gameweek from FPL API
  const bootstrap = await fplApiClient.getBootstrapStatic();
  const currentEvent = bootstrap.data.events.find(e => e.is_current);
  
  if (!currentEvent) {
    console.log('No active gameweek');
    return;
  }
  
  const currentGameweek = currentEvent.id;
  
  // For each active tournament
  for (const tournament of activeTournaments) {
    // Check if current GW is within tournament range
    if (currentGameweek < tournament.start_gameweek || 
        currentGameweek > tournament.end_gameweek) {
      continue;
    }
    
    // Fetch all teams in tournament
    const teams = await db.teams
      .where('tournament_id', tournament.id)
      .all();
    
    // Calculate scores for each team
    for (const team of teams) {
      try {
        // Get captain selection
        const captainSelection = await db.captain_selections
          .where('team_id', team.id)
          .where('gameweek', currentGameweek)
          .first();
        
        const { captainId, viceCaptainId } = await applyCaptainSelection(
          team.id,
          currentGameweek,
          captainSelection
        );
        
        // Calculate score
        const scoreCalc = await calculateGameweekScore(
          team.entry_id,
          currentGameweek,
          { captainId, viceCaptainId }
        );
        
        // Upsert gameweek_scores
        await db.gameweek_scores.upsert({
          team_id: team.id,
          tournament_id: tournament.id,
          gameweek: currentGameweek,
          total_points: scoreCalc.totalPoints,
          captain_points: scoreCalc.captainPoints,
          bench_points: scoreCalc.benchPoints,
          captain_element_id: captainId,
          vice_captain_element_id: viceCaptainId,
          raw_data: scoreCalc.breakdown,
          calculated_at: new Date()
        });
        
        console.log(`Updated score for team ${team.id} GW${currentGameweek}: ${scoreCalc.totalPoints}`);
        
      } catch (error) {
        console.error(`Error calculating score for team ${team.id}:`, error);
        // Continue with other teams
      }
    }
  }
  
  // Check if gameweek is finalized
  if (currentEvent.data_checked) {
    await finalizeGameweek(currentGameweek);
  }
}
```

### Workflow: Finalize Gameweek

```typescript
async function finalizeGameweek(gameweek: number) {
  console.log(`Finalizing gameweek ${gameweek}`);
  
  // Check if any tournament's group stage ends on this gameweek
  const tournamentsEndingGroupStage = await db.tournaments
    .where('group_stage_end', gameweek)
    .where('status', 'group_stage')
    .all();
  
  for (const tournament of tournamentsEndingGroupStage) {
    console.log(`Finalizing group stage for tournament ${tournament.id}`);
    
    // Calculate final standings
    const standings = await calculateGroupStageStandings(tournament.id);
    
    // Generate knockout bracket
    const structure = await db.tournaments.get(tournament.id);
    await generateKnockoutBracket(tournament.id, structure);
    
    // Update tournament status
    await db.tournaments.update(tournament.id, {
      status: 'knockout'
    });
    
    // Notify all teams
    // (Send email/notification that group stage is complete)
  }
  
  // Check if any knockout leg 2 completes on this gameweek
  const matchupsCompleting = await db.matchups
    .where('leg_2_gameweek', gameweek)
    .where('status', 'leg_1_complete')
    .all();
  
  for (const matchup of matchupsCompleting) {
    console.log(`Resolving matchup ${matchup.id}`);
    
    // Determine winner
    const result = await determineMatchupWinner(matchup.id);
    
    // Advance winner to next round
    const winnerId = result.winner === 'team_1' ? matchup.team_1_id : matchup.team_2_id;
    await advanceWinnerToNextRound(matchup.id, winnerId);
    
    // Update losing team's elimination round
    const loserId = result.winner === 'team_1' ? matchup.team_2_id : matchup.team_1_id;
    await db.teams.update(loserId, {
      eliminated_at: matchup.round
    });
  }
}
```

---

## Data Integrity Checks

### Validation Before Each Calculation

```typescript
async function validateTournamentIntegrity(tournamentId: string): Promise<boolean> {
  const errors = [];
  
  // 1. Verify all teams have valid entry IDs
  const teams = await db.teams.where('tournament_id', tournamentId).all();
  
  for (const team of teams) {
    const apiCheck = await fplApiClient.getEntry(team.entry_id);
    if (!apiCheck.ok) {
      errors.push(`Team ${team.id} has invalid entry_id ${team.entry_id}`);
    }
  }
  
  // 2. Verify no duplicate captain selections for same (team, gameweek)
  const duplicateCaptains = await db.raw(`
    SELECT team_id, gameweek, COUNT(*) as count
    FROM captain_selections
    WHERE tournament_id = ?
    GROUP BY team_id, gameweek
    HAVING COUNT(*) > 1
  `, [tournamentId]);
  
  if (duplicateCaptains.length > 0) {
    errors.push(`Duplicate captain selections found: ${JSON.stringify(duplicateCaptains)}`);
  }
  
  // 3. Verify all matchups reference valid teams
  const matchups = await db.matchups.where('tournament_id', tournamentId).all();
  
  for (const matchup of matchups) {
    if (matchup.team_1_id) {
      const team1Exists = teams.find(t => t.id === matchup.team_1_id);
      if (!team1Exists) {
        errors.push(`Matchup ${matchup.id} references invalid team_1_id ${matchup.team_1_id}`);
      }
    }
    if (matchup.team_2_id) {
      const team2Exists = teams.find(t => t.id === matchup.team_2_id);
      if (!team2Exists) {
        errors.push(`Matchup ${matchup.id} references invalid team_2_id ${matchup.team_2_id}`);
      }
    }
  }
  
  // 4. Verify tournament gameweeks are valid
  const tournament = await db.tournaments.get(tournamentId);
  if (tournament.end_gameweek !== 38) {
    errors.push(`Tournament end_gameweek is ${tournament.end_gameweek}, expected 38`);
  }
  
  if (errors.length > 0) {
    console.error('Tournament integrity check failed:', errors);
    return false;
  }
  
  return true;
}
```

---

## Summary: Key Logic Guarantees

✅ **Tournament always ends on GW38:** Calculated via `38 - (4 + knockoutGWs) + 1`  
✅ **Captain doubling:** Applied only if valid selection exists (current or previous GW)  
✅ **Bench points counted:** All 15 players' points summed (per FFA rules)  
✅ **Tie-breakers applied in order:** Aggregate → Highest GW → Captain sum  
✅ **Roster validation:** Every captain selection verified against live FPL API data  
✅ **No placeholder data:** All scores calculated from `/event/{id}/live` endpoint  
✅ **Automated progression:** Winners advance to next round automatically  
✅ **Data integrity:** Pre-calculation validation ensures referential integrity  

This tournament logic specification provides a complete, deterministic implementation that relies entirely on the FPL Draft API for core data while maintaining tournament-specific metadata in the application database.
