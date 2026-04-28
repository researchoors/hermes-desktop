import fs from "fs";
import path from "path";
import os from "os";
import { ipcMain, BrowserWindow, dialog } from "electron";

export interface Settings {
  gatewayUrl: string;
  gatewayApiKey: string;
  disableAuth: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), ".hermes-web-ui-electron");
const CONFIG_FILE = path.join(CONFIG_DIR, "settings.json");

const DEFAULTS: Settings = {
  gatewayUrl: "http://127.0.0.1:8642",
  gatewayApiKey: "",
  disableAuth: false,
};

export function loadSettings(): Settings {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const current = loadSettings();
  const merged = { ...current, ...settings };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}

export function initSettingsIPC(mainWindow: BrowserWindow): void {
  ipcMain.handle("settings:get", () => {
    const s = loadSettings();
    return {
      ...s,
      gatewayApiKey: s.gatewayApiKey ? "••••••••" : "",
    };
  });

  ipcMain.handle("settings:save", (_event, settings: Partial<Settings>) => {
    const incoming = { ...settings };
    if (incoming.gatewayApiKey === "••••••••") {
      const current = loadSettings();
      incoming.gatewayApiKey = current.gatewayApiKey;
    }
    const saved = saveSettings(incoming);
    return {
      ...saved,
      gatewayApiKey: saved.gatewayApiKey ? "••••••••" : "",
    };
  });

  ipcMain.handle("settings:openWindow", () => {
    openSettingsWindow(mainWindow);
  });
}

let settingsWindow: BrowserWindow | null = null;

export function openSettingsWindow(parent: BrowserWindow): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 520,
    height: 440,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "Hermes Agent — Settings",
    parent,
    modal: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SETTINGS_HTML)}`);

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

const SETTINGS_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Settings</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background: #1a1a2e; color: #e0e0e0; }
  h2 { font-size: 18px; margin-bottom: 20px; color: #fff; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #a0a0c0; }
  input[type="text"], input[type="password"] {
    width: 100%; padding: 10px 12px; border: 1px solid #333355; border-radius: 6px;
    background: #16213e; color: #e0e0e0; font-size: 14px; margin-bottom: 16px; outline: none;
  }
  input:focus { border-color: #6c63ff; }
  .checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .checkbox-row input { width: 18px; height: 18px; accent-color: #6c63ff; }
  .checkbox-row label { margin-bottom: 0; font-weight: 400; color: #e0e0e0; }
  .btn-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
  button {
    padding: 8px 20px; border-radius: 6px; border: none; font-size: 14px; cursor: pointer;
  }
  .btn-save { background: #6c63ff; color: #fff; }
  .btn-save:hover { background: #5a52e0; }
  .btn-cancel { background: #333355; color: #ccc; }
  .btn-cancel:hover { background: #444466; }
  .status { margin-top: 12px; font-size: 12px; color: #66cc66; min-height: 18px; }
  .hint { font-size: 11px; color: #666; margin-top: -12px; margin-bottom: 16px; }
</style>
</head>
<body>
<h2>Gateway Settings</h2>

<label for="gatewayUrl">Gateway URL</label>
<input type="text" id="gatewayUrl" placeholder="http://127.0.0.1:8642" />
<div class="hint">The Hermes Agent gateway endpoint. Can be a remote URL (e.g. https://gateway.example.com)</div>

<label for="gatewayApiKey">API Key</label>
<input type="password" id="gatewayApiKey" placeholder="sk-..." />
<div class="hint">Used for Bearer authentication to the gateway. Written to ~/.hermes/.env as API_SERVER_KEY</div>

<div class="checkbox-row">
  <input type="checkbox" id="disableAuth" />
  <label for="disableAuth">Disable local auth (no login token required)</label>
</div>

<div class="btn-row">
  <button class="btn-cancel" onclick="window.close()">Cancel</button>
  <button class="btn-save" onclick="save()">Save &amp; Restart</button>
</div>
<div class="status" id="status"></div>

<script>
const api = window.electronAPI;

async function load() {
  const s = await api.settings.get();
  document.getElementById('gatewayUrl').value = s.gatewayUrl || '';
  document.getElementById('gatewayApiKey').value = s.gatewayApiKey || '';
  document.getElementById('disableAuth').checked = !!s.disableAuth;
}

async function save() {
  const el = (id) => document.getElementById(id);
  const s = {
    gatewayUrl: el('gatewayUrl').value.trim(),
    gatewayApiKey: el('gatewayApiKey').value,
    disableAuth: el('disableAuth').checked,
  };
  await api.settings.save(s);
  el('status').textContent = 'Saved. Restart the app to apply changes.';
  setTimeout(() => window.close(), 1200);
}

load();
</script>
</body>
</html>`;
