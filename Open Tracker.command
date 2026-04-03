#!/bin/zsh
cd "$(dirname "$0")"

# Kill any previous instance on this port
lsof -ti :5173 | xargs kill -9 2>/dev/null

# Start dev server in background
npm run dev &

# Wait for it to be ready
until curl -s http://localhost:5173 > /dev/null; do sleep 0.3; done

# Open in browser
open http://localhost:5173
