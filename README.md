# Facebook Instant Games — automation test

Playwright + TypeScript, chạy trên Edge thật. Mặc định chạy ẩn (headless, UA "HeadlessChrome" được thay bằng UA thật
để Facebook không chặn); đặt `HEADLESS=false` trong `.env` khi cần xem trực tiếp để debug. `npm run login` luôn hiện cửa sổ.

## Cấu trúc

```
games/                     # cấu hình từng game — mỗi game là 1 project Playwright
  index.ts                 #   danh sách game
  snake-escape/
    config.ts              #   app id, tên, scene/nút Cocos, danh sách thiết bị
    features/              #   test riêng của game này (nếu có)
features/                  # test dùng chung, chạy cho mọi game
  auth/                    #   session đăng nhập còn hiệu lực
  entry-point/             #   vào game từ nhiều entry point (UI + URL), có video
  responsive/              #   UI trên nhiều thiết bị giả lập, chụp màn hình + ghi chú
src/                       # helper: fb (login), game (FBInstant, iframe), cocos (click trong canvas), report
reporters/                 # xuất report tĩnh ra docs/ cho GitHub Pages
dashboard/                 # template HTML/CSS của report
scripts/                   # login, discover entry point, liệt kê nút trong game
```

## Chạy

```bash
npm run login -- snake-escape         # đăng nhập 1 lần, lưu session vào .auth/snake-escape/
npm test                              # mọi feature, mọi game
npm run test:entry                    # chỉ entry point
npm run test:responsive               # chỉ responsive
npx playwright test --project=snake-escape features/responsive   # 1 game, 1 feature
npm run dashboard                     # mở report (docs/index.html)
```

## Thêm game mới

1. Copy `games/snake-escape/config.ts` sang `games/<slug>/config.ts`, sửa `id`, `name`, `devices`.
2. Thêm vào mảng `GAMES` trong `games/index.ts`.
3. Thêm `FB_EMAIL_<SLUG>` / `FB_PASSWORD_<SLUG>` vào `.env` (SLUG viết hoa, `-` thành `_`), rồi `npm run login -- <slug>`.
4. Game Cocos Creator: `npm run game:buttons -- <slug>` để xem tên scene và đường dẫn các nút, điền vào `cocos`.
5. `npm run discover -- <slug>` để dò các `source` entry point Facebook đang dùng.

## Thêm feature mới

- Dùng chung cho mọi game: tạo `features/<feature>/<tên>.spec.ts`.
- Riêng 1 game: tạo `games/<slug>/features/<feature>/<tên>.spec.ts`.

Import `test` từ `src/fixtures` để có sẵn fixture `game` (config của game đang chạy) và tự đóng popup Facebook.
Ghi dữ liệu lên report bằng `note()`, `check()`, `attachScreenshot()` trong `src/report.ts`;
report tự tạo 1 mục riêng cho feature theo tên thư mục.
