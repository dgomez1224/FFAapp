/**
 * Public Read-Only Router
 * 
 * All routes are public and do not require authentication.
 * Auth-related routes (Login, Signup, AuthCallback) have been removed.
 */

import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
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
import { clearCaptainSessionToken, getCaptainSessionToken } from "../lib/captainSession";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { contrastText, ensureReadableText, extractPaletteFromImage, mix, rgbCss } from "../lib/colorPalette";

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
  const navigate = useNavigate();
  const location = useLocation();
  const isFullBleedRoute = location.pathname === "/standings-by-gameweek";
  const [token, setToken] = useState<string | null>(() => getCaptainSessionToken());
  const [headerCrestUrl, setHeaderCrestUrl] = useState<string | null>(null);

  const handleHeaderSignOut = async () => {
    try {
      if (token) {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain-auth/sign-out`;
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getSupabaseFunctionHeaders(),
          },
          body: JSON.stringify({ token }),
        });
      }
    } finally {
      clearCaptainSessionToken();
      setToken(null);
      setHeaderCrestUrl(null);
      navigate("/dashboard");
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    const resetTheme = () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--muted");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--background");
      root.style.removeProperty("--card");
      root.style.removeProperty("--secondary");
      root.style.removeProperty("--border");
      root.style.removeProperty("--input-background");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--accent-foreground");
      root.style.removeProperty("--secondary-foreground");
      root.style.removeProperty("--sidebar");
      root.style.removeProperty("--sidebar-accent");
      root.style.removeProperty("--sidebar-accent-foreground");
      root.style.removeProperty("--foreground");
      root.style.removeProperty("--card-foreground");
      root.style.removeProperty("--muted-foreground");
      root.style.removeProperty("--sidebar-foreground");
    };

    async function applyLogoTheme(logoUrl: string | null) {
      if (!logoUrl) {
        resetTheme();
        return;
      }
      try {
        const palette = await extractPaletteFromImage(logoUrl);
        if (palette.length === 0) {
          resetTheme();
          return;
        }
        const primary = palette[0];
        const accent = palette[1] || mix(primary, { r: 255, g: 255, b: 255 }, 0.2);
        const mutedBase = palette[2] || mix(primary, { r: 255, g: 255, b: 255 }, 0.78);
        const background = mix(primary, { r: 255, g: 255, b: 255 }, 0.955);
        const card = mix(primary, { r: 255, g: 255, b: 255 }, 0.975);
        const secondary = mix(accent, { r: 255, g: 255, b: 255 }, 0.88);
        const muted = mix(mutedBase, { r: 255, g: 255, b: 255 }, 0.72);
        const border = mix(primary, { r: 32, g: 32, b: 32 }, 0.6);
        const foreground = ensureReadableText(background) === "rgb(10 10 10)" ? "rgb(15 23 42)" : "rgb(248 250 252)";
        const cardForeground = ensureReadableText(card) === "rgb(10 10 10)" ? "rgb(17 24 39)" : "rgb(248 250 252)";
        const mutedForeground = foreground === "rgb(15 23 42)" ? "rgb(71 85 105)" : "rgb(203 213 225)";

        root.style.setProperty("--primary", rgbCss(primary));
        root.style.setProperty("--primary-foreground", contrastText(primary));
        root.style.setProperty("--sidebar-primary", rgbCss(primary));
        root.style.setProperty("--accent", rgbCss(accent));
        root.style.setProperty("--accent-foreground", contrastText(accent));
        root.style.setProperty("--muted", rgbCss(muted));
        root.style.setProperty("--secondary", rgbCss(secondary));
        root.style.setProperty("--secondary-foreground", "rgb(20 20 20)");
        root.style.setProperty("--ring", rgbCss(primary));
        root.style.setProperty("--background", rgbCss(background));
        root.style.setProperty("--card", rgbCss(card));
        root.style.setProperty("--foreground", foreground);
        root.style.setProperty("--card-foreground", cardForeground);
        root.style.setProperty("--muted-foreground", mutedForeground);
        root.style.setProperty("--border", rgbCss(border, 0.38));
        root.style.setProperty("--input-background", rgbCss(mix(background, { r: 255, g: 255, b: 255 }, 0.45)));
        root.style.setProperty("--sidebar", rgbCss(card));
        root.style.setProperty("--sidebar-foreground", cardForeground);
        root.style.setProperty("--sidebar-accent", rgbCss(secondary));
        root.style.setProperty("--sidebar-accent-foreground", "rgb(20 20 20)");
      } catch {
        resetTheme();
      }
    }

    async function loadSessionMedia() {
      if (!token) {
        setHeaderCrestUrl(null);
        await applyLogoTheme(null);
        return;
      }
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain-auth/session?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) throw new Error("session media unavailable");
        const crest = payload?.media?.club_crest_url || null;
        const logo = payload?.media?.club_logo_url || null;
        setHeaderCrestUrl(crest);
        await applyLogoTheme(logo);
      } catch {
        setHeaderCrestUrl(null);
        await applyLogoTheme(null);
      }
    }

    loadSessionMedia();
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="text-lg font-semibold inline-flex items-center gap-2">
            {headerCrestUrl ? <img src={headerCrestUrl} alt="Club crest" className="h-7 w-7 rounded-sm object-cover border" /> : null}
            League of Lads
          </span>
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
            {token ? (
              <button type="button" onClick={handleHeaderSignOut} className="hover:underline">
                Sign Out
              </button>
            ) : (
              <Link to="/sign-in" className="hover:underline">
                Sign In
              </Link>
            )}
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
