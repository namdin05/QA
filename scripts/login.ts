/**
 * Đăng nhập Facebook 1 lần và lưu session để các test dùng lại.
 *
 *   npm run login -- <slug>      (vd snake-escape; bỏ trống = game đầu tiên trong games/index.ts)
 *
 * - Nếu .env có FB_EMAIL_<SLUG>/FB_PASSWORD_<SLUG>: script tự điền form.
 * - Nếu không, hoặc Facebook đòi 2FA / checkpoint / captcha: bạn tự thao tác trên cửa sổ trình duyệt,
 *   script sẽ tự nhận biết khi đăng nhập xong.
 */
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import path from 'node:path';
import { getGame } from '../games';
import { FB_URL, authPaths, env, gameAccount } from '../src/config';
import { dismissCookieBanner, fillLoginForm, getUserId, isLoggedIn, waitForLogin } from '../src/fb';

const MANUAL_TIMEOUT_MS = 5 * 60_000;

async function main() {
  const game = getGame(process.argv[2]);
  const account = gameAccount(game.slug);
  const { profileDir, stateFile } = authPaths(game.slug);
  console.log(`→ Đăng nhập account của game ${game.name} (${game.slug})`);
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });

  // Persistent profile: Facebook "nhớ" thiết bị này -> lần sau ít bị checkpoint hơn
  const context = await chromium.launchPersistentContext(profileDir, {
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
    if (account.email && account.password) {
      console.log('→ Tự điền form đăng nhập...');
      await fillLoginForm(page, account.email, account.password);
    } else {
      console.log('→ Không có FB_EMAIL_<SLUG>/FB_PASSWORD_<SLUG> trong .env, hãy đăng nhập trên cửa sổ trình duyệt.');
    }
    console.log(`→ Nếu Facebook yêu cầu 2FA/checkpoint, hãy hoàn tất bằng tay (chờ tối đa ${MANUAL_TIMEOUT_MS / 60_000} phút)...`);
    await waitForLogin(page, MANUAL_TIMEOUT_MS);
  }

  await context.storageState({ path: stateFile });
  console.log(`✔ Đăng nhập thành công, user id: ${await getUserId(context)}`);
  console.log(`✔ Đã lưu session vào ${stateFile}`);
  await context.close();
}

main().catch((err) => {
  console.error('✘', err instanceof Error ? err.message : err);
  process.exit(1);
});
