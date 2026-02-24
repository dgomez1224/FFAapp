# FFA Cup User Flows & Interface Design

## User Personas

### 1. Manager (Participant)
**Goals:** Select captains, track live scores, view bracket position  
**Tech savviness:** Medium  
**Primary device:** Desktop during setup, mobile during live gameweeks

### 2. Tournament Admin (Organizer)
**Goals:** Set up tournament, resolve disputes, make manual corrections  
**Tech savviness:** High  
**Primary device:** Desktop

### 3. Spectator (Non-participant)
**Goals:** Follow tournament progress, view standings  
**Tech savviness:** Low-Medium  
**Primary device:** Mobile

## Core User Flows

---

## Flow 1: First-Time User Authentication

### Steps
1. **Landing page**
   - Headline: "Welcome to FFA Cup"
   - Subheadline: "Track your fantasy draft tournament with live scoring"
   - CTA: "Enter Your FPL Draft Entry ID"

2. **Entry ID input**
   - Input field: "Entry ID" (numeric, 6-8 digits)
   - Help text: "Find this in your FPL Draft team URL: draft.premierleague.com/entry/{ID}/event/1"
   - Button: "Continue"

3. **Loading state**
   - "Validating your Entry ID..."
   - Spinner animation

4. **Success: Authenticated**
   - Welcome message: "Welcome back, {Manager Name}!"
   - Auto-redirect to Dashboard (3 seconds)

5. **Error: Invalid Entry ID**
   - Error message: "Entry ID not found. Please check and try again."
   - Retry option

### Wireframe Description
```
┌────────────────────────────────────────┐
│  [FFA Cup Logo]                        │
│                                        │
│     Welcome to the FFA Cup             │
│     Track live scores and brackets     │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ Entry ID: [____________]         │ │
│  │ Find in FPL Draft URL            │ │
│  └──────────────────────────────────┘ │
│                                        │
│        [Continue →]                    │
│                                        │
│  First time? Learn more about FFA Cup │
└────────────────────────────────────────┘
```

---

## Flow 2: Captain Selection (Before Gameweek Deadline)

### Steps
1. **Dashboard notification**
   - Banner: "⚠️ Captain selection needed for Gameweek 29 • Deadline: Sat, Aug 16 at 11:30 AM"
   - CTA: "Select Captain"

2. **Captain selection modal**
   - Title: "Select Captain & Vice-Captain for GW29"
   - Countdown timer: "3h 24m remaining"
   - Squad list loaded from API
   - Filter: All / Starters / Bench

3. **Squad display**
   - Grid layout: Player cards with photo, name, position, team badge
   - Each card: 
     - Radio buttons: "Captain (2×)" | "Vice-Captain"
     - Player stats: "Form: 5.2 | Total: 45 pts"
     - Match info: "ARS (H)" with fixture difficulty color

4. **Selection made**
   - Captain: Salah (selected)
   - Vice-Captain: Haaland (selected)
   - Button: "Confirm Selection"

5. **Confirmation**
   - Success toast: "✓ Captain selections saved for GW29"
   - Button changes to: "Change Selection" (until deadline)

6. **After deadline**
   - Button disabled: "Locked ✓"
   - Show selected captain with "2× points active"

### Wireframe Description
```
┌────────────────────────────────────────────────────┐
│  Select Captain for Gameweek 29                    │
│  ⏰ Deadline: 3h 24m remaining                     │
├────────────────────────────────────────────────────┤
│                                                    │
│  [All] [Starters] [Bench]           [Search: ___] │
│                                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Salah    │ │ Haaland  │ │ Saka     │          │
│  │ [Photo]  │ │ [Photo]  │ │ [Photo]  │          │
│  │ LIV • MID│ │ MCI • FWD│ │ ARS • MID│          │
│  │ vs BHA(H)│ │ vs CHE(A)│ │ vs AVL(H)│          │
│  │          │ │          │ │          │          │
│  │ ● Captain│ │ ○ Captain│ │ ○ Captain│          │
│  │ ○ Vice   │ │ ● Vice   │ │ ○ Vice   │          │
│  │ Form: 6.8│ │ Form: 7.2│ │ Form: 5.4│          │
│  └──────────┘ └──────────┘ └──────────┘          │
│                                                    │
│  ... (more players)                                │
│                                                    │
│            [Confirm Selection]                     │
└────────────────────────────────────────────────────┘
```

