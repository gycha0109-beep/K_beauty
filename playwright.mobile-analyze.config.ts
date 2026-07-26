import { defineConfig, devices } from "playwright/test";

const baseURL = "http://127.0.0.1:3107";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /mobile-analyze-browser-flow\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  timeout: 60000,
  expect: {
    timeout: 15000
  },
  use: {
    ...devices["Pixel 5"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p 3107",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `${baseURL}/__mobile-e2e-supabase`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mobile.e2e.local"
    }
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Pixel 5"]
      }
    }
  ]
});
