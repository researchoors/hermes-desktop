import { execSync } from "child_process";

export async function discoverGateway(): Promise<{
  running: boolean;
  port: number;
  pid: number | null;
  version: string | null;
}> {
  try {
    const health = execSync(
      "curl -s http://127.0.0.1:8642/health",
      { timeout: 3000, encoding: "utf-8" }
    );
    const parsed = JSON.parse(health);
    if (parsed.status === "ok") {
      return { running: true, port: 8642, pid: null, version: null };
    }
  } catch {}

  return { running: false, port: 8642, pid: null, version: null };
}
