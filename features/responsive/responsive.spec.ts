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
import { check, note, skipNotApplicable, type CheckStatus } from '../../src/report';
import { GAMES } from '../../games';
import { describeDevice, deviceOptions } from './devices';

// Ảnh chụp là kết quả chính của feature này -> không cần video
test.use({ video: 'off' });

// Sai số cho phép khi so khung: tràn ≤ ngưỡng -> cảnh báo (⚠, test vẫn pass); vượt ngưỡng -> fail.
// Vd layout desktop của Facebook trên tablet làm canvas cao hơn phần màn hình còn lại ~2px.
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

        const screen = { x: 0, y: 0, ...viewport };
        const fit = checkFit(canvas, 'canvas game', screen, 'màn hình');
        // Gợi ý nguyên nhân khi lệch nhỏ trên layout desktop (tablet): thanh trên của Facebook cao hơn phần Facebook trừ đi
        const hint = fit.status === 'warn' && canvas.width < viewport.width * 0.95
          ? ' Facebook đang hiển thị layout desktop (có sidebar), canvas được tính cao hơn phần màn hình còn lại dưới thanh trên của Facebook.'
          : '';
        check('Canvas game nằm trọn trong màn hình', fit.status, fit.detail + hint);

        const buttonName = game.cocos!.checkButton.split('/').pop()!;
        const { rect } = await nodeCanvasRect(frame, game.cocos!.checkButton);
        const button = { x: canvas.x + rect.x, y: canvas.y + rect.y, width: rect.width, height: rect.height };
        const visibleCanvas = {
          x: canvas.x,
          y: canvas.y,
          width: Math.min(canvas.width, viewport.width - canvas.x),
          height: Math.min(canvas.height, viewport.height - canvas.y),
        };
        const buttonFit = checkFit(button, `nút ${buttonName}`, visibleCanvas, 'phần canvas nhìn thấy được');
        check(`Nút ${buttonName} nằm trọn trong màn hình`, buttonFit.status, buttonFit.detail);
      });

      await pressCheckButton(page, frame, game, { tap: device.touch });
      check(`${device.touch ? 'Chạm' : 'Bấm'} nút mở được popup`, true);
    });
  });
}

type Box = { x: number; y: number; width: number; height: number };

const px = (n: number) => `${Math.round(n)}px`;

/**
 * So `inner` với `outer`, mô tả đầy đủ từng cạnh bị tràn:
 *   pass — nằm trọn; warn — tràn ≤ TOLERANCE_PX; fail — tràn > TOLERANCE_PX
 */
function checkFit(inner: Box, innerName: string, outer: Box, outerName: string): { status: CheckStatus; detail: string } {
  const edges = [
    { edge: 'trên', over: outer.y - inner.y, at: `${innerName} bắt đầu ở y=${px(inner.y)}, ${outerName} bắt đầu ở y=${px(outer.y)}` },
    { edge: 'dưới', over: inner.y + inner.height - (outer.y + outer.height),
      at: `${innerName} kết thúc ở y=${px(inner.y + inner.height)}, ${outerName} kết thúc ở y=${px(outer.y + outer.height)}` },
    { edge: 'trái', over: outer.x - inner.x, at: `${innerName} bắt đầu ở x=${px(inner.x)}, ${outerName} bắt đầu ở x=${px(outer.x)}` },
    { edge: 'phải', over: inner.x + inner.width - (outer.x + outer.width),
      at: `${innerName} kết thúc ở x=${px(inner.x + inner.width)}, ${outerName} kết thúc ở x=${px(outer.x + outer.width)}` },
  ].filter((e) => e.over >= 0.5);

  const sizes = `${cap(innerName)}: ${fmtBox(inner)}. ${cap(outerName)}: ${fmtBox(outer)}.`;
  if (!edges.length) return { status: 'pass', detail: `Nằm trọn. ${sizes}` };

  const worst = Math.max(...edges.map((e) => e.over));
  const overflow = edges.map((e) => `tràn ${px(e.over)} ở cạnh ${e.edge} (${e.at})`).join('; ');
  const status: CheckStatus = worst <= TOLERANCE_PX ? 'warn' : 'fail';
  const verdict =
    status === 'warn'
      ? ` Trong ngưỡng cho phép ${TOLERANCE_PX}px nên không tính là lỗi, nhưng phần mép ${px(worst)} không hiển thị — xem ảnh để chắc không mất nội dung quan trọng.`
      : ` Vượt ngưỡng cho phép ${TOLERANCE_PX}px — phần UI ở mép có thể bị cắt.`;
  return { status, detail: `${cap(innerName)} ${overflow}. ${sizes}${verdict}` };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fmtBox = (b: Box) =>
  `x=${Math.round(b.x)} y=${Math.round(b.y)} ${Math.round(b.width)}×${Math.round(b.height)}`;
