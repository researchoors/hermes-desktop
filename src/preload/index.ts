import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,

  terminal: {
    create: (id: string) => ipcRenderer.invoke("terminal:create", id),
    input: (id: string, data: string) =>
      ipcRenderer.invoke("terminal:input", { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", { id, cols, rows }),
    close: (id: string) => ipcRenderer.invoke("terminal:close", { id }),
    onOutput: (callback: (data: { id: string; data: string }) => void) => {
      ipcRenderer.on("terminal:output", (_event, data) => callback(data));
    },
    onExit: (callback: (data: { id: string; exitCode: number }) => void) => {
      ipcRenderer.on("terminal:exit", (_event, data) => callback(data));
    },
  },

  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    save: (settings: any) => ipcRenderer.invoke("settings:save", settings),
    openWindow: () => ipcRenderer.invoke("settings:openWindow"),
  },
});
