/**
 * Dò tìm các entry point vào game:
 *  1. Quét các bề mặt Facebook, gom mọi link trỏ tới game -> lấy tham số `source` thật Facebook đang dùng
 *  2. Thử thêm một số giá trị `source` đoán trước
 *  3. Mở từng URL, đọc FBInstant.getEntryPointAsync() để biết game nhận entry point gì
 *
 *   npm run discover
 *
 * Kết quả in ra bảng và lưu vào reports/entry-points.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { FB_URL, STATE_FILE, env } from '../src/config';
import { gamePlayUrl, registerPopupHandlers, waitForGame } from '../src/game';

const REPORT_FILE = path.resolve(__dirname, '..', 'reports', 'entry-points.json');

// Giá trị đoán thêm — không có trong link nào vẫn thử để xem Facebook map ra entry point gì
const GUESSED_SOURCES = [
  'www_homepage_shortcut', 'www_games_hub', 'most_played_games', 'games_bookmark', 'bookmark', 'feed',
  'search', 'www_search', 'notification', 'games_notification', 'messenger', 'page', 'share', 'game_switch',
];

async function collectGameLinks(page: Page, gameId: string, surfaces: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>(); // source -> "surface: href"
  for (const surface of surfaces) {
    await page.goto(new URL(surface, FB_URL).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6_000);
    const hrefs = await page.locator(`a[href*="${gameId}"]`).evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    console.log(`  ${surface}: ${hrefs.length} link`);
    for (const href of hrefs) {
      const url = new URL(href);
      const source = url.searchParams.get('source') ?? url.searchParams.get('store_visit_source') ?? '(none)';
      if (!found.has(source)) found.set(source, `${surface} -> ${href}`);
    }
  }
  return found;
}

async function main() {
  const gameId = env.gameId;
  if (!gameId) throw new Error('Thiếu FB_GAME_ID trong .env');
  if (!fs.existsSync(STATE_FILE)) throw new Error('Chưa có session. Chạy `npm run login` trước.');

  const browser = await chromium.launch({ channel: env.channel, headless: env.headless });
  const context = await browser.newContext({ storageState: STATE_FILE, viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const page = await context.newPage();
  await registerPopupHandlers(page);

  // Lấy tên game để tìm kiếm
  await page.goto(gamePlayUrl(gameId), { waitUntil: 'domcontentloaded' });
  await waitForGame(page, gameId);
  const gameName = (await page.title()).replace(/\s*[|\-–].*$/, '').trim();
  console.log(`Game: ${gameName} (${gameId})\n\n[1] Quét link trên các bề mặt Facebook`);

  const linkSources = await collectGameLinks(page, gameId, [
    '/',
    '/gaming/play/',
    '/gaming/notifications/',
    '/games/instantgames/category/?category=400',
    `/search/top/?q=${encodeURIComponent(gameName)}`,
    `/gaming/search/?q=${encodeURIComponent(gameName)}`,
    '/bookmarks/',
  ]);

  const sources = [...new Set(['(none)', ...linkSources.keys(), ...GUESSED_SOURCES])];
  console.log(`\n[2] Mở game với ${sources.length} giá trị source`);

  const results: Record<string, unknown>[] = [];
  for (const source of sources) {
    const url = source === '(none)' ? gamePlayUrl(gameId) : gamePlayUrl(gameId, { source });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const row: Record<string, unknown> = { source, seenOn: linkSources.get(source) ?? '(đoán)', url };
    try {
      const info = await waitForGame(page, gameId, 45_000);
      Object.assign(row, { entryPoint: info.entryPoint, entryPointData: info.entryPointData, contextType: info.contextType });
    } catch (err) {
      row.error = err instanceof Error ? err.message : String(err);
    }
    console.log(`  ${String(source).padEnd(26)} -> ${row.entryPoint ?? `✘ ${row.error}`}`);
    results.push(row);
  }

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify({ gameId, gameName, at: new Date().toISOString(), results }, null, 2));
  console.log(`\n✔ Đã lưu ${REPORT_FILE}`);
  await browser.close();
}

main().catch((err) => {
  console.error('✘', err instanceof Error ? err.message : err);
  process.exit(1);
});
