import { spawn, ChildProcess, execSync } from "child_process";
import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import { loadSettings, Settings } from "./settings";

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

function waitForHealth(port: number, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function poll() {
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server not healthy on port ${port} after ${timeoutMs}ms`));
      }
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        res.resume();
        if (res.statusCode === 200 || res.statusCode === 302) {
          resolve();
        } else {
          setTimeout(poll, 300);
        }
      });
      req.on("error", () => setTimeout(poll, 300));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(poll, 300); });
    }
    setTimeout(poll, 300);
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

  let resolvedPort = port;
  let stdoutBuf = "";

  child = spawn(nodeBin, [serverEntry], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (data: Buffer) => {
    const chunk = data.toString();
    stdoutBuf += chunk;
    process.stdout.write(chunk);
    const match = stdoutBuf.match(/listening on port (\d+)/);
    if (match) {
      resolvedPort = parseInt(match[1], 10);
    }
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

  await new Promise<void>((resolve, reject) => {
    child?.on("spawn", () => resolve());
    child?.on("error", reject);
  });

  await waitForHealth(resolvedPort, 15000);
  return resolvedPort;
}

export function stopServer(): void {
  if (child) {
    child.kill("SIGTERM");
    child = null;
  }
}
