/**
 * Reporter xuất kết quả thành site tĩnh (mặc định ./docs) để đẩy lên GitHub Pages:
 *
 *   docs/index.html                  landing page: danh sách mọi lần chạy
 *   docs/reports/<runId>.html        report của 1 lần chạy — tự chứa (dữ liệu + ảnh nhúng sẵn)
 *   docs/reports/runs.json           manifest để build lại landing page
 *
 * GitHub Pages là public -> KHÔNG xuất trace/video (chứa cookie đăng nhập) và cắt token khỏi URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { env } from '../src/config';

type Options = { outputDir?: string; maxRuns?: number };

type TestRow = {
  kind: string;
  name: string;
  source?: string;
  expected?: string;
  actual?: string;
  url?: string;
  status: TestResult['status'];
  durationMs: number;
  error?: string;
  /** data: URI */
  screenshot?: string;
};

type RunSummary = {
  id: string;
  /** Đường dẫn report, tương đối so với index.html */
  file: string;
  startedAt: string;
  durationMs: number;
  status: FullResult['status'];
  counts: { total: number; passed: number; failed: number; skipped: number };
  meta: { gameId: string; gameName: string; account: string; browser: string; playwright: string };
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

function renderTemplate(name: string, placeholder: string, data: unknown): string {
  const css = fs.readFileSync(path.join(TEMPLATE_DIR, 'style.css'), 'utf8');
  return fs
    .readFileSync(path.join(TEMPLATE_DIR, name), 'utf8')
    .replace('/*__STYLE__*/', () => css)
    .replace(placeholder, () => toScriptJson(data));
}

export default class DashboardReporter implements Reporter {
  private readonly outputDir: string;
  private readonly maxRuns: number;
  private readonly startedAt = new Date();
  private readonly runId = this.startedAt.toISOString().replace(/[:.]/g, '-');
  private readonly rows = new Map<string, TestRow>();
  private config?: FullConfig;

  constructor(options: Options = {}) {
    this.outputDir = path.resolve(ROOT, options.outputDir ?? 'docs');
    this.maxRuns = options.maxRuns ?? 200;
  }

  onBegin(config: FullConfig) {
    this.config = config;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const ann = (type: string) => test.annotations.findLast((a) => a.type === `ep.${type}`)?.description;
    const url = ann('url');

    // Map theo test.id: nếu có retry thì lần sau ghi đè lần trước
    this.rows.set(test.id, {
      kind: ann('kind') ?? 'Khác',
      name: ann('name') ?? test.title,
      source: ann('source'),
      expected: ann('expected'),
      actual: ann('actual') || undefined,
      url: url && sanitizeUrl(url),
      status: result.status,
      durationMs: result.duration,
      error: result.errors.length
        ? sanitizeText(stripAnsi(result.errors.map((e) => e.message ?? '').join('\n'))).slice(0, 2000)
        : undefined,
      screenshot: this.screenshotDataUri(result),
    });
  }

  /** Ưu tiên ảnh game (attach trong test), fallback ảnh chụp lúc fail */
  private screenshotDataUri(result: TestResult): string | undefined {
    const att =
      result.attachments.find((a) => a.name === 'game') ?? result.attachments.find((a) => a.name === 'screenshot');
    if (!att) return undefined;
    const body = att.body ?? (att.path && fs.existsSync(att.path) ? fs.readFileSync(att.path) : undefined);
    return body && `data:${att.contentType};base64,${body.toString('base64')}`;
  }

  onEnd(result: FullResult) {
    const rows = [...this.rows.values()];
    const count = (s: TestResult['status'][]) => rows.filter((r) => s.includes(r.status)).length;
    const summary: RunSummary = {
      id: this.runId,
      file: `reports/${this.runId}.html`,
      startedAt: this.startedAt.toISOString(),
      durationMs: result.duration,
      status: result.status,
      counts: {
        total: rows.length,
        passed: count(['passed']),
        failed: count(['failed', 'timedOut', 'interrupted']),
        skipped: count(['skipped']),
      },
      meta: {
        gameId: env.gameId,
        gameName: env.gameName,
        account: maskEmail(env.email),
        browser: env.channel ?? 'chromium',
        playwright: this.config?.version ?? '',
      },
    };

    const reportsDir = path.join(this.outputDir, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    const reportFile = path.join(this.outputDir, summary.file);
    fs.writeFileSync(reportFile, renderTemplate('report.html', '/*__RUN__*/null', { ...summary, tests: rows }));

    // Cập nhật manifest, xoá report cũ vượt quá maxRuns
    const manifestFile = path.join(reportsDir, 'runs.json');
    const runs: RunSummary[] = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : [];
    const kept = [summary, ...runs.filter((r) => r.id !== summary.id)];
    for (const old of kept.splice(this.maxRuns)) fs.rmSync(path.join(this.outputDir, old.file), { force: true });
    fs.writeFileSync(manifestFile, JSON.stringify(kept, null, 2));

    fs.writeFileSync(path.join(this.outputDir, 'index.html'), renderTemplate('index.html', '/*__RUNS__*/[]', kept));
    // Tắt Jekyll của GitHub Pages — không cần build, phục vụ file nguyên trạng
    fs.writeFileSync(path.join(this.outputDir, '.nojekyll'), '');

    console.log(`\n📊 Report: ${path.relative(process.cwd(), reportFile)}`);
    console.log(`   Landing: ${path.relative(process.cwd(), path.join(this.outputDir, 'index.html'))}  (npm run dashboard để mở)`);
  }

  printsToStdio() {
    return false;
  }
}
