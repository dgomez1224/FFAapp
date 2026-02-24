// @ts-nocheck
// Supabase Edge Function to return live group stage standings
declare const Deno: {
    env: {
      get(key: string): string | undefined;
    };
    serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  };
  
  import { Hono } from "npm:hono";
  import { cors } from "npm:hono/cors";
  import { logger } from "npm:hono/logger";
  import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
  
  const app = new Hono();
  
  app.use("*", logger());
  app.use(
    "/*",
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
    }),
  );
  
  // Supabase admin client
  const getSupabaseAdmin = () =>
    createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
  
  const jsonError = (c: any, status: number, message: string, details?: unknown) =>
    c.json({ error: { message, details } }, status);
  
  /**
   * GET /group-standings/:tournamentId
   * Returns computed group stage standings for a tournament
   */
  app.get("/group-standings/:tournamentId", async (c) => {
    try {
      const tournamentId = c.req.param("tournamentId");
      if (!tournamentId) {
        return jsonError(c, 400, "Missing tournamentId");
      }
  
      const supabase = getSupabaseAdmin();
  
      // 1️⃣ Fetch all teams in tournament
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, entry_name, manager_name, manager_short_name")
        .eq("tournament_id", tournamentId);
  
      if (teamsError) {
        return jsonError(c, 500, "Failed to fetch teams", teamsError.message);
      }
  
      const teamIds = teams.map((t) => t.id);
      if (!teamIds.length) {
        return jsonError(c, 404, "No teams found for this tournament");
      }
  
      // 2️⃣ Fetch all gameweek_scores for group stage (assuming start_gameweek + 3)
      const { data: tournamentData } = await supabase
        .from("tournaments")
        .select("start_gameweek, group_stage_gameweeks")
        .eq("id", tournamentId)
        .single();
  
      if (!tournamentData) {
        return jsonError(c, 404, "Tournament config not found");
      }
  
      const startGW = tournamentData.start_gameweek;
      const endGW = startGW + tournamentData.group_stage_gameweeks - 1;
  
      const { data: scores, error: scoresError } = await supabase
        .from("gameweek_scores")
        .select("team_id, total_points, captain_points, gameweek")
        .in("team_id", teamIds)
        .gte("gameweek", startGW)
        .lte("gameweek", endGW);
  
      if (scoresError) {
        return jsonError(c, 500, "Failed to fetch gameweek_scores", scoresError.message);
      }
  
      // 3️⃣ Aggregate scores per team
      const standingsMap: Record<string, any> = {};
      teams.forEach((t) => {
        standingsMap[t.id] = {
          team_id: t.id,
          entry_name: t.entry_name,
          manager_name: t.manager_name,
          manager_short_name: t.manager_short_name,
          total_points: 0,
          captain_points: 0,
        };
      });
  
      scores.forEach((s) => {
        standingsMap[s.team_id].total_points += s.total_points ?? 0;
        standingsMap[s.team_id].captain_points += s.captain_points ?? 0;
      });
  
      // 4️⃣ Convert to array and sort
      const standings = Object.values(standingsMap)
        .sort((a, b) => {
          if (b.total_points !== a.total_points) return b.total_points - a.total_points;
          return b.captain_points - a.captain_points; // tie-breaker
        })
        .map((team, index) => ({
          ...team,
          rank: index + 1,
        }));
  
      return c.json({ start_gameweek: startGW, end_gameweek: endGW, standings });
    } catch (err) {
      console.error("group-standings error", err);
      return jsonError(c, 500, "Unexpected server error");
    }
  });
  
  Deno.serve(app.fetch);
  