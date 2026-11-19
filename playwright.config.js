// @ts-check
const { defineConfig } = require("@playwright/test");
const { execSync } = require("child_process");

// Linux and Mac call it "python3". Windows calls it "python", or only "py" when Python came from python.org's launcher.
function python() {
  if (process.platform !== "win32") return "python3";
  try { execSync("python --version", { stdio: "ignore" }); return "python"; } catch { return "py"; }
}

module.exports = defineConfig({
  // "stable" tests the live app at /, "beta" tests the test version at /beta/
  projects: [
    { name: "stable", testDir: "tests", use: { baseURL: "http://localhost:4173/" } },
    { name: "beta", testDir: "beta/tests", use: { baseURL: "http://localhost:4173/beta/" } }
  ],
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block"
  },
  webServer: {
    command: python() + " -m http.server 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore"
  }
});
