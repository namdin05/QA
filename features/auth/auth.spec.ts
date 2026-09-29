import { expect, test } from '../../src/fixtures';
import { getUserId } from '../../src/fb';
import { note } from '../../src/report';

test('session Facebook đã lưu vẫn còn hiệu lực', async ({ page, context, game }) => {
  note('kind', 'Auth');
  note('name', 'Session đăng nhập còn hiệu lực');
  await page.goto('/');

  // Không bị đá về trang login / checkpoint
  await expect(page).not.toHaveURL(/\/(login|checkpoint)/);

  const userId = await getUserId(context);
  expect(userId, `thiếu cookie c_user -> session đã hết hạn, chạy lại \`npm run login -- ${game.slug}\``).toBeTruthy();

  // Check UI: ô tìm kiếm trên thanh điều hướng chỉ có khi đã đăng nhập
  // (không check role=banner: div wrapper của Facebook có kích thước 0 nên Playwright coi là hidden)
  await expect(page.getByRole('combobox', { name: /search facebook|tìm kiếm trên facebook/i })).toBeVisible();
});
