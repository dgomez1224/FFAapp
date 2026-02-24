// server/current-tournament.ts
import Hono from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();
declare const Deno: {
    env: {
      get(key: string): string | undefined;
    };
  };
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

app.get("/current-tournament", async (c) => {
  try {
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, name, season, status")
      .eq("status", "group_stage")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return c.json({ error: "No active tournament found" }, 404);

    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
