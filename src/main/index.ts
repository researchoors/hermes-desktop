import { app, BrowserWindow } from "electron";
import path from "path";
import { createTray } from "./tray";
import { createMenus } from "./menus";
import { initSettingsIPC, loadSettings, openSettingsWindow } from "./settings";

let mainWindow: BrowserWindow | null = null;
let bootstrapped = false;
let bootstrapping = false;

function getLoadUrl(settings: { gatewayUrl: string; gatewayApiKey: string }): string {
  const baseUrl = settings.gatewayUrl.replace(/\/+$/, "");
  if (settings.gatewayApiKey) {
    return `${baseUrl}/#/?token=${settings.gatewayApiKey}`;
  }
  return `${baseUrl}/`;
}

async function bootstrap() {
  if (bootstrapping) return;
  bootstrapping = true;

  try {
    const settings = loadSettings();

    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      title: "Hermes Agent",
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : undefined,
      webPreferences: {
        preload: path.join(__dirname, "..", "preload", "index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    createMenus(mainWindow);
    initSettingsIPC(mainWindow);
    createTray(mainWindow);

    mainWindow.loadURL(getLoadUrl(settings));

    mainWindow.on("closed", () => {
      mainWindow = null;
      bootstrapped = false;
    });

    bootstrapped = true;
  } catch (err) {
    console.error("Bootstrap failed:", err);
  } finally {
    bootstrapping = false;
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(bootstrap);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!bootstrapped && !bootstrapping) {
    bootstrap();
  }
});
