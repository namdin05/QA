/**
 * Mở game bằng session của account (có cửa sổ) để thao tác tay, vd chơi qua tutorial lần đầu.
 *
 *   npm run game:open -- <slug>
 *
 * Session được lưu lại định kỳ. Script báo khi nút kiểm tra (cocos.checkButton) đã hiện trong khung hình
 * — tức account đã sẵn sàng cho bộ test. Đóng cửa sổ để kết thúc.
 */
import { chromium } from '@playwright/test';
import { getGame } from '../games';
import { getSceneName, nodeCanvasRect } from '../src/cocos';
import { authPaths, env } from '../src/config';
import { gamePlayUrl, registerPopupHandlers, waitForGame } from '../src/game';

async function main() {
  const game = getGame(process.argv[2]);
  const { profileDir, stateFile } = authPaths(game.slug);
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: env.channel,
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await registerPopupHandlers(page);
  await page.goto(gamePlayUrl(game.id));
  await waitForGame(page, game.id, 120_000);
  console.log(`→ Đã mở ${game.name}. Thao tác trên cửa sổ, đóng cửa sổ khi xong.`);

  let closed = false;
  context.on('close', () => (closed = true));
  let ready = false;
  while (!closed) {
    await context.storageState({ path: stateFile }).catch(() => {});
    const frame = page.frames().find((f) => f.url().includes(`apps-${game.id}.apps.fbsbx.com/instant-bundle/`));
    if (frame && game.cocos && !ready) {
      const rect = await nodeCanvasRect(frame, game.cocos.checkButton).catch(() => null);
      const box = await frame.locator('#GameCanvas').boundingBox().catch(() => null);
      if (rect && box && rect.center.y >= 0 && rect.center.y <= box.height) {
        ready = true;
        console.log(`✔ Nút ${game.cocos.checkButton.split('/').pop()} đã hiện (scene ${await getSceneName(frame)}) — account sẵn sàng cho bộ test, có thể đóng cửa sổ.`);
      }
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
  console.log(`✔ Đã lưu session vào ${stateFile}`);
}

main().catch((err) => {
  console.error('✘', err instanceof Error ? err.message : err);
  process.exit(1);
});
