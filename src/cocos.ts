/**
 * Tương tác trong game Cocos Creator.
 *
 * Game vẽ trên <canvas> nên không có DOM để chọn. Ta hỏi engine vị trí node rồi click/tap thật
 * vào đúng toạ độ đó -> đi qua toàn bộ pipeline input của game như người chơi thật.
 * Lưu ý: không khai báo hàm con trong evaluate() (esbuild chèn `__name` không có trong trình duyệt).
 */
import type { Frame } from '@playwright/test';

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

export type NodeRect = {
  /** Tâm node — điểm sẽ click */
  center: { x: number; y: number };
  /** Khung bao node (UITransform) */
  rect: { x: number; y: number; width: number; height: number };
};

/**
 * Vị trí node Cocos (CSS px, so với góc trên-trái canvas) theo đường dẫn tính từ scene,
 * vd `Canvas/UI/Buttons/Play`.
 */
export async function nodeCanvasRect(frame: Frame, nodePath: string): Promise<NodeRect> {
  const res = await frame.evaluate((path) => {
    const cc = (window as any).cc;
    const scene = cc.director.getScene();
    const node = cc.find(path, scene);
    if (!node) return { error: `Không có node "${path}" trong scene ${scene.name}` };
    if (!node.activeInHierarchy) return { error: `Node "${path}" đang ẩn` };
    const button = node.getComponent(cc.Button);
    if (button && !button.interactable) return { error: `Nút "${path}" đang bị khoá (interactable=false)` };

    const cameras = scene.getComponentsInChildren(cc.Camera);
    const camera = cameras.find((c: any) => (c.visibility & node.layer) !== 0) ?? cameras[0];
    // worldToScreen trả về pixel thật của canvas, gốc ở góc DƯỚI-trái -> đổi sang CSS px, gốc trên-trái
    const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement;
    const box = canvas.getBoundingClientRect();
    const sx = box.width / canvas.width;
    const sy = box.height / canvas.height;
    const center = camera.worldToScreen(node.getWorldPosition());
    const result = {
      center: { x: center.x * sx, y: (canvas.height - center.y) * sy },
      rect: { x: center.x * sx, y: (canvas.height - center.y) * sy, width: 0, height: 0 },
    };
    const transform = node.getComponent(cc.UITransform);
    if (transform) {
      const world = transform.getBoundingBoxToWorld();
      const min = camera.worldToScreen(new cc.Vec3(world.xMin, world.yMin, 0));
      const max = camera.worldToScreen(new cc.Vec3(world.xMax, world.yMax, 0));
      result.rect = {
        x: min.x * sx,
        y: (canvas.height - max.y) * sy,
        width: (max.x - min.x) * sx,
        height: (max.y - min.y) * sy,
      };
    }
    return result;
  }, nodePath);
  if ('error' in res) throw new Error(res.error);
  return res;
}

/**
 * Bấm vào một node Cocos (thường là nút cc.Button) bằng input thật.
 * `tap: true` cho thiết bị cảm ứng (gửi touch event như người dùng mobile).
 */
export async function clickGameNode(frame: Frame, nodePath: string, options: { tap?: boolean } = {}): Promise<void> {
  const { center } = await nodeCanvasRect(frame, nodePath);
  const canvas = frame.locator('#GameCanvas');
  if (options.tap) await canvas.tap({ position: center });
  else await canvas.click({ position: center });
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
