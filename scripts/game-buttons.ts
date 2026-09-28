/**
 * Mở game và in ra scene hiện tại + các nút bấm được, để điền FB_GAME_READY_SCENE / FB_GAME_CHECK_BUTTON.
 *
 *   npm run game:buttons
 */
import { chromium } from '@playwright/test';
import { STATE_FILE, env } from '../src/config';
import { gamePlayUrl, getGameFrame, getSceneName, listGameButtons, registerPopupHandlers, waitForGame } from '../src/game';

async function main() {
  const browser = await chromium.launch({ channel: env.channel, headless: env.headless });
  const context = await browser.newContext({ storageState: STATE_FILE, viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const page = await context.newPage();
  await registerPopupHandlers(page);
  await page.goto(gamePlayUrl(env.gameId));
  await waitForGame(page, env.gameId);
  const frame = getGameFrame(page, env.gameId);

  // Chờ scene ổn định (qua màn loading)
  let scene = await getSceneName(frame);
  for (let stableFor = 0; stableFor < 3; ) {
    await page.waitForTimeout(1_000);
    const now = await getSceneName(frame);
    stableFor = now === scene ? stableFor + 1 : 0;
    scene = now;
  }

  const { buttons } = await listGameButtons(frame);
  console.log(`\nScene: ${scene}  → FB_GAME_READY_SCENE=${scene}\n`);
  for (const b of buttons) {
    console.log(`${b.interactable ? '✔' : '🔒'} ${b.path}${b.labels.length ? `  [${b.labels.join(', ')}]` : ''}`);
  }
  console.log('\nChọn nút (vd Settings) rồi điền vào FB_GAME_CHECK_BUTTON=<đường dẫn>');
  console.log('Sau đó điền FB_GAME_CHECK_EXPECT_NODE = node popup hiện ra khi bấm (để trống nếu nút đó đổi scene)');
  await browser.close();
}

main().catch((err) => {
  console.error('✘', err instanceof Error ? err.message : err);
  process.exit(1);
});
