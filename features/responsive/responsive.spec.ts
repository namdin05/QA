/**
 * Kiểm tra UI game trên nhiều kích thước màn hình (giả lập thiết bị như DevTools > Device Toolbar):
 * vào game, chờ load xong, chụp màn hình, ghi chú loại thiết bị và chạy các kiểm tra cơ bản.
 *
 * Lưu ý: đây là giả lập (viewport, DPR, user agent, cảm ứng) trên Edge/Chromium,
 * không phải Safari/WebKit thật — lỗi riêng của engine Safari sẽ không bắt được.
 */
import { test } from '../../src/fixtures';
import { nodeCanvasRect } from '../../src/cocos';
import { gamePlayUrl, waitForGame } from '../../src/game';
import { pressCheckButton, waitUntilGameReady } from '../../src/game-check';
import { check, note, skipNotApplicable } from '../../src/report';
import { GAMES } from '../../games';
import { describeDevice, deviceOptions } from './devices';

// Ảnh chụp là kết quả chính của feature này -> không cần video
test.use({ video: 'off' });

// Sai số cho phép khi so khung: layout desktop của Facebook trên tablet làm canvas cao hơn phần
// màn hình còn lại ~2px (chỉ lẹm nền, không cắt UI). Vượt ngưỡng này mới coi là bị cắt.
const TOLERANCE_PX = 4;

// Danh sách thiết bị lấy theo từng game; project nào chỉ chạy thiết bị của game đó
const allDevices = [...new Set(GAMES.flatMap((g) => g.devices))];

for (const deviceName of allDevices) {
  test.describe(deviceName, () => {
    test.use(deviceOptions(deviceName));

    test(`UI trên ${deviceName}`, async ({ page, game }) => {
      if (!game.devices.includes(deviceName)) skipNotApplicable(`${game.slug} không test thiết bị này`);
      test.skip(!game.cocos, `games/${game.slug}/config.ts chưa cấu hình cocos`);

      const device = describeDevice(deviceName);
      note('kind', device.type);
      note('name', deviceName);
      note('device', JSON.stringify(device));

      const startedAt = Date.now();
      await page.goto(gamePlayUrl(game.id));
      await test.step('Chờ FBInstant khởi tạo', () => waitForGame(page, game.id));
      const frame = (await waitUntilGameReady(page, game, startedAt))!;

      const viewport = page.viewportSize()!;
      const canvas = (await frame.locator('#GameCanvas').boundingBox())!;
      note('canvas', `${Math.round(canvas.width)}×${Math.round(canvas.height)}`);
      // Canvas chiếm gần hết chiều ngang = Facebook hiển thị game full màn hình (giao diện mobile)
      note('layout', canvas.width >= viewport.width * 0.95 ? 'Game full màn hình' : 'Có sidebar Facebook');

      await test.step('Kiểm tra bố cục', async () => {
        const scroll = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, inner: innerWidth }));
        check('Không có thanh cuộn ngang', scroll.width <= scroll.inner + 1, `trang rộng ${scroll.width}px / màn hình ${scroll.inner}px`);

        check('Canvas game nằm trọn trong màn hình', within(canvas, { x: 0, y: 0, ...viewport }),
          `${fmtBox(canvas)} / màn hình ${viewport.width}×${viewport.height}`);

        const buttonName = game.cocos!.checkButton.split('/').pop()!;
        const { rect } = await nodeCanvasRect(frame, game.cocos!.checkButton);
        const button = { x: canvas.x + rect.x, y: canvas.y + rect.y, width: rect.width, height: rect.height };
        const visibleCanvas = {
          x: canvas.x,
          y: canvas.y,
          width: Math.min(canvas.width, viewport.width - canvas.x),
          height: Math.min(canvas.height, viewport.height - canvas.y),
        };
        check(`Nút ${buttonName} nằm trọn trong màn hình`, within(button, visibleCanvas), fmtBox(button));
      });

      await pressCheckButton(page, frame, game, { tap: device.touch });
      check(`${device.touch ? 'Chạm' : 'Bấm'} nút mở được popup`, true);
    });
  });
}

type Box = { x: number; y: number; width: number; height: number };

/** `inner` nằm trọn trong `outer` (cho phép lệch TOLERANCE_PX) */
const within = (inner: Box, outer: Box) =>
  inner.x >= outer.x - TOLERANCE_PX &&
  inner.y >= outer.y - TOLERANCE_PX &&
  inner.x + inner.width <= outer.x + outer.width + TOLERANCE_PX &&
  inner.y + inner.height <= outer.y + outer.height + TOLERANCE_PX;

const fmtBox = (b: Box) =>
  `x=${Math.round(b.x)} y=${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}`;
