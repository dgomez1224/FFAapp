# FFA Cup System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              React + TypeScript Frontend                  │   │
│  │  • Real-time Dashboard (Live Scores)                      │   │
│  │  • Group Stage Standings                                  │   │
│  │  • Knockout Bracket Viewer                                │   │
│  │  • Captain Selection Interface                            │   │
│  │  • Admin Panel (Tournament Setup)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│  ┌─────────────────────┐       ┌─────────────────────────────┐  │
│  │  Supabase Backend   │       │   Edge Functions/API       │  │
│  │  • Authentication   │←─────→│   • Score Calculator       │  │
│  │  • Database (PG)    │       │   • Bracket Generator      │  │
│  │  • Row-Level Sec.   │       │   • Captain Validator      │  │
│  │  • Realtime         │       │   • API Orchestrator       │  │
│  └─────────────────────┘       └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      INTEGRATION LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            FPL Draft API Client (Polling)                 │   │
│  │  • Exponential Backoff                                    │   │
│  │  • Rate Limiting (1 req/sec)                              │   │
│  │  • Response Caching (Redis-compatible)                    │   │
│  │  • Error Handling & Circuit Breaker                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICE                            │
│                   FPL Draft API (Public)                         │
│            https://draft.premierleague.com/api                   │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack Justification

### Frontend: React + TypeScript + Vite
**Rationale:**
- **Real-time updates:** React state management + Supabase Realtime subscriptions
- **Type safety:** TypeScript prevents runtime errors with complex tournament logic
- **Performance:** Vite for fast development and optimized production builds
- **Component reusability:** Modular UI for standings, brackets, matchups

**Key Libraries:**
- **Recharts:** Live scoring graphs and analytics
- **Lucide React:** Consistent iconography
- **Motion (Framer Motion):** Smooth bracket transitions and score animations
- **date-fns:** Gameweek deadline countdown timers

### Backend: Supabase
**Rationale:**
- **PostgreSQL:** ACID compliance for tournament integrity (brackets, scores)
- **Row-Level Security:** Restrict captain selections to team owners only
- **Realtime Subscriptions:** Push live score updates to all connected clients
- **Edge Functions:** Serverless functions for score calculation without server management
- **Built-in Auth:** Simple authentication via Entry ID validation

**Why Not Alternatives:**
- Firebase: Less powerful query capabilities for complex tournament logic
- Custom Node.js: Requires server management, scaling, and websocket infrastructure
- AWS Amplify: More complex setup, higher operational overhead

### API Integration Layer
**Pattern:** Polling with Intelligent Caching

**Components:**
1. **API Client Service**
   - Centralized fetch wrapper with retry logic
   - Request deduplication (prevent duplicate concurrent calls)
   - Automatic rate limiting queue

2. **Cache Layer (Supabase Edge Functions + KV)**
   - Bootstrap data: 24hr TTL
   - Live scores: 90sec TTL during matches
   - Squad data: 1hr TTL

3. **Polling Scheduler (Edge Function with Cron)**
   - Active gameweek: Poll every 90 seconds
   - Off-peak: Poll every 5 minutes
   - Triggered by Supabase Database Webhooks

### Database: PostgreSQL (via Supabase)
**Key Features Used:**
- **Materialized Views:** Pre-calculated group standings refreshed on score update
- **Triggers:** Auto-calculate aggregates when gameweek_scores inserted
- **Foreign Keys:** Referential integrity for tournament structure
- **JSONB:** Store raw API responses for audit and debugging

## Data Flow Diagrams

### 1. Captain Selection Flow
```
User selects captain → Frontend validates locally → 
  ↓
Supabase Edge Function: validateCaptainSelection()
  ↓
Fetch squad from FPL API: /entry/{entry_id}/event/{gameweek}
  ↓
Extract player IDs from picks array
  ↓
Verify captain & vice-captain are in squad ──→ Invalid → Return error
  ↓ Valid
Save to captain_selections table (RLS: user owns team)
  ↓
Return success + broadcast realtime update
```

### 2. Live Scoring Flow (During Gameweek)
```
Cron trigger (every 90 sec) → Edge Function: updateLiveScores()
  ↓
Fetch /event/{current_gw}/live from FPL API
  ↓
Cache response (90 sec TTL)
  ↓
For each team in tournament:
  ├─ Fetch captain selection (DB)
  ├─ Apply captain multiplier (2x)
  ├─ Calculate total points (starters + bench)
  ├─ Upsert gameweek_scores table
  └─ Broadcast score update via Realtime
         ↓
Frontend updates UI instantly (no refresh needed)
```

