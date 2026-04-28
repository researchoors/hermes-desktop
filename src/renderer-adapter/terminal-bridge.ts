export function isElectron(): boolean {
  return !!(window as any).electronAPI?.isElectron;
}

export function getTerminalTransport():
  | "ipc"
  | "websocket" {
  return isElectron() ? "ipc" : "websocket";
}
