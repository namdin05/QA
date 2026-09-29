/**
 * Các bước chứng minh đã vào game thành công, dùng chung cho mọi feature:
 *   1. Chờ game vào màn hình chính (cocos.readyScene) và animation mở màn chạy xong
 *   2. Bấm nút kiểm tra (cocos.checkButton, vd Settings) -> popup phải hiện / scene phải đổi
 */
import { expect, test, type Frame, type Page } from '@playwright/test';
import type { GameConfig } from '../games/types';
import { clickGameNode, getSceneName, isNodeActive, waitForNodeActive, waitForScene, waitForSceneChange } from './cocos';
import { getGameFrame } from './game';
import { attachScreenshot, note } from './report';

/** Chờ game load xong. Trả về frame game, hoặc null nếu game chưa cấu hình `cocos`. */
export async function waitUntilGameReady(page: Page, game: GameConfig, startedAt: number): Promise<Frame | null> {
  if (!game.cocos) {
    note('play', `skipped: games/${game.slug}/config.ts chưa cấu hình cocos`);
    return null;
  }
  const { readyScene, settleMs = 1_000 } = game.cocos;
  const frame = getGameFrame(page, game.id);
  await test.step(`Chờ game load xong (${readyScene})`, () => waitForScene(frame, readyScene));
  note('ready_ms', String(Date.now() - startedAt));
  await page.waitForTimeout(settleMs); // animation mở màn (fade-in) chạy xong mới chụp
  await attachScreenshot(page, 'dashboard');
  return frame;
}

/** Bấm nút kiểm tra trong game và chờ kết quả. `tap` cho thiết bị cảm ứng. */
export async function pressCheckButton(page: Page, frame: Frame, game: GameConfig, options: { tap?: boolean } = {}) {
  const { readyScene, checkButton, checkExpectNode } = game.cocos!;
  const buttonName = checkButton.split('/').pop();

  await test.step(`${options.tap ? 'Chạm' : 'Bấm'} nút ${buttonName} trong game`, async () => {
    // Popup phải chưa hiện trước khi bấm, nếu không thì kiểm tra sau đó không chứng minh được gì
    if (checkExpectNode) {
      expect(await isNodeActive(frame, checkExpectNode), 'popup đã hiện sẵn trước khi bấm').toBe(false);
    }
    await clickGameNode(frame, checkButton, options);
    if (checkExpectNode) await waitForNodeActive(frame, checkExpectNode);
    else await waitForSceneChange(frame, readyScene);
  });

  const result = checkExpectNode ? checkExpectNode.split('/').pop() : await getSceneName(frame);
  note('play', `${buttonName} → ${result}`);
  await page.waitForTimeout(1_500); // để video/ảnh thấy rõ kết quả
  await attachScreenshot(page, 'game');
}
