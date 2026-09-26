const fs = require("node:fs");
const path = require("node:path");

const apiUrl = process.env.API_URL?.trim();

if (!apiUrl) {
  console.error("API_URL must be set to the public backend URL");
  process.exit(1);
}

let parsedApiUrl;
try {
  parsedApiUrl = new URL(apiUrl);
} catch {
  console.error("API_URL must be a valid absolute HTTP or HTTPS URL");
  process.exit(1);
}

if (
  !["http:", "https:"].includes(parsedApiUrl.protocol) ||
  parsedApiUrl.username ||
  parsedApiUrl.password
) {
  console.error("API_URL must use HTTP or HTTPS and must not contain credentials");
  process.exit(1);
}

const runtimeConfig = `window.__FLAVORDEX_CONFIG__ = ${JSON.stringify({ apiUrl: apiUrl.replace(/\/+$/, "") })};\n`;
fs.writeFileSync(path.join(__dirname, "public", "runtime-config.js"), runtimeConfig, {
  encoding: "utf8",
  mode: 0o644,
});

require("./server.js");
