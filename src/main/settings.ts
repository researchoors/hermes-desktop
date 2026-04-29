import { ipcMain, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import os from "os";

export interface Settings {
  gatewayUrl: string;
  gatewayApiKey: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".hermes-web-ui-electron");
const CONFIG_FILE = path.join(CONFIG_DIR, "settings.json");

const DEFAULTS: Settings = {
  gatewayUrl: "https://chat.model-optimizors.com",
  gatewayApiKey: "",
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

let mainWindowRef: BrowserWindow | null = null;

export function initSettingsIPC(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow;

  ipcMain.handle("settings:get", () => {
    const s = loadSettings();
    return {
      ...s,
      gatewayApiKey: s.gatewayApiKey ? "••••••••" : "",
    };
  });

  ipcMain.handle("settings:save", async (_event, settings: Partial<Settings>) => {
    const incoming = { ...settings };
    if (incoming.gatewayApiKey === "••••••••") {
      const current = loadSettings();
      incoming.gatewayApiKey = current.gatewayApiKey;
    }
    const saved = saveSettings(incoming);

    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      const baseUrl = saved.gatewayUrl.replace(/\/+$/, "");
      let loadUrl = `${baseUrl}/`;
      if (saved.gatewayApiKey) {
        loadUrl = `${baseUrl}/#/?token=${saved.gatewayApiKey}`;
      }
      mainWindowRef.loadURL(loadUrl);
    }

    return {
      ...saved,
      gatewayApiKey: saved.gatewayApiKey ? "••••••••" : "",
    };
  });

  ipcMain.handle("settings:openWindow", () => {
    if (mainWindowRef) openSettingsWindow(mainWindowRef);
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
    height: 400,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: "Hermes Agent — Settings",
    parent,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const htmlPath = path.join(os.homedir(), ".hermes-web-ui-electron", "settings.html");
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
  fs.writeFileSync(htmlPath, SETTINGS_HTML, "utf-8");
  settingsWindow.loadFile(htmlPath);

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
  .btn-row { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
  button { padding: 8px 20px; border-radius: 6px; border: none; font-size: 14px; cursor: pointer; }
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
<input type="text" id="gatewayUrl" placeholder="https://gateway.example.com" />
<div class="hint">The remote Hermes Agent gateway endpoint</div>

<label for="gatewayApiKey">Auth Token</label>
<input type="password" id="gatewayApiKey" placeholder="Paste token from ~/.hermes-web-ui/.token" />
<div class="hint">Authentication token for the web UI (found in ~/.hermes-web-ui/.token)</div>

<div class="btn-row">
  <button class="btn-cancel" onclick="window.close()">Cancel</button>
  <button class="btn-save" onclick="save()">Save &amp; Connect</button>
</div>
<div class="status" id="status"></div>

<script>
const api = window.electronAPI;

async function load() {
  const s = await api.settings.get();
  document.getElementById('gatewayUrl').value = s.gatewayUrl || '';
  document.getElementById('gatewayApiKey').value = s.gatewayApiKey || '';
}

async function save() {
  const el = (id) => document.getElementById(id);
  const s = {
    gatewayUrl: el('gatewayUrl').value.trim(),
    gatewayApiKey: el('gatewayApiKey').value,
  };
  await api.settings.save(s);
  el('status').textContent = 'Saved. Connecting...';
  setTimeout(() => window.close(), 1000);
}

load();
</script>
</body>
</html>`;
