# Hermes Web UI — Electron Wrapper

## Project Overview

This is an Electron wrapper for [hermes-web-ui](https://github.com/EKKOLearnAI/hermes-web-ui), the community-built web dashboard for [Hermes Agent](https://github.com/NousResearch/hermes-agent). The goal is to package the existing Vue 3 + Koa BFF application as a native desktop app for macOS, Windows, and Linux, providing a first-class desktop experience with system tray integration, native menus, and zero-config setup.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Electron Main Process                          │
│  ├── Koa BFF server (existing, unchanged)       │
│  │   ├── API proxy → Hermes Gateway (:8642)     │
│  │   ├── Session CRUD via Hermes CLI            │
│  │   ├── Config/credential management           │
│  │   ├── File upload/download                   │
│  │   └── node-pty terminal bridge               │
│  ├── System tray                                │
│  ├── Native menus (app, edit, view, help)       │
│  ├── Auto-updater (electron-updater)            │
│  └── Window lifecycle management                │
│                                                  │
│  BrowserWindow                                  │
│  ├── Loads Vue 3 SPA from Koa (localhost:0)     │
│  ├── node-pty → xterm (via IPC, not WS)        │
│  └── Preload script for native bridge APIs      │
└─────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Koa server runs inside main process** — not as a separate child process. The server binds to `localhost` on a random available port (port 0) to avoid conflicts. The BrowserWindow loads `http://localhost:{assignedPort}`.

2. **Terminal WebSocket → IPC bridge** — Instead of Socket.IO over localhost (which leaks terminal I/O to any local process), the existing `node-pty` instance runs in the main process and communicates with the renderer via Electron's IPC. The preload script exposes `window.electronAPI.terminal` methods that the Vue frontend calls instead of WebSocket.

3. **Vue frontend changes are minimal** — A thin adapter layer detects `window.electronAPI` and routes terminal I/O through IPC instead of WebSocket. All other API calls (`/api/hermes/*`) continue to hit the local Koa server via HTTP.

4. **Hermes Gateway discovery** — On launch, the app checks if a Hermes gateway is already running on port 8642. If not, it offers to start one via `hermes gateway`. The user can also point to a remote gateway.

5. **Packaging** — electron-builder with multi-platform targets. The `hermes` CLI binary is NOT bundled (users install it separately). The app detects `hermes` on PATH and validates the version.

## Source Upstream

The upstream hermes-web-ui repo is at `https://github.com/EKKOLearnAI/hermes-web-ui`. We consume it as an npm dependency (`hermes-web-ui`) rather than forking it. Our Electron wrapper imports and re-exports the Koa server and serves the static SPA assets.

## File Structure

```
hermes-web-ui-electron/
├── AGENTS.md                  # This file — engineering plan
├── package.json               # Electron app package
├── tsconfig.json              # TypeScript config for main process
├── electron-builder.yml       # Build & packaging config
├── src/
│   ├── main/
│   │   ├── index.ts           # Electron main entry — starts Koa, creates window
│   │   ├── tray.ts            # System tray icon & context menu
│   │   ├── menus.ts           # Native application menus
│   │   ├── terminal.ts        # node-pty manager, IPC bridge
│   │   ├── gateway.ts         # Hermes gateway discovery & lifecycle
│   │   ├── updater.ts         # Auto-update logic
│   │   └── server.ts          # Koa BFF server bootstrap (wraps hermes-web-ui)
│   ├── preload/
│   │   └── index.ts           # Preload script — exposes safe IPC APIs to renderer
│   └── renderer-adapter/
│       ├── terminal-bridge.ts # Detects electron vs browser, routes terminal I/O
│       └── inject.ts          # Script injected into BrowserWindow to patch WS→IPC
├── resources/
│   ├── icon.icns              # macOS app icon
│   ├── icon.ico               # Windows app icon
│   └── icon.png               # Linux app icon
├── scripts/
│   └── build.sh               # Build script
└── .github/
    └── workflows/
        └── release.yml        # CI: build & publish for all platforms
```

## Implementation Phases

### Phase 1: Minimal Viable App (Day 1)

- Electron main process that starts the Koa server from `hermes-web-ui`
- Single BrowserWindow loading the SPA from localhost
- Basic app icon and window title
- `npm start` launches the app
- No terminal support yet (terminal tab shows "not available in desktop mode" or falls back to WebSocket)

### Phase 2: Terminal IPC Bridge (Day 2)

- Move `node-pty` from Koa WebSocket handler to Electron main process
- IPC channels: `terminal:create`, `terminal:input`, `terminal:output`, `terminal:resize`, `terminal:close`
- Preload script exposes `window.electronAPI.terminal.*`
- Renderer adapter patches the Vue terminal component to use IPC
- Multi-session terminal support (multiple pty instances)

### Phase 3: Native Integration (Day 3)

- System tray with status indicator (gateway connected/disconnected)
- Native menus: App (preferences, about, quit), Edit (standard), View (zoom, dev tools, fullscreen), Help
- Gateway lifecycle: auto-detect, start/stop from menu or tray
- Deep links: `hermes://` protocol handler for opening sessions
- Notification integration: OS-native notifications for cron jobs, long-running tasks

### Phase 4: Packaging & Distribution (Day 4)

- electron-builder config for macOS (.dmg, .zip), Windows (.exe, .msi), Linux (.AppImage, .deb)
- Code signing setup (macOS Developer ID, Windows Authenticode)
- Auto-updater via GitHub Releases
- NSIS installer customization (Windows)
- DMG background + icon positioning (macOS)

### Phase 5: Polish & Edge Cases (Day 5+)

- Single instance lock (prevent multiple app instances)
- Graceful shutdown (stop gateway if we started it, save state)
- Offline mode detection (show banner when gateway unreachable)
- Custom title bar (optional, for consistent theming across platforms)
- Accessibility audit (keyboard navigation, screen reader labels)
- Crash reporting (optional, via Sentry or similar)

## Technical Constraints

- **Node.js**: Must run on Node 23+ (requirement from hermes-web-ui v0.4.9+)
- **Electron**: Use latest stable Electron (v34+)
- **Hermes Agent**: Must be installed separately (`curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash`). The app does NOT bundle the agent.
- **Platform**: macOS (Apple Silicon + Intel), Windows 10+, Ubuntu 22.04+
- **No native modules in renderer**: All Node-native code (node-pty, SQLite) stays in main process

## Dependencies

```json
{
  "dependencies": {
    "hermes-web-ui": "^0.4.9",
    "electron-updater": "^6.x"
  },
  "devDependencies": {
    "electron": "^34.0.0",
    "electron-builder": "^25.0.0",
    "typescript": "^5.x"
  }
}
```

## Build & Run Commands

```bash
# Development
npm install
npm run dev          # Starts Electron with hot-reload on main process changes

# Build
npm run build        # Compiles TypeScript
npm run pack         # Packages app without installer (for testing)

# Distribution
npm run dist         # Builds installers for current platform
npm run dist:mac     # macOS only
npm run dist:win     # Windows only
npm run dist:linux   # Linux only
```

## Known Risks

1. **hermes-web-ui as npm dependency** — The package may not export its Koa server and static assets cleanly for programmatic use. We may need to fork and add exports, or shell out to the CLI and proxy.
2. **Terminal IPC latency** — WebSocket over localhost is ~0.1ms. IPC has similar performance but we need to benchmark with high-throughput terminal output (e.g., `cat /dev/urandom`).
3. **Gateway port conflicts** — If the user runs `hermes gateway` separately AND the app starts one, we get double gateways. Need clear UX for "managed" vs "external" gateway mode.
4. **Code signing costs** — Apple Developer ($99/yr) and Windows Authenticode certificates are required for distribution without scary warnings.

## Testing Strategy

- **Unit tests**: Main process modules (gateway discovery, terminal manager, server bootstrap)
- **Integration tests**: Spectron or Playwright for Electron — test window opens, chat works, terminal spawns
- **Manual QA matrix**: macOS (ARM + Intel), Windows 11, Ubuntu 24.04
