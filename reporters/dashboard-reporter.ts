/**
 * Reporter xuất kết quả thành site tĩnh (mặc định ./docs) để đẩy lên GitHub Pages:
 *
 *   docs/index.html                  landing page: danh sách mọi lần chạy
 *   docs/reports/<runId>.html        report của 1 lần chạy (dữ liệu + ảnh nhúng sẵn)
 *   docs/reports/<runId>/<n>.webm    video từng test — chỉ giữ cho `maxVideoRuns` lần chạy gần nhất
 *   docs/reports/runs.json           manifest để build lại landing page
 *
 * Test ghi dữ liệu qua annotation `r.*` (xem src/report.ts). Game lấy theo project, feature lấy theo
 * thư mục chứa file test: features/<feature>/ hoặc games/<slug>/features/<feature>/.
 *
 * GitHub Pages là public -> KHÔNG xuất trace (chứa cookie đăng nhập) và cắt token khỏi URL.
 * Video chỉ là hình ảnh màn hình, không chứa cookie.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { GAMES } from '../games';
import { env, gameAccount } from '../src/config';

type Options = { outputDir?: string; maxRuns?: number; maxVideoRuns?: number };

type Check = { name: string; status: 'pass' | 'warn' | 'fail'; ok: boolean; detail?: string };

type TestRow = {
  game: string;
  feature: string;
  kind: string;
  name: string;
  source?: string;
  expected?: string;
  actual?: string;
  url?: string;
  /** vd "SettingsButton → SettingsScreen", hoặc "skipped: ..." */
  play?: string;
  /** Thời gian từ lúc bắt đầu tới khi game vào màn hình chính */
  readyMs?: number;
  /** Thông tin thiết bị giả lập (feature responsive) */
  device?: Record<string, unknown>;
  layout?: string;
  canvas?: string;
  checks: Check[];
  status: TestResult['status'];
  durationMs: number;
  error?: string;
  /** data: URI */
  screenshot?: string;
  dashboardShot?: string;
  /** Đường dẫn tương đối so với file report */
  video?: string;
};

type Counts = { total: number; passed: number; failed: number; skipped: number; warned: number };

type RunSummary = {
  id: string;
  /** Đường dẫn report, tương đối so với index.html */
  file: string;
  startedAt: string;
  durationMs: number;
  status: FullResult['status'];
  /** warned = số test pass nhưng có ít nhất 1 kiểm tra ⚠ */
  counts: Counts;
  /** Số liệu riêng từng game (slug -> counts) — landing page lọc theo game */
  perGame: Record<string, Counts>;
  features: string[];
  games: { slug: string; id: string; name: string; account: string }[];
  meta: { browser: string; playwright: string };
};

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(ROOT, 'dashboard');

const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

/** mklthybkuw_123@tfbnw.net -> mk***@tfbnw.net */
const maskEmail = (email: string) => email.replace(/^(.{2}).*(@.*)$/, '$1***$2');

