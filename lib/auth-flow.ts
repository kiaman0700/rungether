const authFlowKey = "rungether-auth-flow";
const authModeKey = "rungether-auth-mode";

export type AuthMode = "signup" | "login";

export function markAuthFlowStarted(mode: AuthMode) {
  window.sessionStorage.setItem(authFlowKey, "started");
  window.sessionStorage.setItem(authModeKey, mode);
}

export function hasStartedAuthFlow() {
  return window.sessionStorage.getItem(authFlowKey) === "started";
}

export function markAuthFlowConfirmed() {
  window.sessionStorage.setItem(authFlowKey, "confirmed");
}

export function getAuthFlowMode(): AuthMode {
  return window.sessionStorage.getItem(authModeKey) === "login" ? "login" : "signup";
}

export function hasConfirmedAuthFlow() {
  return window.sessionStorage.getItem(authFlowKey) === "confirmed";
}

export function clearAuthFlow() {
  window.sessionStorage.removeItem(authFlowKey);
  window.sessionStorage.removeItem(authModeKey);
}
