/**
 * Tự đọc mọi game trong games/<slug>/game.json — thêm game mới không cần sửa code:
 *
 *   npm run game:new -- <slug> <app-id> "<Tên game>"
 *
 * rồi điền tài khoản FB_EMAIL_<SLUG> / FB_PASSWORD_<SLUG> vào .env và `npm run login -- <slug>`.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { GameConfig } from './types';

export const GAMES_DIR = __dirname;

const defaults: Pick<GameConfig, 'devices'> = JSON.parse(fs.readFileSync(path.join(GAMES_DIR, 'defaults.json'), 'utf8'));

function loadGame(slug: string): GameConfig {
  const file = path.join(GAMES_DIR, slug, 'game.json');
  let data: Partial<GameConfig> & { $schema?: string };
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`games/${slug}/game.json không đọc được: ${(err as Error).message}`);
  }
  const missing = (['id', 'name'] as const).filter((k) => !data[k]);
  if (missing.length) throw new Error(`games/${slug}/game.json thiếu trường: ${missing.join(', ')}`);
  if (data.cocos && (!data.cocos.readyScene || !data.cocos.checkButton)) {
    throw new Error(`games/${slug}/game.json: "cocos" cần có readyScene và checkButton (hoặc xoá hẳn "cocos")`);
  }
  const { $schema: _schema, ...config } = data;
  return { ...defaults, ...config, slug } as GameConfig;
}

/** Mọi thư mục trong games/ có game.json, sắp theo tên */
export const GAMES: GameConfig[] = fs
  .readdirSync(GAMES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(GAMES_DIR, d.name, 'game.json')))
  .map((d) => loadGame(d.name))
  .sort((a, b) => a.slug.localeCompare(b.slug));

export function getGame(slug?: string): GameConfig {
  if (!slug) {
    if (GAMES.length === 1) return GAMES[0];
    throw new Error(`Có ${GAMES.length} game, hãy chỉ rõ: ${GAMES.map((g) => g.slug).join(', ')}`);
  }
  const game = GAMES.find((g) => g.slug === slug);
  if (!game) throw new Error(`Không có game "${slug}". Các game hiện có: ${GAMES.map((g) => g.slug).join(', ')}`);
  return game;
}

export type { GameConfig };
