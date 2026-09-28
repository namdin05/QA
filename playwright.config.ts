import fs from 'node:fs';
import { defineConfig } from '@playwright/test';
import { FB_URL, STATE_FILE, env } from './src/config';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Dùng chung 1 tài khoản -> chạy tuần tự để tránh Facebook nghi ngờ nhiều phiên song song
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }], ['./reporters/dashboard-reporter.ts', { outputDir: 'docs', maxVideoRuns: 5 }]],
  use: {
    baseURL: FB_URL,
    storageState: fs.existsSync(STATE_FILE) ? STATE_FILE : undefined,
    headless: env.headless,
    channel: env.channel,
    locale: 'vi-VN',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Quay video mọi test làm bằng chứng vào game; thu nhỏ 2/3 cho nhẹ (~1MB/test)
    video: { mode: 'on', size: { width: 960, height: 600 } },
  },
});
