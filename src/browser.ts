/**
 * Chạy ẩn (headless) không bị lộ: user agent mặc định của headless chứa "HeadlessChrome",
 * Facebook dễ dựa vào đó để chặn/checkpoint -> thay bằng user agent thật của trình duyệt.
 */
import type { Browser } from '@playwright/test';

/** vd version "154.0.3960.12" -> UA Edge/Chrome thật trên macOS (Chrome giảm version về dạng 154.0.0.0) */
export function realUserAgent(browser: Browser, channel?: string): string {
  const major = browser.version().split('.')[0];
  const chrome = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
  return channel === 'msedge' ? `${chrome} Edg/${major}.0.0.0` : chrome;
}
