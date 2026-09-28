import type { BrowserContext, Page } from '@playwright/test';
import { FB_URL } from './config';

// URL Facebook dùng khi chưa đăng nhập xong (form login, 2FA, checkpoint bảo mật)
const NOT_LOGGED_IN_URL = /\/(login|checkpoint|two_step_verification|recover)/;

/** Cookie `c_user` = Facebook user id, chỉ có khi đã đăng nhập. Ổn định hơn nhiều so với check UI. */
export async function getUserId(context: BrowserContext): Promise<string | undefined> {
  const cookies = await context.cookies(FB_URL);
  return cookies.find((c) => c.name === 'c_user')?.value;
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  return !!(await getUserId(page.context())) && !NOT_LOGGED_IN_URL.test(page.url());
}

/** Đóng popup cookie consent (thường chỉ xuất hiện với IP EU) nếu có. */
export async function dismissCookieBanner(page: Page): Promise<void> {
  const btn = page.getByRole('button', {
    name: /allow all cookies|only allow essential cookies|cho phép tất cả cookie|chỉ cho phép cookie cần thiết/i,
  });
  if (await btn.first().isVisible().catch(() => false)) {
    await btn.first().click();
  }
}

/**
 * Điền form login. Facebook đổi giao diện thường xuyên nên ưu tiên selector theo `name`
 * (ổn định hơn class CSS bị obfuscate), fallback sang role/label.
 */
export async function fillLoginForm(page: Page, email: string, password: string): Promise<void> {
  const emailInput = page
    .locator('input[name="email"]')
    .or(page.getByRole('textbox', { name: /email|phone|số điện thoại/i }))
    .first();
  const passInput = page.locator('input[name="pass"]').or(page.getByLabel(/password|mật khẩu/i)).first();

  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  // pressSequentially với delay để giống người gõ hơn fill()
  await emailInput.pressSequentially(email, { delay: 60 });
  await passInput.pressSequentially(password, { delay: 60 });
  await passInput.press('Enter');
}

/** Chờ tới khi đăng nhập xong — kể cả khi người dùng phải tự xử lý 2FA/checkpoint bằng tay. */
export async function waitForLogin(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isLoggedIn(page)) return;
    await page.waitForTimeout(2_000);
  }
  throw new Error(`Chưa đăng nhập được sau ${timeoutMs / 1000}s (URL hiện tại: ${page.url()})`);
}
