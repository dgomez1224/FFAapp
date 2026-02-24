// Type declarations for Deno-style imports used in Supabase Edge Functions.
// These imports work at runtime in Deno but TypeScript doesn't understand
// the npm: and jsr: syntax locally.

declare module "npm:hono" {
  export * from "hono";
}

declare module "npm:hono/cors" {
  export * from "hono/cors";
}

declare module "npm:hono/logger" {
  export * from "hono/logger";
}

declare module "npm:hono/http-exception" {
  export * from "hono/http-exception";
}

declare module "jsr:@supabase/supabase-js@2.49.8" {
  export * from "@supabase/supabase-js";
}
