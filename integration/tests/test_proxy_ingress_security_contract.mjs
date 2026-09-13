#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nginxConfig = await readFile(path.join(root, "nginx/default.conf"), "utf8");

function forwardedAuthority(requestHost) {
  return requestHost;
}

function originMatchesForwardedAuthority(origin, authority) {
  return new URL(origin).host === authority;
}

assert.match(
  nginxConfig,
  /proxy_set_header Host \$http_host;/,
  "the proxy must preserve the published port in the forwarded Host header",
);
assert.doesNotMatch(
  nginxConfig,
  /proxy_set_header Host \$host;/,
  "the proxy must not drop the published port from Host",
);
assert.match(
  nginxConfig,
  /proxy_set_header X-Forwarded-Proto \$scheme;/,
  "the proxy must overwrite client X-Forwarded-Proto with nginx's trusted scheme",
);
assert.match(
  nginxConfig,
  /proxy_set_header X-Forwarded-Host \$http_host;/,
  "the proxy must overwrite client X-Forwarded-Host with the port-preserving request host",
);

const publishedAuthority = forwardedAuthority("depot.example.test:19096");
assert.equal(
  originMatchesForwardedAuthority("https://depot.example.test:19096", publishedAuthority),
  true,
  "the published-port origin must match the forwarded authority",
);
assert.equal(
  originMatchesForwardedAuthority("https://depot.example.test:19097", publishedAuthority),
  false,
  "an origin using a different published port must be rejected",
);

console.log("proxy ingress security contract: passed");
