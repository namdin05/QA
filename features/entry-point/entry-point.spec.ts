/**
 * Vào game từ nhiều entry point (UI và URL), kiểm tra FBInstant.getEntryPointAsync() đúng giá trị,
 * rồi chứng minh đã vào game thành công bằng cách bấm nút kiểm tra trong game. Mỗi test đều quay video.
 */
import { expect, test } from '../../src/fixtures';
import { pressCheckButton, waitUntilGameReady } from '../../src/game-check';
import { waitForGame } from '../../src/game';
import { note } from '../../src/report';
import type { GameConfig } from '../../games/types';
import type { Page } from '@playwright/test';
import { UI_ENTRY_POINTS, URL_ENTRY_POINTS, urlFor } from './entry-points';

test.use({ video: { mode: 'on', size: { width: 960, height: 600 } } });

async function enterGame(page: Page, game: GameConfig, startedAt: number, expected: string, via?: RegExp) {
  const info = await test.step('Chờ FBInstant khởi tạo', () => waitForGame(page, game.id));
  note('actual', info.entryPoint ?? '');
  note('url', info.pageUrl);

  await test.step(`Kiểm tra entry point = ${expected}`, async () => {
    const url = new URL(info.pageUrl);
    expect(url.pathname).toContain(`/gaming/play/${game.id}`);
    if (via) expect.soft(url.searchParams.get('source') ?? '', 'test đã bấm nhầm link khác').toMatch(via);
    // soft: entry point sai vẫn chạy tiếp bước bấm nút để có đủ video/ảnh khi điều tra
    expect.soft(info.entryPoint, `URL: ${info.pageUrl}`).toBe(expected);
  });

  const frame = await waitUntilGameReady(page, game, startedAt);
  if (frame) await pressCheckButton(page, frame, game);
}

test.describe('Entry point qua UI', () => {
  for (const ep of UI_ENTRY_POINTS) {
    test(`${ep.name} → ${ep.expected}`, async ({ page, game }) => {
      note('kind', 'UI');
      note('name', ep.name);
      note('expected', ep.expected);
      const startedAt = Date.now();
      await test.step('Đi tới game qua UI Facebook', async () => {
        await ep.open(page, game);
        await page.waitForURL(new RegExp(`/gaming/play/${game.id}`));
      });
      await enterGame(page, game, startedAt, ep.expected, ep.via);
    });
  }
});

test.describe('Entry point qua URL', () => {
  for (const ep of URL_ENTRY_POINTS) {
    test(`${ep.name} (source=${ep.source ?? '∅'}) → ${ep.expected}`, async ({ page, game }) => {
      note('kind', 'URL');
      note('name', ep.name);
      note('source', ep.source ?? '');
      note('expected', ep.expected);
      const startedAt = Date.now();
      await page.goto(urlFor(game.id, ep.source));
      await enterGame(page, game, startedAt, ep.expected);
    });
  }
});
