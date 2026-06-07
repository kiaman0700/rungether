const authFlowKey = "rungether-auth-flow";

export function markAuthFlowStarted() {
  window.sessionStorage.setItem(authFlowKey, "started");
}

export function hasStartedAuthFlow() {
  return window.sessionStorage.getItem(authFlowKey) === "started";
}

export function markAuthFlowConfirmed() {
  window.sessionStorage.setItem(authFlowKey, "confirmed");
}

export function hasConfirmedAuthFlow() {
  return window.sessionStorage.getItem(authFlowKey) === "confirmed";
}

export function clearAuthFlow() {
  window.sessionStorage.removeItem(authFlowKey);
}
