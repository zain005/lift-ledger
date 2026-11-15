// @ts-check
const { defineConfig } = require("@playwright/test");

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
    command: "python3 -m http.server 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore"
  }
});