---

## Flow 3: Live Scoring Dashboard (During Active Gameweek)

### Steps
1. **Navigate to Dashboard**
   - Nav: Home | My Matchup | Standings | Bracket | Captain

2. **Dashboard overview**
   - Hero section: "Gameweek 29 • LIVE"
   - My score: 48 pts (updating in real-time)
   - My ranking: 3rd of 10

3. **Matchup card (if knockout round)**
   - "Quarter-Final • Leg 1 of 2"
   - My team: 48 pts vs Opponent: 52 pts
   - Status: "Down by 4 points"
   - Leg 2: GW 30

4. **Live scores table**
   - Columns: Rank | Manager | Team | GW Points | Captain | Status
   - Auto-refresh every 90 seconds
   - Visual indicator for live updates (pulsing dot)

5. **My squad breakdown**
   - Starting XI with points
   - Captain highlighted with "2×" badge
   - Bench players (points counted per FFA rules)
   - Total: 48 pts

6. **Real-time updates**
   - Toast notification: "🎯 Salah scored! +6 pts (Captain: +12)"
   - Score animates up: 48 → 60

### Wireframe Description
```
┌────────────────────────────────────────────────────────────────┐
│ [Logo] FFA Cup          [GW 29 • LIVE 🔴]     [John Smith ▾]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  MY SCORE                    RANK                        │ │
│  │  60 pts (+12 🎯)              3rd / 10 ↑1               │ │
│  │                                                          │ │
│  │  Captain: Salah (2×) • 24 pts                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  QUARTER-FINAL • LEG 1 OF 2                              │ │
│  │                                                          │ │
│  │  My Team                           Opponent              │ │
│  │  60 pts                            52 pts                │ │
│  │                                                          │ │
│  │           ⚽ Winning by 8 points                         │ │
│  │           Leg 2: Gameweek 30                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  LIVE STANDINGS                          🔄 Updated 23s ago│
│  ├──────┬────────────┬──────────┬────────┬──────────────────┤ │
│  │ Rank │ Manager    │ Team     │ Points │ Captain          │ │
│  ├──────┼────────────┼──────────┼────────┼──────────────────┤ │
│  │ 1    │ Mike Jones │ FC Elite │ 72     │ Haaland • 18×2   │ │
│  │ 2    │ Sarah Lee  │ Winners  │ 65     │ Salah • 12×2     │ │
│  │ 3 ↑1 │ John Smith │ My Team  │ 60 🎯  │ Salah • 12×2     │ │
│  │ ...  │            │          │        │                  │ │
│  └──────┴────────────┴──────────┴────────┴──────────────────┘ │
│                                                                │
│  [View My Squad →]  [View All Matchups →]                     │
└────────────────────────────────────────────────────────────────┘
```

---

## Flow 4: Group Stage Standings View

### Steps
1. **Navigate to Standings**
   - Nav item: "Standings"

2. **Group stage table**
   - Title: "Group Stage Standings (GW 29-32)"
   - Status indicator: "IN PROGRESS" or "FINAL"
   - Columns:
     - Rank
     - Manager / Team
     - GW29 | GW30 | GW31 | GW32 | Total
     - Captain Pts (tie-breaker)
     - Status (Advancing / Eliminated)

3. **Qualifying line**
   - Visual separator between advancing (top 80%) and eliminated teams
   - Label: "Qualification Line • Top 8 advance"

4. **Expanded row (click to expand)**
   - Shows gameweek-by-gameweek breakdown
   - Captain selections per gameweek
   - Points on bench

5. **After group stage finalized**
   - Banner: "Group stage complete! Knockout bracket generated."
   - CTA: "View Bracket →"

