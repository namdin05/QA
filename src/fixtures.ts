/**
 * `test` dùng chung cho mọi feature. Mỗi project Playwright ứng với 1 game (xem playwright.config.ts)
 * và truyền config game vào qua fixture `game`.
 */
import { test as base } from '@playwright/test';
import type { GameConfig } from '../games/types';
import { realUserAgent } from './browser';
import { registerPopupHandlers } from './game';

export const test = base.extend<{}, { game: GameConfig }>({
  game: [undefined as unknown as GameConfig, { option: true, scope: 'worker' }],
  // Chạy ẩn: thay UA "HeadlessChrome" bằng UA thật. Test giả lập thiết bị đã set UA riêng -> giữ nguyên
  userAgent: async ({ userAgent, headless, browser, channel }, use) => {
    await use(userAgent ?? (headless ? realUserAgent(browser, channel) : undefined));
  },
  // Tự đóng popup của Facebook/trình duyệt ở mọi test
  page: async ({ page }, use) => {
    await registerPopupHandlers(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
