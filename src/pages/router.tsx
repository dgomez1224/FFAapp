/**
 * Public Read-Only Router
 * 
 * All routes are public and do not require authentication.
 * Auth-related routes (Login, Signup, AuthCallback) have been removed.
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { LiveDashboard } from "../components/LiveDashboard";
import { BracketView } from "../components/BracketView";
import DashboardPage from "./Dashboard";
import LeagueStandings from "../components/LeagueStandings";
import GobletStandings from "../components/GobletStandings";
import ManagersPage from "./Managers";
import PlayerInsights from "../components/PlayerInsights";
import H2HStandings from "../components/H2HStandings";
import StandingsByGameweek from "../components/StandingsByGameweek";
import Home from "./Home";
import LegacyHome from "./LegacyHome";
import ManagerProfile from "./ManagerProfile";
import LegacyGameweekStandings from "./LegacyGameweekStandings";
import SignIn from "./SignIn";
import PickCaptain from "./PickCaptain";
import MyPage from "./MyPage";
import FixturesPage from "./Fixtures";
import MatchupDetailPage from "./MatchupDetail";
import LineupDetailPage from "./LineupDetail";
import { getCaptainSessionToken } from "../lib/captainSession";

function RequireCaptainSignIn({ children }: { children: React.ReactElement }) {
  const location = useLocation();
  const token = getCaptainSessionToken();
  if (!token) {
    const isPickCaptainPath = location.pathname === "/pick_captain" || location.pathname === "/pick-captain";
    const next = isPickCaptainPath ? "?next=pick_captain" : "";
    return <Navigate to={`/sign-in${next}`} replace />;
  }
  return children;
}

function Shell() {
  const location = useLocation();
  const isFullBleedRoute = location.pathname === "/standings-by-gameweek";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-lg font-semibold">League of Lads</span>
          <nav className="flex gap-4 text-sm flex-wrap">
            <Link to="/dashboard" className="hover:underline">
              Dashboard
            </Link>
            <Link to="/league-standings" className="hover:underline">
              League
            </Link>
            <Link to="/goblet" className="hover:underline">
              Goblet
            </Link>
            <Link to="/h2h" className="hover:underline">
              H2H
            </Link>
            <Link to="/managers" className="hover:underline">
              Managers
            </Link>
            <Link to="/players" className="hover:underline">
              Players
            </Link>
            <Link to="/fixtures" className="hover:underline">
              Fixtures
            </Link>
            <Link to="/legacy-home" className="hover:underline">
              Legacy
            </Link>
            <Link to="/legacy-gameweek-standings" className="hover:underline">
              Legacy GW
            </Link>
            <Link to="/standings-by-gameweek" className="hover:underline">
              GW Standings
            </Link>
            <Link to="/bracket" className="hover:underline">
              Bracket
            </Link>
            <Link to="/sign-in" className="hover:underline">
              Sign In
            </Link>
            <Link to="/pick-captain" className="hover:underline">
              Pick Captain
            </Link>
            <Link to="/my-page" className="hover:underline">
              My Page
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className={isFullBleedRoute ? "w-full px-0 py-0" : "mx-auto max-w-6xl px-4 py-6"}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/home" element={<DashboardPage />} />
            <Route path="/legacy-home" element={<LegacyHome />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/league-standings" element={<LeagueStandings />} />
            <Route path="/goblet" element={<GobletStandings />} />
            <Route path="/h2h" element={<H2HStandings />} />
            <Route path="/managers" element={<ManagersPage />} />
            <Route path="/players" element={<PlayerInsights />} />
            <Route path="/fixtures" element={<FixturesPage />} />
            <Route path="/matchup/:type/:gameweek/:team1/:team2" element={<MatchupDetailPage />} />
            <Route path="/lineup/:type/:gameweek/:teamId" element={<LineupDetailPage />} />
            <Route path="/legacy-gameweek-standings" element={<LegacyGameweekStandings />} />
            <Route path="/standings-by-gameweek" element={<StandingsByGameweek />} />
            <Route path="/bracket" element={<BracketView />} />
            <Route path="/set-entry" element={<Navigate to="/sign-in" replace />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route
              path="/pick_captain"
              element={
                <RequireCaptainSignIn>
                  <PickCaptain />
                </RequireCaptainSignIn>
              }
            />
            <Route
              path="/pick-captain"
              element={
                <RequireCaptainSignIn>
                  <PickCaptain />
                </RequireCaptainSignIn>
              }
            />
            <Route
              path="/my-page"
              element={
                <RequireCaptainSignIn>
                  <MyPage />
                </RequireCaptainSignIn>
              }
            />
            <Route path="/manager/:managerName" element={<ManagerProfile />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
