#!/bin/bash
set -e

echo "=== Diagnosing Electron install ==="
echo "Node: $(node -v)"
echo "npm: $(npm -v)"
echo "Platform: $(uname -s) $(uname -m)"
echo ""

echo "=== Checking electron module ==="
ls -la node_modules/electron/path.txt 2>/dev/null || echo "path.txt MISSING"
ls -la node_modules/electron/dist/ 2>/dev/null || echo "dist/ MISSING"
echo ""

echo "=== Force-downloading Electron binary ==="
cd node_modules/electron && node install.js
cd ../..

echo ""
echo "=== Verifying ==="
npx electron --version
echo ""
echo "=== Done ==="
