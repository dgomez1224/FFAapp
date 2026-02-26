const CAPTAIN_SESSION_TOKEN_KEY = "ffa_captain_session_token";
const CAPTAIN_SESSION_EVENT = "captain-session-change";

function emitCaptainSessionChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CAPTAIN_SESSION_EVENT));
}

export function getCaptainSessionToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CAPTAIN_SESSION_TOKEN_KEY);
}

export function setCaptainSessionToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CAPTAIN_SESSION_TOKEN_KEY, token);
  emitCaptainSessionChange();
}

export function clearCaptainSessionToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CAPTAIN_SESSION_TOKEN_KEY);
  emitCaptainSessionChange();
}

export const CAPTAIN_SESSION_CHANGE_EVENT = CAPTAIN_SESSION_EVENT;
