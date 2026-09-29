import { devices } from '@playwright/test';

export type DeviceNote = {
  name: string;
  type: 'Điện thoại' | 'Máy tính bảng';
  os: string;
  viewport: string;
  dpr: number;
  /** Độ phân giải vật lý = viewport × DPR */
  screen: string;
  touch: boolean;
  userAgent: string;
};

/** Thông số thiết bị giả lập — bỏ `defaultBrowserType` vì luôn chạy trên trình duyệt của project (Edge) */
export function deviceOptions(name: string) {
  const descriptor = devices[name];
  if (!descriptor) throw new Error(`Không có thiết bị "${name}" trong danh sách devices của Playwright`);
  const { defaultBrowserType: _engine, ...options } = descriptor;
  return options;
}

export function describeDevice(name: string): DeviceNote {
  const d = deviceOptions(name);
  const ua = d.userAgent;
  const os =
    ua.match(/iPad.*?OS (\d+[_\d]*)/)?.[1].replace(/_/g, '.').replace(/^/, 'iPadOS ') ??
    ua.match(/iPhone OS (\d+[_\d]*)/)?.[1].replace(/_/g, '.').replace(/^/, 'iOS ') ??
    ua.match(/Android ([\d.]+)/)?.[1].replace(/^/, 'Android ') ??
    'Không rõ';
  const { width, height } = d.viewport;
  return {
    name,
    // Cạnh ngắn ≥ 600 CSS px thì coi là tablet (ngưỡng phổ biến của Android/Material)
    type: Math.min(width, height) >= 600 ? 'Máy tính bảng' : 'Điện thoại',
    os,
    viewport: `${width}×${height}`,
    dpr: d.deviceScaleFactor,
    screen: `${Math.round(width * d.deviceScaleFactor)}×${Math.round(height * d.deviceScaleFactor)}`,
    touch: d.hasTouch,
    userAgent: ua,
  };
}