### Wireframe Description
```
┌───────────────────────────────────────────────────────────────────┐
│  Group Stage Standings                     [Final • GW 29-32]     │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Top 8 teams advance to knockout rounds                           │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Rank│Manager   │Team    │GW29│GW30│GW31│GW32│Total│Cap Pts│ │ │
│  ├─────┼──────────┼────────┼────┼────┼────┼────┼─────┼───────┤ │ │
│  │ 1   │Mike Jones│Elite   │ 72 │ 68 │ 75 │ 80 │ 295 │  96   │✓│ │
│  │ 2   │Sarah Lee │Winners │ 70 │ 72 │ 68 │ 73 │ 283 │  88   │✓│ │
│  │ 3   │John Smith│My Team │ 65 │ 70 │ 72 │ 69 │ 276 │  84   │✓│ │
│  │ ... │          │        │    │    │    │    │     │       │✓│ │
│  │ 8   │Amy Clark │Stars   │ 62 │ 60 │ 58 │ 65 │ 245 │  72   │✓│ │
│  ├─────┴──────────┴────────┴────┴────┴────┴────┴─────┴───────┴─┤ │
│  │ ─────────────── QUALIFICATION LINE ──────────────────────────│ │
│  ├─────┬──────────┬────────┬────┬────┬────┬────┬─────┬───────┬─┤ │
│  │ 9   │Tom Brown │Losers  │ 58 │ 62 │ 60 │ 55 │ 235 │  68   │✗│ │
│  │ 10  │Eva Green │Last    │ 55 │ 52 │ 58 │ 60 │ 225 │  64   │✗│ │
│  └─────┴──────────┴────────┴────┴────┴────┴────┴─────┴───────┴─┘ │
│                                                                   │
│  [Export Standings]              [View Knockout Bracket →]        │
└───────────────────────────────────────────────────────────────────┘
```

---

## Flow 5: Knockout Bracket View

### Steps
1. **Navigate to Bracket**
   - Nav item: "Bracket"

