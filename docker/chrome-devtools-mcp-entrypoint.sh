#!/bin/sh
set -eu
chromium --headless --no-sandbox --disable-dev-shm-usage --disable-gpu --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 about:blank >/tmp/chromium.log 2>&1 &
for attempt in $(seq 1 50); do
  if curl --fail --silent http://127.0.0.1:9222/json/version >/dev/null; then
    exec node /usr/local/lib/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js --browserUrl http://127.0.0.1:9222 --no-usage-statistics --no-performance-crux "$@"
  fi
  sleep 0.1
done
cat /tmp/chromium.log >&2
echo "Chromium did not start its DevTools endpoint." >&2
exit 1
