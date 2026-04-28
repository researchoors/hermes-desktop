#!/bin/bash
set -e

echo "Building hermes-web-ui-electron..."

npm install
npx tsc

echo "Build complete. Run 'npm run dev' to start."