### 3. Group Stage Ranking Calculation
```
Gameweek 32 marked as data_checked = true (finalized)
  ↓
Edge Function: finalizeGroupStage()
  ↓
Query: SELECT team_id, SUM(total_points), SUM(captain_points)
       FROM gameweek_scores
       WHERE gameweek BETWEEN {start_gw} AND {start_gw + 3}
       GROUP BY team_id
       ORDER BY total_points DESC, captain_points DESC
  ↓
Assign seeds 1-N
  ↓
Update teams table with seed and advancing flag
  ↓
Trigger bracket generation
```

### 4. Knockout Bracket Generation
```
Group stage finalized → Edge Function: generateBracket()
  ↓
Fetch advancing teams (advancing = true) ORDER BY seed
  ↓
Calculate pairings:
  teams_advancing = ceil(0.8 * total_teams)
  For i in range(teams_advancing / 2):
    Match i: Seed i+1 vs Seed (teams_advancing - i)
  ↓
Calculate gameweeks:
  R16 legs: GW 33-34 (if 16 teams)
  QF legs: GW 35-36
  SF legs: GW 37-38 (final)
  ↓
Insert matchups into database
  ↓
Broadcast bracket structure to frontend
```

### 5. Knockout Winner Determination
```
After leg 2 gameweek finalized:
  ↓
Edge Function: resolveMatchup(matchup_id)
  ↓
Fetch both teams' scores for leg 1 and leg 2
  ↓
Calculate aggregates:
  team_1_total = leg1_points + leg2_points
  team_2_total = leg1_points + leg2_points
  ↓
If tied:
  ├─ Tie-breaker 1: max(leg1, leg2) for each team
  ├─ If still tied, Tie-breaker 2: sum(captain_points)
  └─ Set tie_breaker_applied field
  ↓
Update matchup.winner_id
  ↓
If not final round: propagate winner to next round matchup
```

## Security Architecture

### Authentication Strategy
**No Password Storage - Entry ID Validation**

```
User enters Entry ID → 
  ↓
Edge Function: authenticateUser(entry_id)
  ↓
Call FPL API: /entry/{entry_id}/public
  ↓
If 200 OK: Create/retrieve user record
  ↓
Generate JWT with claims: { entry_id, entry_name }
  ↓
Return JWT to frontend (stored in httpOnly cookie or localStorage)
```

### Authorization via Row-Level Security (RLS)

**captain_selections table:**
```sql
CREATE POLICY "Users can manage their own captain selections"
ON captain_selections
FOR ALL
USING (
  team_id IN (
    SELECT id FROM teams 
    WHERE entry_id = (current_setting('request.jwt.claims')::json->>'entry_id')::int
  )
);
```

**teams table:**
```sql
-- Users can view all teams
CREATE POLICY "Anyone can view teams"
ON teams FOR SELECT USING (true);

-- Only admins can insert/update/delete teams
CREATE POLICY "Admins can manage teams"
ON teams FOR ALL
USING (
  (current_setting('request.jwt.claims')::json->>'role') = 'admin'
);
```

### Admin Role Management
```typescript
// Store admin entry IDs in environment variable
const ADMIN_ENTRY_IDS = [123456, 234567]; // Tournament organizers

// Edge function checks admin status
function isAdmin(entry_id: number): boolean {
  return ADMIN_ENTRY_IDS.includes(entry_id);
}
```

## Error Handling & Resilience

### API Failure Scenarios

**1. FPL API Down (5xx errors)**
```
Detection: Failed fetch or server error status
  ↓
Action:
  - Display warning banner: "Live scores temporarily unavailable"
  - Show last successfully cached data
  - Log to admin_logs for manual review
  - Retry with exponential backoff (max 5 attempts)
  - If persists > 10min, send admin alert
```

**2. Rate Limited (429 Too Many Requests)**
```
Detection: HTTP 429 response
  ↓
Action:
  - Immediately pause polling for 60 seconds
  - Use cached data
  - Log incident
  - Resume polling at reduced frequency (1/2 speed)
```

**3. Invalid/Stale Data**
```
Detection: Missing expected fields or data_checked = false
  ↓
Action:
  - Mark gameweek as "provisional" in UI
  - Do not finalize group stage or advance brackets
  - Continue polling until data_checked = true
```

**4. Missing Player Data**
```
Detection: Player ID in squad not found in bootstrap-static
  ↓
Action:
  - Re-fetch bootstrap-static (may be stale)
  - If still missing, show "Unknown Player (#123)"
  - Calculate points as 0 with warning
  - Log for admin review
```

### Circuit Breaker Pattern
```typescript
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'closed' | 'open' | 'half-open';
}

// After 5 consecutive failures, open circuit for 5 minutes
// In half-open state, allow 1 test request
// If successful, close circuit; if failed, reopen
```

## Scalability Considerations

### Database Optimization
- **Read replicas:** For analytics queries (dashboard stats)
- **Partitioning:** Partition gameweek_scores by tournament_id
- **Indexes:** All foreign keys and frequently queried columns indexed

