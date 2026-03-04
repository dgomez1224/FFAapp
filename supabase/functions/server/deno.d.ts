// Ambient types for Deno globals (Supabase Edge Functions run on Deno)
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

// Console is available in Deno runtime; declare so TS resolves it without DOM lib
declare const console: Console;

// Web API globals available in Deno (Supabase Edge); declare so TS resolves them
declare function fetch(input: string | URL, init?: unknown): Promise<{ ok: boolean; status: number; statusText: string; json(): Promise<unknown> }>;
declare function atob(data: string): string;
interface DenoCrypto {
  randomUUID(): string;
}
declare const crypto: DenoCrypto;
