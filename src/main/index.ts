import { app, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { startServer, stopServer } from "./server";
import { createTray } from "./tray";
import { createMenus } from "./menus";
import { initTerminalIPC } from "./terminal";
import { discoverGateway } from "./gateway";
import { initSettingsIPC, openSettingsWindow } from "./settings";

let mainWindow: BrowserWindow | null = null;
let serverPort: number | null = null;
let bootstrapped = false;
let bootstrapping = false;

async function bootstrap() {
  if (bootstrapping) return;
  bootstrapping = true;

  try {
    const gatewayInfo = await discoverGateway();

    serverPort = await startServer();

    createMenus(mainWindow);

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

    initTerminalIPC(mainWindow);
    initSettingsIPC(mainWindow);

    createTray(mainWindow, gatewayInfo);

    let loadUrl = `http://127.0.0.1:${serverPort}`;
    const tokenFile = path.join(os.homedir(), ".hermes-web-ui", ".token");
    try {
      const token = fs.readFileSync(tokenFile, "utf-8").trim();
      if (token) loadUrl += `/#/?token=${token}`;
    } catch {}

    mainWindow.loadURL(loadUrl);

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

app.on("before-quit", () => {
  stopServer();
});
