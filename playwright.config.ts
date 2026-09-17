import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
}
const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (
  !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname) ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname,
  )
)
  throw new Error("E2E only supports local synthetic environments.");
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    trace: "off",
    screenshot: "only-on-failure",
  },
  outputDir: "test-results",
});
