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

// ───────────────────────── Tương tác trong game (Cocos Creator) ─────────────────────────
// Game vẽ trên <canvas> nên không có DOM để chọn. Ta hỏi engine vị trí node rồi click chuột thật
// vào đúng toạ độ đó -> đi qua toàn bộ pipeline input của game như người chơi thật.
// Lưu ý: không khai báo hàm con trong evaluate() (esbuild chèn `__name` không có trong trình duyệt).

export function getGameFrame(page: Page, gameId: string): Frame {
  const frame = findGameFrame(page, gameId);
  if (!frame) throw new Error('Không tìm thấy iframe game');
  return frame;
}

export async function getSceneName(frame: Frame): Promise<string | null> {
  return frame.evaluate(() => (window as any).cc?.director?.getScene?.()?.name ?? null).catch(() => null);
}

export async function waitForScene(frame: Frame, sceneName: string, timeoutMs = 60_000): Promise<void> {
  await frame.waitForFunction((name) => (window as any).cc?.director?.getScene?.()?.name === name, sceneName, {
    timeout: timeoutMs,
    polling: 250,
  });
}

export async function isNodeActive(frame: Frame, nodePath: string): Promise<boolean> {
  return frame.evaluate((path) => {
    const cc = (window as any).cc;
    return !!cc?.find(path, cc.director.getScene())?.activeInHierarchy;
  }, nodePath);
}

/** Chờ một node (vd popup) hiện ra trong scene */
export async function waitForNodeActive(frame: Frame, nodePath: string, timeoutMs = 15_000): Promise<void> {
  await frame.waitForFunction(
    (path) => {
      const cc = (window as any).cc;
      return !!cc?.find(path, cc.director.getScene())?.activeInHierarchy;
    },
    nodePath,
    { timeout: timeoutMs, polling: 100 },
  );
}

/** Chờ game rời khỏi scene hiện tại (vd bấm Play -> vào màn chơi) */
export async function waitForSceneChange(frame: Frame, fromScene: string, timeoutMs = 15_000): Promise<void> {
  await frame.waitForFunction((from) => (window as any).cc?.director?.getScene?.()?.name !== from, fromScene, {
    timeout: timeoutMs,
    polling: 100,
  });
}

/** Toạ độ (CSS px, so với canvas) của node Cocos theo đường dẫn tính từ scene, vd `Canvas/UI/Buttons/Play` */
async function nodeCanvasPosition(frame: Frame, nodePath: string) {
  return frame.evaluate((path) => {
    const cc = (window as any).cc;
    const scene = cc.director.getScene();
    const node = cc.find(path, scene);
    if (!node) return { error: `Không có node "${path}" trong scene ${scene.name}` };
    if (!node.activeInHierarchy) return { error: `Node "${path}" đang ẩn` };
    const button = node.getComponent(cc.Button);
    if (button && !button.interactable) return { error: `Nút "${path}" đang bị khoá (interactable=false)` };

    const cameras = scene.getComponentsInChildren(cc.Camera);
    const camera = cameras.find((c: any) => (c.visibility & node.layer) !== 0) ?? cameras[0];
    // worldToScreen trả về pixel thật của canvas, gốc ở góc DƯỚI-trái
    const screen = camera.worldToScreen(node.getWorldPosition());
    const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (screen.x * rect.width) / canvas.width,
      y: ((canvas.height - screen.y) * rect.height) / canvas.height,
    };
  }, nodePath);
}

/** Click chuột thật vào một node Cocos (thường là nút cc.Button) */
export async function clickGameNode(frame: Frame, nodePath: string): Promise<void> {
  const pos = await nodeCanvasPosition(frame, nodePath);
  if ('error' in pos) throw new Error(pos.error);
  await frame.locator('#GameCanvas').click({ position: pos });
}

/** Liệt kê các nút đang hiển thị trong scene — dùng để tìm đường dẫn nút khi cấu hình game mới */
export async function listGameButtons(frame: Frame) {
  return frame.evaluate(() => {
    const cc = (window as any).cc;
    const scene = cc.director.getScene();
    const buttons: { path: string; labels: string[]; interactable: boolean }[] = [];
    const stack: [any, string][] = scene.children.map((c: any) => [c, c.name]);
    while (stack.length) {
      const [node, path] = stack.pop()!;
      if (!node.activeInHierarchy) continue;
      const button = node.getComponent(cc.Button);
      if (button) {
        const labels = node.getComponentsInChildren(cc.Label).map((l: any) => l.string).filter(Boolean);
        buttons.push({ path, labels: [...new Set<string>(labels)], interactable: button.interactable });
      }
      for (const child of node.children) stack.push([child, `${path}/${child.name}`]);
    }
    return { scene: scene.name, buttons };
  });
}
