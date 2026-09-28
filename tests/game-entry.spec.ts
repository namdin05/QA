import { expect, test, type Page } from '@playwright/test';
import { env } from '../src/config';
import { UI_ENTRY_POINTS, URL_ENTRY_POINTS, urlFor } from '../src/entry-points';
import {
  clickGameNode,
  getGameFrame,
  getSceneName,
  isNodeActive,
  registerPopupHandlers,
  waitForGame,
  waitForNodeActive,
  waitForScene,
  waitForSceneChange,
} from '../src/game';

test.skip(!env.gameId, 'Set FB_GAME_ID trong .env');

const game = { id: env.gameId, name: env.gameName };

test.beforeEach(async ({ page }) => {
  await registerPopupHandlers(page);
});

/** Metadata có cấu trúc cho dashboard reporter (xem reporters/dashboard-reporter.ts) */
function annotate(type: string, description: string) {
  test.info().annotations.push({ type: `ep.${type}`, description });
}

const screenshot = async (page: Page, name: string) =>
  test.info().attach(name, { body: await page.screenshot({ type: 'jpeg', quality: 60 }), contentType: 'image/jpeg' });

/**
 * 1. Chờ FBInstant init -> kiểm tra entry point game nhận được
 * 2. Chờ game vào màn hình chính (FB_GAME_READY_SCENE) -> bấm nút (FB_GAME_CHECK_BUTTON, mặc định Settings)
 *    -> popup phải hiện (FB_GAME_CHECK_EXPECT_NODE) hoặc scene phải đổi, chứng minh game đã nhận thao tác.
 *    Toàn bộ quá trình được quay video.
 */
async function enterGame(page: Page, startedAt: number, expected: string, via?: RegExp) {
  const info = await test.step('Chờ FBInstant khởi tạo', () => waitForGame(page, game.id));
  annotate('actual', info.entryPoint ?? '');
  annotate('url', info.pageUrl);

  await test.step(`Kiểm tra entry point = ${expected}`, async () => {
    const url = new URL(info.pageUrl);
    expect(url.pathname).toContain(`/gaming/play/${game.id}`);
    if (via) expect.soft(url.searchParams.get('source') ?? '', 'test đã bấm nhầm link khác').toMatch(via);
    // soft: entry point sai vẫn chạy tiếp bước bấm nút để có đủ video/ảnh khi điều tra
    expect.soft(info.entryPoint, `URL: ${info.pageUrl}`).toBe(expected);
  });

  if (!env.readyScene || !env.checkButton) {
    annotate('play', 'skipped: chưa cấu hình FB_GAME_READY_SCENE / FB_GAME_CHECK_BUTTON');
    await screenshot(page, 'game');
    return;
  }

  const frame = getGameFrame(page, game.id);
  await test.step(`Chờ game load xong (${env.readyScene})`, () => waitForScene(frame, env.readyScene));
  annotate('ready_ms', String(Date.now() - startedAt));
  await page.waitForTimeout(1_000); // chờ animation vào màn hình ổn định
  await screenshot(page, 'dashboard');

  const buttonName = env.checkButton.split('/').pop();
  await test.step(`Bấm nút ${buttonName} trong game`, async () => {
    // Popup phải chưa hiện trước khi bấm, nếu không thì kiểm tra sau đó không chứng minh được gì
    if (env.checkExpectNode) expect(await isNodeActive(frame, env.checkExpectNode), 'popup đã hiện sẵn trước khi bấm').toBe(false);
    await clickGameNode(frame, env.checkButton);
    if (env.checkExpectNode) await waitForNodeActive(frame, env.checkExpectNode);
    else await waitForSceneChange(frame, env.readyScene);
  });
  const result = env.checkExpectNode ? env.checkExpectNode.split('/').pop() : await getSceneName(frame);
  annotate('play', `${buttonName} → ${result}`);
  await page.waitForTimeout(1_500); // để video/ảnh thấy rõ kết quả
  await screenshot(page, 'game');
}

test.describe('Entry point qua UI', () => {
  for (const ep of UI_ENTRY_POINTS) {
    test(`${ep.name} → ${ep.expected}`, async ({ page }) => {
      annotate('kind', 'UI');
      annotate('name', ep.name);
      annotate('expected', ep.expected);
      test.skip(!!ep.needsGameName && !game.name, 'Set FB_GAME_NAME trong .env');
      const startedAt = Date.now();
      await test.step('Đi tới game qua UI Facebook', async () => {
        await ep.open(page, game);
        await page.waitForURL(new RegExp(`/gaming/play/${game.id}`));
      });
      await enterGame(page, startedAt, ep.expected, ep.via);
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
      const startedAt = Date.now();
      await page.goto(urlFor(game.id, ep.source));
      await enterGame(page, startedAt, ep.expected);
    });
  }
});
