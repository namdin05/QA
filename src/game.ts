import type { Frame, Page } from '@playwright/test';
import { FB_URL } from './config';

export type GameInfo = {
  /** Giá trị FBInstant.getEntryPointAsync() — game thật sự nhận được entry point gì */
  entryPoint: string | null;
  entryPointData: unknown;
  contextType: string | null;
  sdkVersion: string | null;
  pageUrl: string;
};

export function gamePlayUrl(gameId: string, params: Record<string, string> = {}): string {
  const url = new URL(`/gaming/play/${gameId}/`, FB_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

/**
 * Hộp thoại "Tùy chọn chia sẻ" chỉ hiện lần đầu account mở game.
 * Trả về true nếu đã bấm.
 */
async function acceptFirstPlayDialog(page: Page): Promise<boolean> {
  const btn = page.getByRole('button', { name: /^(tiếp tục|continue)$/i });
  if (await btn.first().isVisible().catch(() => false)) {
    await btn.first().click();
    return true;
  }
  return false;
}

/** Frame chứa code game (apps-<id>.apps.fbsbx.com/instant-bundle/...), bên trong iframe "shield". */
function findGameFrame(page: Page, gameId: string): Frame | undefined {
  return page.frames().find((f) => f.url().includes(`apps-${gameId}.apps.fbsbx.com/instant-bundle/`));
}

async function readGameInfo(frame: Frame): Promise<Omit<GameInfo, 'pageUrl'> | null> {
  return frame
    .evaluate(async () => {
      // Không khai báo hàm con ở đây: tsx/esbuild chèn helper `__name` không tồn tại trong trình duyệt
      const sdk = (window as any).FBInstant;
      if (!sdk) return null;
      const info = {
        entryPoint: null as string | null,
        entryPointData: null as unknown,
        contextType: null as string | null,
        sdkVersion: null as string | null,
      };
      try {
        // Promise này chỉ resolve sau khi game gọi FBInstant.initializeAsync()
        info.entryPoint = await sdk.getEntryPointAsync();
        info.entryPointData = sdk.getEntryPointData();
        info.contextType = sdk.context.getType();
        info.sdkVersion = sdk.getSDKVersion();
      } catch {}
      return info;
    })
    .catch(() => null); // frame có thể đang reload
}

/**
 * Chờ game load xong (FBInstant đã init) và trả về entry point mà game nhận được.
 * Tự xử lý hộp thoại lần chơi đầu tiên.
 */
export async function waitForGame(page: Page, gameId: string, timeoutMs = 60_000): Promise<GameInfo> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await acceptFirstPlayDialog(page);

    // Account không có quyền chơi game này -> Facebook đá về trang hub /gaming/play/
    if (/^\/gaming\/play\/?$/.test(new URL(page.url()).pathname)) {
      throw new Error(`Bị chuyển về Gaming hub (${page.url()}) — account có quyền chơi game ${gameId} không?`);
    }

    const frame = findGameFrame(page, gameId);
    const info = frame && (await readGameInfo(frame));
    if (info?.entryPoint) return { ...info, pageUrl: page.url() };

    await page.waitForTimeout(1_000);
  }
  throw new Error(`Game ${gameId} không load xong sau ${timeoutMs / 1000}s (URL: ${page.url()})`);
}

/** Các popup của Facebook/trình duyệt hay chắn thao tác — tự đóng khi chúng xuất hiện. */
export async function registerPopupHandlers(page: Page): Promise<void> {
  await page.addLocatorHandler(page.getByRole('heading', { name: /nhớ mật khẩu|remember password/i }), async () => {
    await page.getByRole('button', { name: /lúc khác|not now/i }).click();
  });
  await page.addLocatorHandler(page.getByRole('dialog', { name: /bật thông báo|turn on notifications/i }), async (dialog) => {
    await dialog.getByRole('button', { name: /đóng|close/i }).click();
  });
}
