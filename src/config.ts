import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const FB_URL = 'https://www.facebook.com';

export const AUTH_DIR = path.resolve(__dirname, '..', '.auth');
/** Profile Chromium đầy đủ (cookie, IndexedDB, cache...) — dùng cho bước login thủ công */
export const PROFILE_DIR = path.join(AUTH_DIR, 'profile');
/** Snapshot cookie + localStorage — các test sẽ load file này để không phải login lại */
export const STATE_FILE = path.join(AUTH_DIR, 'fb-state.json');

export const env = {
  email: process.env.FB_EMAIL ?? '',
  password: process.env.FB_PASSWORD ?? '',
  channel: process.env.BROWSER_CHANNEL || undefined,
  headless: process.env.HEADLESS === 'true',
  gameId: process.env.FB_GAME_ID ?? '',
  // Chỉ cần cho các entry point qua tìm kiếm
  gameName: process.env.FB_GAME_NAME ?? '',
};
