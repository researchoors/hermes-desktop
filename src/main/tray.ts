import { Tray, Menu, nativeImage, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import { openSettingsWindow } from "./settings";

export function createTray(mainWindow: BrowserWindow) {
  const iconPath = path.join(__dirname, "..", "..", "resources", "icon.png");
  let icon: Electron.NativeImage;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    icon = nativeImage.createEmpty();
  }
  if (icon.isEmpty()) {
    return;
  }
  const tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Hermes", click: () => mainWindow.show() },
    { label: "Settings...", click: () => openSettingsWindow(mainWindow) },
    { type: "separator" },
    { label: "Quit", click: () => mainWindow.close() },
  ]);

  tray.setToolTip("Hermes Agent");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    mainWindow.show();
  });
}
