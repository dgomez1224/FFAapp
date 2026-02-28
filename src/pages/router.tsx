/**
 * Public Read-Only Router
 * 
 * All routes are public and do not require authentication.
 * Auth-related routes (Login, Signup, AuthCallback) have been removed.
 */

import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { LiveDashboard } from "../components/LiveDashboard";
import { BracketView } from "../components/BracketView";
import DashboardPage from "./Dashboard";
import LeagueStandings from "../components/LeagueStandings";
import GobletStandings from "../components/GobletStandings";
import ManagersPage from "./Managers";
import PlayerInsights from "../components/PlayerInsights";
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
import {
  CAPTAIN_SESSION_CHANGE_EVENT,
  clearCaptainSessionToken,
  getCaptainSessionToken,
} from "../lib/captainSession";
import { EDGE_FUNCTIONS_BASE } from "../lib/constants";
import { getSupabaseFunctionHeaders, supabaseUrl } from "../lib/supabaseClient";
import { contrastText, ensureReadableText, extractPaletteFromImage, mix, rgbCss } from "../lib/colorPalette";
import leagueTrophy from "../assets/trophies/League Cup Icon.png";
import { Button } from "../components/ui/button";
import { MoreHorizontal } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileRoutes = [
    { label: "League", path: "/league-standings" },
    { label: "Goblet", path: "/goblet" },
    { label: "Managers", path: "/managers" },
    { label: "Players", path: "/players" },
    { label: "Fixtures", path: "/fixtures" },
    { label: "Legacy", path: "/legacy-home" },
    { label: "Legacy GW", path: "/legacy-gameweek-standings" },
    { label: "GW Standings", path: "/standings-by-gameweek" },
    { label: "Bracket", path: "/bracket" },
    { label: "Pick Captain", path: "/pick-captain" },
    { label: "My Page", path: "/my-page" },
  ];

  useEffect(() => {
    const syncSessionToken = () => {
      setToken(getCaptainSessionToken());
    };
    syncSessionToken();
    window.addEventListener(CAPTAIN_SESSION_CHANGE_EVENT, syncSessionToken);
    window.addEventListener("storage", syncSessionToken);
    return () => {
      window.removeEventListener(CAPTAIN_SESSION_CHANGE_EVENT, syncSessionToken);
      window.removeEventListener("storage", syncSessionToken);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!mobileMenuRef.current || !target) return;
      if (!mobileMenuRef.current.contains(target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [mobileMenuOpen]);

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
        const base = palette[0];
        const accent = palette[1] || mix(base, { r: 255, g: 255, b: 255 }, 0.2);
        const mutedSeed = palette[2] || mix(base, { r: 255, g: 255, b: 255 }, 0.76);
        const muted = mix(mutedSeed, { r: 255, g: 255, b: 255 }, 0.58);
        const primary = mix(accent, muted, 0.34);
        const background = mix(primary, { r: 255, g: 255, b: 255 }, 0.9);
        const card = mix(muted, { r: 255, g: 255, b: 255 }, 0.2);
        const secondary = mix(muted, accent, 0.18);
        const border = mix(muted, accent, 0.48);
        const foreground = ensureReadableText(background) === "rgb(10 10 10)" ? "rgb(15 23 42)" : "rgb(248 250 252)";
        const cardForeground = ensureReadableText(card) === "rgb(10 10 10)" ? "rgb(17 24 39)" : "rgb(248 250 252)";
        const secondaryForeground = ensureReadableText(secondary) === "rgb(10 10 10)" ? "rgb(20 20 20)" : "rgb(248 250 252)";
        const mutedForeground = foreground === "rgb(15 23 42)" ? "rgb(71 85 105)" : "rgb(203 213 225)";

        root.style.setProperty("--primary", rgbCss(primary));
        root.style.setProperty("--primary-foreground", contrastText(primary));
        root.style.setProperty("--sidebar-primary", rgbCss(primary));
        root.style.setProperty("--accent", rgbCss(accent));
        root.style.setProperty("--accent-foreground", contrastText(accent));
        root.style.setProperty("--muted", rgbCss(muted));
        root.style.setProperty("--secondary", rgbCss(secondary));
        root.style.setProperty("--secondary-foreground", secondaryForeground);
        root.style.setProperty("--ring", rgbCss(accent));
        root.style.setProperty("--background", rgbCss(background));
        root.style.setProperty("--card", rgbCss(card));
        root.style.setProperty("--foreground", foreground);
        root.style.setProperty("--card-foreground", cardForeground);
        root.style.setProperty("--muted-foreground", mutedForeground);
        root.style.setProperty("--border", rgbCss(border, 0.38));
        root.style.setProperty("--input-background", rgbCss(mix(card, { r: 255, g: 255, b: 255 }, 0.28)));
        root.style.setProperty("--sidebar", rgbCss(card));
        root.style.setProperty("--sidebar-foreground", cardForeground);
        root.style.setProperty("--sidebar-accent", rgbCss(secondary));
        root.style.setProperty("--sidebar-accent-foreground", secondaryForeground);
      } catch {
        resetTheme();
      }
    }

    async function loadSessionMedia() {
      if (!token) {
        await applyLogoTheme(null);
        return;
      }
      try {
        const url = `${supabaseUrl}/functions/v1${EDGE_FUNCTIONS_BASE}/captain-auth/session?token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { headers: getSupabaseFunctionHeaders() });
        const payload = await res.json();
        if (!res.ok || payload?.error) throw new Error("session media unavailable");
        const logo = payload?.media?.club_logo_url || null;
        await applyLogoTheme(logo);
      } catch {
        await applyLogoTheme(null);
      }
    }

    loadSessionMedia();
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link to="/dashboard" className="font-heading group text-lg font-semibold inline-flex items-center gap-2 hover:opacity-90">
            <img
              src={leagueTrophy}
              alt="League trophy"
              className="h-7 w-5 object-contain transition-all duration-200 group-hover:scale-110 group-hover:brightness-110 group-hover:sepia group-hover:saturate-[8] group-hover:hue-rotate-[340deg]"
            />
            League of Lads
          </Link>

          <nav className="font-heading hidden flex-wrap items-center gap-5 text-sm tracking-wide lg:flex">
            <Link to="/league-standings" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              League
            </Link>
            <Link to="/goblet" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              Goblet
            </Link>
            <Link to="/managers" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              Managers
            </Link>
            <Link to="/players" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              Players
            </Link>
            <Link to="/fixtures" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              Fixtures
            </Link>
            <Link to="/legacy-home" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              Legacy
            </Link>
            <Link to="/legacy-gameweek-standings" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              Legacy GW
            </Link>
            <Link to="/standings-by-gameweek" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              GW Standings
            </Link>
            <Link to="/bracket" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              Bracket
            </Link>
            {token ? (
              <button type="button" onClick={handleHeaderSignOut} className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
                Sign Out
              </button>
            ) : (
              <Link to="/sign-in" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
                Sign In
              </Link>
            )}
            <Link to="/pick-captain" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              Pick Captain
            </Link>
            <Link to="/my-page" className="text-foreground/90 transition-colors hover:text-foreground hover:underline">
              My Page
            </Link>
          </nav>

          <div ref={mobileMenuRef} className="relative lg:hidden">
            <Button
              variant="outline"
              size="icon"
              aria-label="Open routes"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>

            {mobileMenuOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 max-h-80 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                <div className="px-2 py-1.5 text-sm font-medium">Routes</div>
                <div className="my-1 h-px bg-border" />
                {mobileRoutes.map((route) => (
                  <button
                    key={route.path}
                    type="button"
                    onClick={() => {
                      navigate(route.path);
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {route.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-border" />
                {token ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleHeaderSignOut();
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/sign-in");
                      setMobileMenuOpen(false);
                    }}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    Sign In
                  </button>
                )}
              </div>
            ) : null}
          </div>
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

const routerBasename = (typeof import.meta.env.BASE_URL === "string" && import.meta.env.BASE_URL !== "/")
  ? import.meta.env.BASE_URL.replace(/\/$/, "")
  : undefined;

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <Shell />
    </BrowserRouter>
  );
}