/** Chỉ giữ `source` trên URL Facebook — bỏ hash/ext/gd_impression_id... (token gắn với phiên) */
function sanitizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const source = url.searchParams.get('source');
    url.search = source ? `?source=${source}` : '';
    return url.toString();
  } catch {
    return raw;
  }
}
const sanitizeText = (text: string) => text.replace(/https:\/\/[^\s"'`]*facebook\.com[^\s"'`]*/g, sanitizeUrl);

/** Nhúng JSON vào <script> an toàn (không để chuỗi `</script>` trong dữ liệu đóng thẻ sớm) */
const toScriptJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export function renderTemplate(name: string, placeholder: string, data: unknown): string {
  const css = fs.readFileSync(path.join(TEMPLATE_DIR, 'style.css'), 'utf8');
  return fs
    .readFileSync(path.join(TEMPLATE_DIR, name), 'utf8')
    .replace('/*__STYLE__*/', () => css)
    .replace(placeholder, () => toScriptJson(data));
}

/** features/entry-point/x.spec.ts -> entry-point; games/<slug>/features/shop/x.spec.ts -> shop */
function featureOf(test: TestCase): string {
  const rel = path.relative(ROOT, test.location.file).split(path.sep);
  const i = rel.lastIndexOf('features');
  return i >= 0 && rel[i + 1] ? rel[i + 1] : 'other';
}

function countRows(rows: TestRow[]): Counts {
  const count = (s: TestResult['status'][]) => rows.filter((r) => s.includes(r.status)).length;
  return {
    total: rows.length,
    passed: count(['passed']),
    failed: count(['failed', 'timedOut', 'interrupted']),
    skipped: count(['skipped']),
    warned: rows.filter((r) => r.status === 'passed' && r.checks.some((c) => c.status === 'warn')).length,
  };
}

/** Landing page: danh sách lần chạy + danh sách game đang cấu hình (cho bộ chọn game) */
export function writeLanding(outputDir: string, runs: unknown[]) {
  const games = GAMES.map(({ slug, id, name }) => ({ slug, id, name }));
  fs.writeFileSync(path.join(outputDir, 'index.html'), renderTemplate('index.html', '/*__DATA__*/null', { runs, games }));
  // Tắt Jekyll của GitHub Pages — không cần build, phục vụ file nguyên trạng
  fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');
}

export default class DashboardReporter implements Reporter {
  private readonly outputDir: string;
  private readonly maxRuns: number;
  private readonly maxVideoRuns: number;
  private readonly startedAt = new Date();
  private readonly runId = this.startedAt.toISOString().replace(/[:.]/g, '-');
  private readonly rows = new Map<string, TestRow>();
  private readonly indexes = new Map<string, number>();
  private config?: FullConfig;

  constructor(options: Options = {}) {
    this.outputDir = path.resolve(ROOT, options.outputDir ?? 'docs');
    this.maxRuns = options.maxRuns ?? 200;
    this.maxVideoRuns = options.maxVideoRuns ?? 5;
  }

  private get videoDir() {
    return path.join(this.outputDir, 'reports', this.runId);
  }

  onBegin(config: FullConfig) {
    this.config = config;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Test bị skip vì game không áp dụng (vd thiết bị không có trong config game) -> không đưa lên report
    if (test.annotations.some((a) => a.type === 'r.na')) return;
    const all = (type: string) => test.annotations.filter((a) => a.type === `r.${type}`).map((a) => a.description ?? '');
    const ann = (type: string) => all(type).at(-1);
    const url = ann('url');
    const readyMs = ann('ready_ms');
    const device = ann('device');

    // Map theo test.id: nếu có retry thì lần sau ghi đè lần trước
    this.rows.set(test.id, {
      game: test.parent.project()?.name ?? '',
      feature: featureOf(test),
      kind: ann('kind') ?? 'Khác',
      name: ann('name') ?? test.title,
      source: ann('source'),
      expected: ann('expected'),
      actual: ann('actual') || undefined,
      url: url && sanitizeUrl(url),
      play: ann('play'),
      readyMs: readyMs ? Number(readyMs) : undefined,
      device: device ? JSON.parse(device) : undefined,
      layout: ann('layout'),
      canvas: ann('canvas'),
      checks: all('check').map((c) => JSON.parse(c) as Check),
      status: result.status,
      durationMs: result.duration,
      error: result.errors.length
        ? sanitizeText(stripAnsi(result.errors.map((e) => e.message ?? '').join('\n'))).slice(0, 2000)
        : undefined,
      // Ưu tiên ảnh game (attach trong test), fallback ảnh chụp lúc fail
      screenshot: this.dataUri(result, 'game') ?? this.dataUri(result, 'screenshot'),
      dashboardShot: this.dataUri(result, 'dashboard'),
      video: this.saveVideo(result, this.fileIndex(test)),
    });
  }

  /** Số thứ tự ổn định cho từng test (retry vẫn giữ số cũ) — dùng đặt tên file video */
  private fileIndex(test: TestCase): number {
    if (!this.indexes.has(test.id)) this.indexes.set(test.id, this.indexes.size + 1);
    return this.indexes.get(test.id)!;
  }

  private saveVideo(result: TestResult, index: number): string | undefined {
    const att = result.attachments.find((a) => a.name === 'video' && a.path && fs.existsSync(a.path));
    if (!att?.path) return undefined;
    fs.mkdirSync(this.videoDir, { recursive: true });
    fs.copyFileSync(att.path, path.join(this.videoDir, `${index}.webm`));
    return `${this.runId}/${index}.webm`;
  }

  private dataUri(result: TestResult, name: string): string | undefined {
    const att = result.attachments.find((a) => a.name === name);
    if (!att) return undefined;
    const body = att.body ?? (att.path && fs.existsSync(att.path) ? fs.readFileSync(att.path) : undefined);
    return body && `data:${att.contentType};base64,${body.toString('base64')}`;
  }

  onEnd(result: FullResult) {
    const rows = [...this.rows.values()];
    // `--list`, hoặc filter không khớp test nào -> không tạo report rỗng
    if (!rows.length) return;
    const slugs = [...new Set(rows.map((r) => r.game))];
    const summary: RunSummary = {
      id: this.runId,
      file: `reports/${this.runId}.html`,
      startedAt: this.startedAt.toISOString(),
      durationMs: result.duration,
      status: result.status,
      counts: countRows(rows),
      perGame: Object.fromEntries(slugs.map((slug) => [slug, countRows(rows.filter((r) => r.game === slug))])),
      features: [...new Set(rows.map((r) => r.feature))],
      games: slugs.map((slug) => {
        const game = GAMES.find((g) => g.slug === slug);
        return { slug, id: game?.id ?? '', name: game?.name ?? slug, account: maskEmail(gameAccount(slug).email) };
      }),
      meta: {
        browser: env.channel ?? 'chromium',
        playwright: this.config?.version ?? '',
      },
    };

    const reportsDir = path.join(this.outputDir, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportFile = path.join(this.outputDir, summary.file);
    fs.writeFileSync(reportFile, renderTemplate('report.html', '/*__RUN__*/null', { ...summary, tests: rows }));

    // Cập nhật manifest, xoá report cũ vượt quá maxRuns; video chỉ giữ cho maxVideoRuns lần gần nhất
    // (video ~1MB/test -> giữ hết sẽ làm repo GitHub phình rất nhanh)
    const manifestFile = path.join(reportsDir, 'runs.json');
    const runs: RunSummary[] = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : [];
    const kept = [summary, ...runs.filter((r) => r.id !== summary.id)];
    for (const old of kept.splice(this.maxRuns)) fs.rmSync(path.join(this.outputDir, old.file), { force: true });
    for (const old of kept.slice(this.maxVideoRuns)) {
      fs.rmSync(path.join(reportsDir, old.id), { recursive: true, force: true });
    }
    fs.writeFileSync(manifestFile, JSON.stringify(kept, null, 2));

    writeLanding(this.outputDir, kept);

    console.log(`\n📊 Report: ${path.relative(process.cwd(), reportFile)}`);
    console.log(`   Landing: ${path.relative(process.cwd(), path.join(this.outputDir, 'index.html'))}  (npm run dashboard để mở)`);
  }

  printsToStdio() {
    return false;
  }
}