### Frontend Optimization
- **Code splitting:** Load knockout bracket view only when needed
- **Virtual scrolling:** For large team lists (100+ teams)
- **Memoization:** React.memo for static components (player names, etc.)
- **Debouncing:** Captain selection API calls debounced by 500ms

### API Call Optimization
- **Batching:** Single bootstrap-static call serves entire frontend
- **Request deduplication:** If 10 users request same gameweek, only 1 API call
- **Conditional requests:** Use If-Modified-Since headers if supported
- **Smart polling:** Stop polling finished gameweeks

## Deployment Architecture

### Frontend Hosting
**Platform:** Vercel / Netlify / Cloudflare Pages
- **Benefits:** Global CDN, automatic HTTPS, instant rollbacks
- **Build:** `npm run build` → Static files to /dist
- **Environment variables:** Supabase URL, Supabase Anon Key

### Backend Hosting
**Platform:** Supabase Cloud
- **Database:** Managed PostgreSQL with automatic backups
- **Edge Functions:** Deployed via Supabase CLI
- **Cron triggers:** Supabase pg_cron extension

### Environment Separation
```
Development:
  - Supabase Project: ffa-cup-dev
  - Frontend: localhost:5173
  - Mock data allowed for testing

Staging:
  - Supabase Project: ffa-cup-staging
  - Frontend: staging.ffacup.com
  - Full API integration, test tournament

Production:
  - Supabase Project: ffa-cup-prod
  - Frontend: ffacup.com
  - Live tournament, real data only
```

## Monitoring & Observability

### Key Metrics to Track
1. **API Health:**
   - FPL API response time (p50, p95, p99)
   - Error rate (4xx, 5xx)
   - Rate limit hits

2. **Score Calculation:**
   - Time to calculate all teams' scores
   - Discrepancies vs FPL official scores

3. **User Engagement:**
   - Captain selection completion rate per gameweek
   - Dashboard active users during live gameweek

### Logging Strategy
```typescript
// Structured logging in Edge Functions
logger.info('score_calculated', {
  team_id: 'uuid-123',
  gameweek: 29,
  total_points: 65,
  duration_ms: 123
});

// Error logging with context
logger.error('api_call_failed', {
  endpoint: '/event/29/live',
  status_code: 503,
  retry_attempt: 3
});
```

### Alerting
- **Critical:** FPL API down for >10 minutes → Email/SMS admin
- **Warning:** Score calculation taking >30 seconds → Log for review
- **Info:** New gameweek started → Notification to all users

## Disaster Recovery

### Backup Strategy
- **Database:** Supabase automatic daily backups (7-day retention)
- **Critical data:** Weekly exports to S3 (tournaments, teams, captain_selections)
- **Recovery time objective (RTO):** <1 hour
- **Recovery point objective (RPO):** <24 hours

### Rollback Plan
1. Identify failed deployment via error spike
2. Revert frontend to previous Vercel deployment (instant)
3. Revert Edge Functions via Supabase CLI
4. If data corrupted, restore from last backup
5. Re-run score calculations from cached API data

## Development Workflow

### Local Development
```bash
# Frontend
npm install
npm run dev  # localhost:5173

# Supabase (local)
supabase start  # Runs PostgreSQL locally
supabase db reset  # Reset schema

# Edge Functions
supabase functions serve --env-file .env.local
```

### CI/CD Pipeline
```yaml
# GitHub Actions
on: push to main
  - Run tests (Jest + React Testing Library)
  - Lint (ESLint, TypeScript)
  - Build frontend
  - Deploy to Vercel (auto)
  - Deploy Edge Functions to Supabase (auto)
  - Run integration tests
```

### Testing Strategy
1. **Unit Tests:** Tournament logic (scoring, tie-breakers)
2. **Integration Tests:** API client with mocked responses
3. **E2E Tests:** Playwright for critical flows (captain selection, score viewing)
4. **Manual QA:** Admin panel functions before each tournament start

---

## Summary: Why This Architecture?

✅ **Real-time updates:** Supabase Realtime + React subscriptions  
✅ **API reliability:** Circuit breaker, caching, error handling  
✅ **Scalability:** Serverless functions, CDN-hosted frontend, indexed database  
✅ **Maintainability:** TypeScript end-to-end, structured logging, clear separation of concerns  
✅ **No placeholders:** All scores calculated from live FPL Draft API  
✅ **Security:** RLS for captain selections, admin-only tournament setup  
✅ **Cost-effective:** Supabase free tier supports 500GB storage, 2GB database, unlimited Edge Function invocations  

This architecture ensures the FFA Cup application is production-ready, resilient to API failures, and capable of handling real-time tournament operations at scale.
