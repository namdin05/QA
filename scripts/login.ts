/**
 * Đăng nhập Facebook 1 lần và lưu session để các test dùng lại.
 *
 *   npm run login
 *
 * - Nếu .env có FB_EMAIL/FB_PASSWORD: script tự điền form.
 * - Nếu không, hoặc Facebook đòi 2FA / checkpoint / captcha: bạn tự thao tác trên cửa sổ trình duyệt,
 *   script sẽ tự nhận biết khi đăng nhập xong.
 */
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { AUTH_DIR, FB_URL, PROFILE_DIR, STATE_FILE, env } from '../src/config';
import { dismissCookieBanner, fillLoginForm, getUserId, isLoggedIn, waitForLogin } from '../src/fb';

const MANUAL_TIMEOUT_MS = 5 * 60_000;

async function main() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Persistent profile: Facebook "nhớ" thiết bị này -> lần sau ít bị checkpoint hơn
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: env.channel,
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  });
  const page = context.pages()[0] ?? (await context.newPage());

  await page.goto(FB_URL, { waitUntil: 'domcontentloaded' });
  await dismissCookieBanner(page);

  if (await isLoggedIn(page)) {
    console.log('✔ Profile đã đăng nhập sẵn.');
  } else {
    if (env.email && env.password) {
      console.log('→ Tự điền form đăng nhập...');
      await fillLoginForm(page, env.email, env.password);
    } else {
      console.log('→ Không có FB_EMAIL/FB_PASSWORD trong .env, hãy đăng nhập trên cửa sổ trình duyệt.');
    }
    console.log(`→ Nếu Facebook yêu cầu 2FA/checkpoint, hãy hoàn tất bằng tay (chờ tối đa ${MANUAL_TIMEOUT_MS / 60_000} phút)...`);
    await waitForLogin(page, MANUAL_TIMEOUT_MS);
  }

  await context.storageState({ path: STATE_FILE });
  console.log(`✔ Đăng nhập thành công, user id: ${await getUserId(context)}`);
  console.log(`✔ Đã lưu session vào ${STATE_FILE}`);
  await context.close();
}

main().catch((err) => {
  console.error('✘', err instanceof Error ? err.message : err);
  process.exit(1);
});
