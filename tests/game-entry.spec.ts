import { expect, test, type Page } from '@playwright/test';
import { env } from '../src/config';
import { UI_ENTRY_POINTS, URL_ENTRY_POINTS, urlFor } from '../src/entry-points';
import { registerPopupHandlers, waitForGame } from '../src/game';

test.skip(!env.gameId, 'Set FB_GAME_ID trong .env');

const game = { id: env.gameId, name: env.gameName };

test.beforeEach(async ({ page }) => {
  await registerPopupHandlers(page);
});

/** Metadata có cấu trúc cho dashboard reporter (xem reporters/dashboard-reporter.ts) */
function annotate(type: string, description: string) {
  test.info().annotations.push({ type: `ep.${type}`, description });
}

async function expectEntryPoint(page: Page, expected: string, via?: RegExp) {
  const info = await waitForGame(page, game.id);
  annotate('actual', info.entryPoint ?? '');
  annotate('url', info.pageUrl);
  // JPEG nhỏ gọn để đưa lên dashboard (PNG full size ~1MB/ảnh)
  await test.info().attach('game', { body: await page.screenshot({ type: 'jpeg', quality: 60 }), contentType: 'image/jpeg' });

  const url = new URL(info.pageUrl);
  expect(url.pathname).toContain(`/gaming/play/${game.id}`);
  if (via) expect(url.searchParams.get('source') ?? '', 'test đã bấm nhầm link khác').toMatch(via);
  expect(info.entryPoint, `URL: ${info.pageUrl}`).toBe(expected);
}

test.describe('Entry point qua UI', () => {
  for (const ep of UI_ENTRY_POINTS) {
    test(`${ep.name} → ${ep.expected}`, async ({ page }) => {
      annotate('kind', 'UI');
      annotate('name', ep.name);
      annotate('expected', ep.expected);
      test.skip(!!ep.needsGameName && !game.name, 'Set FB_GAME_NAME trong .env');
      await ep.open(page, game);
      await page.waitForURL(new RegExp(`/gaming/play/${game.id}`));
      await expectEntryPoint(page, ep.expected, ep.via);
    });
  }
});

test.describe('Entry point qua URL', () => {
  for (const ep of URL_ENTRY_POINTS) {
    test(`${ep.name} (source=${ep.source ?? '∅'}) → ${ep.expected}`, async ({ page }) => {
      annotate('kind', 'URL');
      annotate('name', ep.name);
      annotate('source', ep.source ?? '');
      annotate('expected', ep.expected);
      await page.goto(urlFor(game.id, ep.source));
      await expectEntryPoint(page, ep.expected);
    });
  }
});
