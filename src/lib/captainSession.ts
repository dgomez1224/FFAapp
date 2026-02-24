const CAPTAIN_SESSION_TOKEN_KEY = "ffa_captain_session_token";

export function getCaptainSessionToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CAPTAIN_SESSION_TOKEN_KEY);
}

export function setCaptainSessionToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CAPTAIN_SESSION_TOKEN_KEY, token);
}

export function clearCaptainSessionToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CAPTAIN_SESSION_TOKEN_KEY);
}
