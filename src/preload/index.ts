import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    save: (settings: any) => ipcRenderer.invoke("settings:save", settings),
    openWindow: () => ipcRenderer.invoke("settings:openWindow"),
  },
});
