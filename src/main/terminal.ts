import { ipcMain, BrowserWindow } from "electron";
import os from "os";
import path from "path";

const pty = require("node-pty");

interface TerminalSession {
  ptyProcess: any;
  id: string;
}

const sessions = new Map<string, TerminalSession>();

export function initTerminalIPC(mainWindow: BrowserWindow) {
  const shell =
    process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/zsh";

  ipcMain.handle("terminal:create", (event, id: string) => {
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cwd: os.homedir(),
      env: process.env as Record<string, string>,
    });

    sessions.set(id, { ptyProcess, id });

    ptyProcess.onData((data: string) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("terminal:output", { id, data });
      }
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("terminal:exit", { id, exitCode });
      }
      sessions.delete(id);
    });

    return { success: true };
  });

  ipcMain.handle("terminal:input", (event, { id, data }: { id: string; data: string }) => {
    const session = sessions.get(id);
    if (session) {
      session.ptyProcess.write(data);
      return { success: true };
    }
    return { success: false };
  });

  ipcMain.handle(
    "terminal:resize",
    (event, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
      const session = sessions.get(id);
      if (session) {
        session.ptyProcess.resize(cols, rows);
        return { success: true };
      }
      return { success: false };
    }
  );

  ipcMain.handle("terminal:close", (event, { id }: { id: string }) => {
    const session = sessions.get(id);
    if (session) {
      session.ptyProcess.kill();
      sessions.delete(id);
      return { success: true };
    }
    return { success: false };
  });
}
