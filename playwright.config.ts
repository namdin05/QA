import fs from 'node:fs';
import { defineConfig } from '@playwright/test';
import { GAMES } from './games';
import type { GameConfig } from './games/types';
import { FB_URL, authPaths, env } from './src/config';

export default defineConfig<{ game: GameConfig }>({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Dùng chung 1 tài khoản -> chạy tuần tự để tránh Facebook nghi ngờ nhiều phiên song song
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./reporters/dashboard-reporter.ts', { outputDir: 'docs', maxVideoRuns: 5 }],
  ],
  use: {
    baseURL: FB_URL,
    headless: env.headless,
    channel: env.channel,
    locale: 'vi-VN',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Mỗi game 1 project: chạy mọi feature dùng chung + feature riêng trong games/<slug>/features
  //   npx playwright test --project=snake-escape features/responsive
  projects: GAMES.map((game) => {
    const { stateFile } = authPaths(game.slug);
    return {
      name: game.slug,
      testMatch: ['features/**/*.spec.ts', `games/${game.slug}/features/**/*.spec.ts`],
      use: { game, storageState: fs.existsSync(stateFile) ? stateFile : undefined },
    };
  }),
});
