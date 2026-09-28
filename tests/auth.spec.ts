import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { STATE_FILE } from '../src/config';
import { getUserId } from '../src/fb';

test.beforeAll(() => {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error('Chưa có session. Chạy `npm run login` trước.');
  }
});

test('session Facebook đã lưu vẫn còn hiệu lực', async ({ page, context }) => {
  test.info().annotations.push({ type: 'ep.kind', description: 'Auth' }, { type: 'ep.name', description: 'Session đăng nhập còn hiệu lực' });
  await page.goto('/');

  // Không bị đá về trang login / checkpoint
  await expect(page).not.toHaveURL(/\/(login|checkpoint)/);

  const userId = await getUserId(context);
  expect(userId, 'thiếu cookie c_user -> session đã hết hạn, chạy lại `npm run login`').toBeTruthy();

  // Check UI: ô tìm kiếm trên thanh điều hướng chỉ có khi đã đăng nhập
  // (không check role=banner: div wrapper của Facebook có kích thước 0 nên Playwright coi là hidden)
  await expect(page.getByRole('combobox', { name: /search facebook|tìm kiếm trên facebook/i })).toBeVisible();

  test.info().annotations.push({ type: 'fb_user_id', description: userId });
});
