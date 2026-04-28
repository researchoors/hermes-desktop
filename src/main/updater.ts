import { autoUpdater } from "electron-updater";
import { BrowserWindow } from "electron";

export function initAutoUpdater(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    mainWindow.webContents.send("updater:available", info);
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("updater:progress", progress);
  });

  autoUpdater.on("update-downloaded", () => {
    mainWindow.webContents.send("updater:downloaded");
  });

  autoUpdater.checkForUpdates().catch(() => {});
}
