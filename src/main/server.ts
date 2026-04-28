import { spawn, ChildProcess, execSync } from "child_process";
import net from "net";
import path from "path";
import fs from "fs";
import os from "os";
import { loadSettings } from "./settings";

let child: ChildProcess | null = null;

function resolveServerEntry(): string {
  const modPaths = require.resolve.paths("hermes-web-ui/package.json") || [];
  for (const modPath of modPaths) {
    const candidate = path.join(modPath, "hermes-web-ui", "package.json");
    try {
      fs.accessSync(candidate);
      return path.join(path.dirname(candidate), "dist", "server", "index.js");
    } catch {}
  }
  throw new Error(
    "hermes-web-ui package not found. Install it with: npm install hermes-web-ui"
  );
}

function findNodeBinary(): string {
  if (process.env.ELECTRON_NODE_PATH) return process.env.ELECTRON_NODE_PATH;
  try {
    return execSync("which node", { encoding: "utf-8" }).trim();
  } catch {}
  const homebrew = "/opt/homebrew/bin/node";
  if (fs.existsSync(homebrew)) return homebrew;
  throw new Error("Cannot find Node.js binary. Set ELECTRON_NODE_PATH env var.");
}

function getRandomPort(): number {
  return 10000 + Math.floor(Math.random() * 50000);
}

function waitForPort(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function probe() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server never listened on port ${port} after ${timeoutMs}ms`));
      }
      const sock = net.createConnection({ host: "127.0.0.1", port }, () => {
        sock.destroy();
        resolve();
      });
      sock.on("error", () => setTimeout(probe, 300));
      sock.setTimeout(2000, () => { sock.destroy(); setTimeout(probe, 300); });
    }
    setTimeout(probe, 300);
  });
}

function waitForListening(streams: NodeJS.ReadableStream[], timeoutMs = 15000): Promise<number> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Server did not print 'listening on port' within timeout"));
    }, timeoutMs);

    function onData(data: Buffer) {
      buf += data.toString();
      const match = buf.match(/listening on port (\d+)/);
      if (match) {
        clearTimeout(timer);
        cleanup();
        resolve(parseInt(match[1], 10));
      }
    }

    function cleanup() {
      for (const s of streams) {
        s.off("data", onData);
        s.off("close", onEarlyExit);
      }
    }

    function onEarlyExit() {
      clearTimeout(timer);
      cleanup();
      reject(new Error("Server process exited before printing listening port"));
    }

    for (const s of streams) {
      s.on("data", onData);
      s.on("close", onEarlyExit);
    }
  });
}

function writeHermesEnv(apiKey: string): void {
  const hermesDir = path.join(os.homedir(), ".hermes");
  const envFile = path.join(hermesDir, ".env");
  fs.mkdirSync(hermesDir, { recursive: true });
  let content = "";
  if (fs.existsSync(envFile)) {
    content = fs.readFileSync(envFile, "utf-8");
    content = content.replace(/^API_SERVER_KEY\s*=.*$/m, `API_SERVER_KEY=${apiKey}`);
    if (!content.includes("API_SERVER_KEY")) {
      content += `\nAPI_SERVER_KEY=${apiKey}`;
    }
  } else {
    content = `API_SERVER_KEY=${apiKey}\n`;
  }
  fs.writeFileSync(envFile, content, "utf-8");
}

export async function startServer(): Promise<number> {
  const settings = loadSettings();
  const serverEntry = resolveServerEntry();
  const port = getRandomPort();

  if (settings.gatewayApiKey) {
    writeHermesEnv(settings.gatewayApiKey);
  }

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    PORT: String(port),
    HOST: "127.0.0.1",
  };

  if (settings.gatewayUrl) {
    env.UPSTREAM = settings.gatewayUrl;
  }

  const tokenFile = path.join(os.homedir(), ".hermes-web-ui", ".token");
  try {
    const token = fs.readFileSync(tokenFile, "utf-8").trim();
    if (token) env.AUTH_TOKEN = token;
  } catch {}

  if (settings.disableAuth) {
    env.AUTH_DISABLED = "1";
    delete env.AUTH_TOKEN;
  }

  const nodeBin = findNodeBinary();

  child = spawn(nodeBin, [serverEntry], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(data);
  });

  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(data);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`hermes-web-ui server exited with code ${code}`);
    }
    child = null;
  });

  const listeningPort = await waitForListening([child.stdout!, child.stderr!], 15000);
  await waitForPort(listeningPort, 5000);
  return listeningPort;
}

export function stopServer(): void {
  if (child) {
    child.kill("SIGTERM");
    child = null;
  }
}
