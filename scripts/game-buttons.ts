/**
 * Mở game và in ra scene hiện tại + các nút bấm được, để điền `cocos` trong games/<slug>/config.ts.
 *
 *   npm run game:buttons -- <slug>
 */
import { realUserAgent } from '../src/browser';
import { chromium } from '@playwright/test';
import { getGame } from '../games';
import { getSceneName, listGameButtons } from '../src/cocos';
import { authPaths, env } from '../src/config';
import { gamePlayUrl, getGameFrame, registerPopupHandlers, waitForGame } from '../src/game';

async function main() {
  const game = getGame(process.argv[2]);
  const browser = await chromium.launch({ channel: env.channel, headless: env.headless });
  const context = await browser.newContext({ userAgent: env.headless ? realUserAgent(browser, env.channel) : undefined, storageState: authPaths(game.slug).stateFile, viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const page = await context.newPage();
  await registerPopupHandlers(page);
  await page.goto(gamePlayUrl(game.id));
  await waitForGame(page, game.id);
  const frame = getGameFrame(page, game.id);

  // Chờ scene ổn định (qua màn loading)
  let scene = await getSceneName(frame);
  for (let stableFor = 0; stableFor < 3; ) {
    await page.waitForTimeout(1_000);
    const now = await getSceneName(frame);
    stableFor = now === scene ? stableFor + 1 : 0;
    scene = now;
  }

  const { buttons } = await listGameButtons(frame);
  console.log(`\nScene: ${scene}  → cocos.readyScene = '${scene}'\n`);
  for (const b of buttons) {
    console.log(`${b.interactable ? '✔' : '🔒'} ${b.path}${b.labels.length ? `  [${b.labels.join(', ')}]` : ''}`);
  }
  console.log('\nChọn nút (vd Settings) rồi điền vào cocos.checkButton');
  console.log('Sau đó điền cocos.checkExpectNode = node popup hiện ra khi bấm (để trống nếu nút đó đổi scene)');
  await browser.close();
}

main().catch((err) => {
  console.error('✘', err instanceof Error ? err.message : err);
  process.exit(1);
});
