import { Menu, BrowserWindow } from "electron";
import { openSettingsWindow } from "./settings";

export function createMenus(mainWindow: BrowserWindow | null) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Hermes Agent",
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings...",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            if (mainWindow) openSettingsWindow(mainWindow);
          },
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Hermes Agent Docs",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal(
              "https://hermes-agent.nousresearch.com/docs/"
            );
          },
        },
        {
          label: "Report Issue",
          click: async () => {
            const { shell } = require("electron");
            await shell.openExternal(
              "https://github.com/hankbobtheresearchoor/hermes-web-ui-electron/issues"
            );
          },
        },
      ],
    },
  ];

  if (process.platform === "win32" || process.platform === "linux") {
    template.unshift({
      label: "File",
      submenu: [
        {
          label: "Settings...",
          accelerator: "Ctrl+,",
          click: () => {
            if (mainWindow) openSettingsWindow(mainWindow);
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    } as Electron.MenuItemConstructorOptions);
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
