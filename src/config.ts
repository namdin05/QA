import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export const FB_URL = 'https://www.facebook.com';
export const ROOT_DIR = path.resolve(__dirname, '..');
export const AUTH_DIR = path.join(ROOT_DIR, '.auth');

export const env = {
  channel: process.env.BROWSER_CHANNEL || undefined,
  // Mặc định chạy ẩn; HEADLESS=false để hiện cửa sổ khi debug
  headless: process.env.HEADLESS !== 'false',
};

/** snake-escape -> SNAKE_ESCAPE */
export const envSuffix = (slug: string) => slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_');

/** Tài khoản test của từng game: FB_EMAIL_<SLUG> / FB_PASSWORD_<SLUG> trong .env */
export function gameAccount(slug: string) {
  const suffix = envSuffix(slug);
  return {
    email: process.env[`FB_EMAIL_${suffix}`] ?? '',
    password: process.env[`FB_PASSWORD_${suffix}`] ?? '',
  };
}

/** Mỗi game một account -> mỗi game một session riêng */
export function authPaths(slug: string) {
  const dir = path.join(AUTH_DIR, slug);
  return {
    /** Profile trình duyệt đầy đủ — dùng cho bước login thủ công */
    profileDir: path.join(dir, 'profile'),
    /** Snapshot cookie + localStorage — các test load file này để không phải login lại */
    stateFile: path.join(dir, 'state.json'),
  };
}
