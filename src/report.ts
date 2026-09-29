/**
 * Ghi dữ liệu có cấu trúc cho dashboard reporter (reporters/dashboard-reporter.ts) qua annotation `r.*`.
 */
import { expect, test, type Page } from '@playwright/test';

export function note(key: string, value: string) {
  test.info().annotations.push({ type: `r.${key}`, description: value });
}

/** Ảnh JPEG nhỏ gọn để đưa lên dashboard (PNG full size ~1MB/ảnh) */
export async function attachScreenshot(page: Page, name: string) {
  await test.info().attach(name, { body: await page.screenshot({ type: 'jpeg', quality: 60 }), contentType: 'image/jpeg' });
}

/**
 * Test không áp dụng cho game của project hiện tại (vd thiết bị không có trong config game):
 * skip và ẩn khỏi report, để report không đầy dòng "bỏ qua" vô nghĩa.
 */
export function skipNotApplicable(reason: string) {
  note('na', reason);
  test.skip(true, reason);
}

/** Kiểm tra mềm: ghi kết quả lên report, fail test nhưng vẫn chạy tiếp các kiểm tra khác */
export function check(name: string, ok: boolean, detail = '') {
  note('check', JSON.stringify({ name, ok, detail }));
  expect.soft(ok, detail ? `${name}: ${detail}` : name).toBe(true);
}
