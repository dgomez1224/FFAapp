// Ambient types for Deno globals (Supabase Edge Functions run on Deno)
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

// Console is available in Deno runtime; declare so TS resolves it without DOM lib
declare const console: Console;

// Web API globals available in Deno (Supabase Edge); declare so TS resolves them
// fetch/Response come from compiler "lib": "DOM"; do not redeclare fetch with a
// minimal return type — it breaks Promise<Response> (e.g. fetchWithTimeout).
declare function atob(data: string): string;
interface DenoCrypto {
  randomUUID(): string;
}
declare const crypto: DenoCrypto;