2. **Bracket visualization**
   - Tournament tree view (horizontal or vertical)
   - Rounds: R16 → QF → SF → Final
   - Each matchup shows:
     - Team names (seed #)
     - Leg 1 score | Leg 2 score | Aggregate
     - Winner highlighted

3. **Click matchup for details**
   - Modal: "Quarter-Final • Match 2"
   - Team A vs Team B
   - Leg 1 (GW 35): 72 - 68
   - Leg 2 (GW 36): 65 - 70
   - Aggregate: 137 - 138
   - Winner: Team B (by 1 point)
   - Tie-breaker used: None
   - Next opponent: Team C (in Semi-Final)

4. **My matchup highlighted**
   - Current user's matchup has colored border
   - "You are here" indicator

5. **Future rounds**
   - Grayed out with "TBD" for teams
   - Gameweeks shown

### Wireframe Description
```
┌────────────────────────────────────────────────────────────────────┐
│  Knockout Bracket                            [Final on GW 37-38]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Quarter-Finals    Semi-Finals           Final                     │
│    (GW 35-36)       (GW 37-38)        (GW 37-38)                   │
│                                                                    │
│  ┌──────────┐                                                      │
│  │(1) Elite │ 72│                                                  │
│  │     295  │ 68│──┐                                               │
│  └──────────┘ 140│  │                                              │
│                   │  │ ┌──────────┐                                │
│  ┌──────────┐     │  └─│(1) Elite │ 75│                           │
│  │(8) Stars │ 65│ │    │     295  │ 70│──┐                        │
│  │     245  │ 70│─┘    └──────────┘ 145│  │                       │
│  └──────────┘ 135                       │  │                       │
│                                          │  │                       │
│  ┌──────────┐                            │  │ ┌──────────┐         │
│  │(4) Team D│ 68│                        │  └─│(1) Elite │         │
│  │     267  │ 72│──┐                     │    │     295  │ ??│     │
│  └──────────┘ 140│  │ ┌──────────┐       │    └──────────┘ ??│──┐ │
│                   │  └─│(4) Team D│ 70│  │                        │ │
│  ┌──────────┐     │    │     267  │ 68│──┘    ┌──────────┐        │ │
│  │(5) Team E│ 70│ │    └──────────┘ 138       │ WINNER   │        │ │
│  │     265  │ 65│─┘                            │          │        │ │
│  └──────────┘ 135                              │          │        │ │
│                                                 └──────────┘        │ │
│  ... (more matchups)                                         GW38  │ │
│                                                                     │ │
│  [Download Bracket]                [View Detailed Results →]       │ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Flow 6: Admin - Tournament Setup

### Steps (Admin Only)

1. **Admin login**
   - Same Entry ID flow, but Entry ID checked against admin whitelist
   - If admin: Show "Admin Panel" in nav

2. **Create new tournament**
   - Form fields:
     - Tournament name: "FFA Cup 2025"
     - FPL Draft League ID: 12345
     - Number of teams: 10 (auto-populated from API)
     - Season: "2024/25"
     - Start gameweek: Auto-calculated (29)
     - End gameweek: 38 (fixed)

3. **Review tournament structure**
   - Summary:
     - Group stage: GW 29-32 (4 weeks)
     - Teams advancing: 8 (80%)
     - Knockout rounds:
       - Quarter-Finals: GW 35-36
       - Semi-Finals: GW 37-38
       - Final: GW 37-38 (same as SF)

4. **Import teams**
   - Button: "Fetch Teams from FPL League"
   - Loading: "Retrieving league data..."
   - Table: Shows all entries with manager names
   - Checkboxes: Select teams to include (default: all)

5. **Confirmation**
   - Review all settings
   - Button: "Create Tournament"
   - Success: "Tournament created! Managers can now select captains."

6. **Manual corrections**
   - Admin panel: "Manual Overrides"
   - Options:
     - Adjust gameweek score (with reason)
     - Swap matchup teams (if bracket error)
     - Recalculate standings

### Wireframe Description
```
┌────────────────────────────────────────────────────────────────┐
│ [Admin Panel] Create Tournament                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Tournament Details                                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Name:         [FFA Cup 2025_______________]              │ │
│  │ FPL League ID:[12345______________________]              │ │
│  │ Season:       [2024/25____________________]              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Tournament Structure (Auto-calculated)                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Teams:           10 (fetched from league)                │ │
│  │ Advancing:       8 (80%)                                 │ │
│  │ Start GW:        29                                      │ │
│  │ End GW:          38                                      │ │
│  │                                                          │ │
│  │ Schedule:                                                │ │
│  │   • Group Stage: GW 29-32 (4 weeks)                     │ │
│  │   • Quarter-Finals: GW 35-36 (2 legs)                   │ │
│  │   • Semi-Finals: GW 37-38 (2 legs)                      │ │
│  │   • Final: GW 37-38 (concurrent with SF)                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Teams (10 entries found)                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ☑ Mike Jones - Elite FC (Entry 234567)                  │ │
│  │ ☑ Sarah Lee - Winners (Entry 234568)                    │ │
│  │ ☑ John Smith - My Team (Entry 234569)                   │ │
│  │ ... (7 more)                                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Cancel]                          [Create Tournament →]       │
└────────────────────────────────────────────────────────────────┘
```

---

## Flow 7: Analytics Dashboard

### Steps
1. **Navigate to Stats**
   - Nav item: "Stats" or "Analytics"

2. **Overview cards**
   - Total points scored (all teams combined)
   - Average points per gameweek
   - Highest single gameweek score
   - Captain efficiency % (captain pts / possible captain pts)

3. **Charts and graphs**
   - **Line chart:** Points per gameweek (all teams)
   - **Bar chart:** Captain choices popularity (which players chosen as captain most)
   - **Bar chart:** Bench contribution by team

4. **Leaderboards**
   - Highest single gameweek score
   - Best captain pick (most points from one captain in one GW)
   - Most consistent team (lowest variance)

5. **My stats (if logged in)**
   - My average vs tournament average
   - My captain hit rate (captain scored above average)
   - My rank progression graph

### Wireframe Description
```
┌────────────────────────────────────────────────────────────────┐
│  Tournament Statistics                                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │Total Pts │ │Avg/GW    │ │Highest GW│ │Cap Eff.  │         │
│  │          │ │          │ │          │ │          │         │
│  │ 2,456    │ │ 68.2     │ │ 92       │ │ 78%      │         │
│  │          │ │          │ │Mike Jones│ │          │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  Points per Gameweek                                           │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  100 │                                                   │ │
│  │      │              •─•                                  │ │
│  │   80 │           •─•   •─•                              │ │
│  │      │        •─•          •─•                          │ │
│  │   60 │     •─•                •─•                       │ │
│  │      │  •─•                       •                     │ │
│  │      └─────────────────────────────────────             │ │
│  │        29   30   31   32   35   36   37   38           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Most Popular Captains                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Salah    ████████████████░░░░  80% (8 teams)            │ │
│  │ Haaland  ██████████░░░░░░░░░░  50% (5 teams)            │ │
│  │ Saka     ████░░░░░░░░░░░░░░░░  20% (2 teams)            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  [Export Stats]                      [View More Details →]    │
└────────────────────────────────────────────────────────────────┘
```

---

## Error States & Edge Cases

### Error 1: FPL API Down
```
┌────────────────────────────────────────┐
│  ⚠️ Live Scores Unavailable            │
│                                        │
│  We're unable to fetch live scores     │
│  from the FPL API right now.           │
│                                        │
│  Last updated: 5 minutes ago           │
│                                        │
│  [Retry]  [View Cached Scores]         │
└────────────────────────────────────────┘
```

### Error 2: Invalid Captain Selection
```
┌────────────────────────────────────────┐
│  ❌ Invalid Captain Selection          │
│                                        │
│  Salah is not in your squad for GW29.  │
│                                        │
│  Please select from your current       │
│  roster. [View Updated Squad →]        │
└────────────────────────────────────────┘
```

### Error 3: Missed Captain Selection
```
┌────────────────────────────────────────┐
│  ⏰ Captain Selection Deadline Passed  │
│                                        │
│  You didn't select a captain for GW29. │
│                                        │
│  ✓ Your GW28 captain (Salah) will be  │
│    used automatically (FFA Cup rules). │
│                                        │
│  [OK, Got It]                          │
└────────────────────────────────────────┘
```

### Error 4: Tie-Breaker Applied
```
┌────────────────────────────────────────┐
│  🏆 Matchup Result                     │
│                                        │
│  Quarter-Final: My Team vs Opponent   │
│                                        │
│  Aggregate Score: 145 - 145 (TIED)     │
│                                        │
│  Tie-Breaker 1: Highest Single GW     │
│  • My Team: 75 pts (GW 35)             │
│  • Opponent: 72 pts (GW 36)            │
│                                        │
│  ✅ Winner: My Team (by tie-breaker)   │
│                                        │
│  [View Next Matchup →]                 │
└────────────────────────────────────────┘
```

---

## Responsive Design Considerations

### Mobile Optimizations
- **Dashboard:** Stack cards vertically
- **Captain selection:** Grid → List view with larger tap targets
- **Bracket:** Horizontal scroll with pinch-to-zoom
- **Tables:** Horizontal scroll with sticky first column

### Desktop Enhancements
- **Multi-column layouts:** Side-by-side matchups
- **Hover states:** Player stats tooltip on hover
- **Keyboard shortcuts:** Arrow keys to navigate bracket

---

## Accessibility (WCAG 2.1 AA)

### Key Features
- **Semantic HTML:** Proper heading hierarchy
- **ARIA labels:** Screen reader announcements for live score updates
- **Keyboard navigation:** All actions accessible via keyboard
- **Color contrast:** 4.5:1 minimum for text
- **Focus indicators:** Visible focus states
- **Alt text:** All images and icons described

### Live Region for Score Updates
```html
<div aria-live="polite" aria-atomic="true">
  Your score has increased to 60 points.
  Salah scored a goal, earning 12 captain points.
</div>
```

---

## Summary: User Experience Principles

1. **Progressive disclosure:** Show essential info first, details on demand
2. **Real-time feedback:** Instant updates during live gameweeks
3. **Error recovery:** Clear error messages with actionable next steps
4. **Tournament transparency:** All rules, tie-breakers, and calculations visible
5. **Mobile-first:** Optimize for on-the-go score checking
6. **Admin power:** Full control for organizers with audit trail

These flows ensure managers have a seamless, engaging experience tracking their FFA Cup tournament with zero ambiguity around scoring, brackets, or rules.
