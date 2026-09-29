/**
 * Dựng lại mọi report + landing page trong docs/ từ template hiện tại (dashboard/*),
 * không cần chạy lại test. Dùng sau khi sửa giao diện report.
 *
 *   npm run report:rebuild
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderTemplate, writeLanding } from '../reporters/dashboard-reporter';
import { ROOT_DIR } from '../src/config';

const docs = path.join(ROOT_DIR, 'docs');
const runs: { file: string }[] = JSON.parse(fs.readFileSync(path.join(docs, 'reports', 'runs.json'), 'utf8'));
for (const run of runs) {
  const file = path.join(docs, run.file);
  // Dữ liệu đã nhúng trong report: `const RUN = {...};`
  const data = fs.readFileSync(file, 'utf8').match(/const RUN = (\{.*?\});\n/s)?.[1];
  if (!data) {
    console.warn(`⚠ Bỏ qua ${run.file}: không đọc được dữ liệu`);
    continue;
  }
  fs.writeFileSync(file, renderTemplate('report.html', '/*__RUN__*/null', JSON.parse(data)));
}
writeLanding(docs, runs);
console.log(`✔ Đã dựng lại ${runs.length} report + landing page`);
