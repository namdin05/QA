import { expect, type Page } from '@playwright/test';
import { FB_URL } from '../../src/config';
import { gamePlayUrl } from '../../src/game';

export type EntryPointCase = {
  name: string;
  /** Giá trị FBInstant.getEntryPointAsync() mà game phải nhận được */
  expected: string;
  /** `source` trên URL game phải khớp — đảm bảo test bấm đúng link, không bấm nhầm link của trang trước */
  via?: RegExp;
  /** Đưa người dùng từ Facebook vào game */
  open: (page: Page, game: { id: string; name: string }) => Promise<void>;
};

/**
 * Link trỏ tới game trong nội dung chính (so theo href, không phụ thuộc text/ngôn ngữ).
 * Giới hạn trong `main` để không bấm nhầm shortcut ở menu trái.
 */
const gameLink = (page: Page, gameId: string) => page.getByRole('main').locator(`a[href*="/gaming/play/${gameId}"]`).first();

const leftNav = (page: Page) => page.getByRole('navigation', { name: /lối tắt|shortcuts/i });

/** Mở mục "Chơi game" ở menu trái — sau khi có shortcut game, mục này bị gom vào "Xem thêm". */
async function openGamingFromLeftNav(page: Page) {
  const link = leftNav(page).getByRole('link', { name: /^(chơi game|play games)$/i });
  if (!(await link.isVisible())) {
    await leftNav(page).getByRole('button', { name: /xem thêm|see more/i }).first().click();
  }
  await link.click();
  await page.waitForURL(/\/gaming\/play\/?(\?|$)/);
}

/**
 * Tìm kiếm rồi trả về link game trong trang kết quả.
 * Facebook là SPA: URL đổi trước khi nội dung cũ bị gỡ, nên phải nhắm đúng link kết quả tìm kiếm
 * (luôn có source=fb_gg_url) — nếu không sẽ bấm nhầm card "chơi gần đây" của trang cũ.
 */
async function searchForGame(page: Page, input: ReturnType<Page['locator']>, game: { id: string; name: string }) {
  await input.click();
  await input.fill(game.name);
  await input.press('Enter');
  await page.waitForURL(/search/);
  return page.getByRole('main').locator(`a[href*="/gaming/play/${game.id}"][href*="source=fb_gg_url"]`).first();
}

/**
 * Entry point qua thao tác UI — mô phỏng đúng hành trình người chơi.
 * `expected` lấy từ kết quả `npm run discover`.
 */
export const UI_ENTRY_POINTS: EntryPointCase[] = [
  {
    name: 'Trang chủ › Lối tắt ở menu trái',
    expected: 'bookmark',
    via: /^www_homepage_shortcut$/,
    open: async (page, game) => {
      await page.goto(FB_URL);
      // Lối tắt chỉ xuất hiện sau khi account đã chơi game ít nhất 1 lần
      await leftNav(page).locator(`a[href*="/gaming/play/${game.id}"]`).first().click();
    },
  },
  {
    name: 'Trang chủ › Chơi game › card trong Gaming hub',
    expected: 'web_games_hub',
    via: /^(www_games_hub.*|most_played_games)$/,
    open: async (page, game) => {
      await page.goto(FB_URL);
      await openGamingFromLeftNav(page);
      await gameLink(page, game.id).click();
    },
  },
  {
    name: 'Gaming hub › Tất cả game (danh mục)',
    expected: 'web_games_hub',
    via: /categor|^www_games_hub$/,
    open: async (page, game) => {
      await page.goto(`${FB_URL}/gaming/play/`);
      await page.getByRole('link', { name: /^(tất cả game|all games)$/i }).click();
      await page.waitForURL(/\/games\/instantgames\/category\//);
      // Chờ card "chơi gần đây" của hub bị gỡ, nếu không sẽ bấm nhầm nó
      await expect(page.getByRole('main').locator('a[href*="recently_played"]')).toHaveCount(0);
      await gameLink(page, game.id).click();
    },
  },
  {
    name: 'Gaming hub › ô Tìm kiếm game',
    expected: 'shareable_link',
    via: /^fb_gg_url$/,
    open: async (page, game) => {
      await page.goto(`${FB_URL}/gaming/play/`);
      const search = page.getByRole('searchbox', { name: /tìm kiếm game|search games/i })
        .or(page.getByPlaceholder(/tìm kiếm game|search games/i)).first();
      await (await searchForGame(page, search, game)).click();
    },
  },
  {
    name: 'Thanh tìm kiếm Facebook › kết quả',
    expected: 'shareable_link',
    via: /^fb_gg_url$/,
    open: async (page, game) => {
      await page.goto(FB_URL);
      const search = page.getByRole('combobox', { name: /tìm kiếm trên facebook|search facebook/i });
      await search.click();
      await (await searchForGame(page, search, game)).click();
    },
  },
];

/** Entry point qua URL có tham số `source` — nhanh, dùng để phủ các giá trị Facebook hỗ trợ. */
export const URL_ENTRY_POINTS: { name: string; source?: string; expected: string }[] = [
  { name: 'ID game trực tiếp', expected: 'other' },
  { name: 'Shortcut trang chủ', source: 'www_homepage_shortcut', expected: 'bookmark' },
  { name: 'Bookmark', source: 'bookmark', expected: 'bookmark' },
  { name: 'Gaming hub', source: 'www_games_hub', expected: 'web_games_hub' },
  { name: 'Gaming hub › Chơi gần đây', source: 'www_games_hub_recently_played', expected: 'web_games_hub' },
  { name: 'Gaming hub › Nhiều người chơi nhất', source: 'most_played_games', expected: 'web_games_hub' },
  { name: 'Danh mục game', source: 'facebook~game_list~categories_popular_games', expected: 'web_games_hub' },
  { name: 'Link chia sẻ fb.gg', source: 'fb_gg_url', expected: 'shareable_link' },
  // Chưa thấy bề mặt web nào sinh ra source=search (có thể chỉ có trên app mobile)
  { name: 'Tìm kiếm game', source: 'search', expected: 'game_search' },
  { name: 'Thông báo', source: 'notification', expected: 'notification' },
  { name: 'Chuyển game', source: 'game_switch', expected: 'game_switch' },
];

export const urlFor = (gameId: string, source?: string) => gamePlayUrl(gameId, source ? { source } : {});
