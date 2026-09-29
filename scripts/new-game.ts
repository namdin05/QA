/**
 * Tạo cấu hình cho game mới:
 *
 *   npm run game:new -- <slug> <app-id> "<Tên game>"
 *   vd: npm run game:new -- goods-tidy 61586673030312 "Goods Tidy Puzzle"
 *
 * Tạo games/<slug>/game.json + games/<slug>/features/, thêm dòng FB_EMAIL_<SLUG>/FB_PASSWORD_<SLUG> vào .env
 */
import fs from 'node:fs';
import path from 'node:path';
import { GAMES_DIR } from '../games';
import { ROOT_DIR, envSuffix } from '../src/config';

const [slug, id, name] = process.argv.slice(2);
if (!slug || !id || !name) {
  console.error('Cách dùng: npm run game:new -- <slug> <app-id> "<Tên game>"');
  process.exit(1);
}
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('✘ slug chỉ gồm chữ thường, số và dấu "-" (vd goods-tidy)');
  process.exit(1);
}

const dir = path.join(GAMES_DIR, slug);
const file = path.join(dir, 'game.json');
if (fs.existsSync(file)) {
  console.error(`✘ games/${slug}/game.json đã tồn tại`);
  process.exit(1);
}
fs.mkdirSync(path.join(dir, 'features'), { recursive: true });
fs.writeFileSync(path.join(dir, 'features', '.gitkeep'), '');
fs.writeFileSync(file, `${JSON.stringify({ $schema: '../game.schema.json', id, name }, null, 2)}\n`);
console.log(`✔ Đã tạo games/${slug}/game.json`);

// Thêm chỗ điền tài khoản vào .env (không ghi đè nếu đã có)
const envFile = path.join(ROOT_DIR, '.env');
const suffix = envSuffix(slug);
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
if (!env.includes(`FB_EMAIL_${suffix}=`)) {
  const block = `\n# ${name}\nFB_EMAIL_${suffix}=\nFB_PASSWORD_${suffix}=\n`;
  // Chèn ngay sau khối tài khoản cuối cùng cho gọn
  const lines = env.split('\n');
  const last = lines.map((l, i) => (l.startsWith('FB_PASSWORD_') ? i : -1)).filter((i) => i >= 0).pop();
  const next = last === undefined ? `${env.trimEnd()}\n${block}` : [...lines.slice(0, last + 1), ...block.trimEnd().split('\n'), ...lines.slice(last + 1)].join('\n');
  fs.writeFileSync(envFile, next);
  console.log(`✔ Đã thêm FB_EMAIL_${suffix} / FB_PASSWORD_${suffix} vào .env — hãy điền tài khoản`);
}

console.log(`
Tiếp theo:
  1. Điền tài khoản vào .env
  2. npm run login -- ${slug}
  3. npm run game:buttons -- ${slug}      (game Cocos: điền "cocos" trong game.json)
  4. npx playwright test --project=${slug}`);
