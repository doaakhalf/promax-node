const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const LOCAL = "http://localhost:3000";
const RAILWAY = "https://promax-node-production-7c35.up.railway.app";

const raw = (process.env.API_TARGET || "local").trim().toLowerCase();
const target =
  raw === "railway" || raw === "prod" || raw === "production"
    ? RAILWAY
    : raw === "local" || raw === "dev"
      ? LOCAL
      : process.env.API_TARGET || LOCAL;

const secure = target.startsWith("https");
console.log(`[admin proxy] ${target}`);

module.exports = {
  "/api": { target, secure, changeOrigin: true },
  "/images": { target, secure, changeOrigin: true },
};
