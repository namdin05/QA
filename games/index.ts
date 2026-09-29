/**
 * Danh sách game. Thêm game mới:
 *   1. Tạo games/<slug>/config.ts (copy từ snake-escape)
 *   2. Thêm vào mảng dưới đây
 *   3. Điền FB_EMAIL_<SLUG> / FB_PASSWORD_<SLUG> vào .env rồi `npm run login -- <slug>`
 */
import snakeEscape from './snake-escape/config';
import type { GameConfig } from './types';

export const GAMES: GameConfig[] = [snakeEscape];

export function getGame(slug?: string): GameConfig {
  const game = slug ? GAMES.find((g) => g.slug === slug) : GAMES[0];
  if (!game) throw new Error(`Không có game "${slug}". Các game hiện có: ${GAMES.map((g) => g.slug).join(', ')}`);
  return game;
}

export type { GameConfig };
