# Facebook Instant Games — automation test

Playwright + TypeScript, chạy trên Edge thật. Mặc định chạy ẩn (headless, UA "HeadlessChrome" được thay bằng UA thật
để Facebook không chặn); đặt `HEADLESS=false` trong `.env` khi cần xem trực tiếp để debug. `npm run login` luôn hiện cửa sổ.

## Cấu trúc

```
games/                     # dữ liệu từng game — tự phát hiện, mỗi game là 1 project Playwright
  defaults.json            #   giá trị mặc định (danh sách thiết bị responsive)
  game.schema.json         #   schema để VS Code gợi ý/kiểm tra game.json
  snake-escape/
    game.json              #   app id, tên, scene/nút Cocos, (tuỳ chọn) danh sách thiết bị
    features/              #   test riêng của game này (nếu có)
  goods-tidy/
    game.json
features/                  # test dùng chung, chạy cho mọi game
  auth/                    #   session đăng nhập còn hiệu lực
  entry-point/             #   vào game từ nhiều entry point (UI + URL), có video
  responsive/              #   UI trên nhiều thiết bị giả lập, chụp màn hình + ghi chú
src/                       # helper: fb (login), game (FBInstant, iframe), cocos (click trong canvas), report
reporters/                 # xuất report tĩnh ra docs/ cho GitHub Pages
dashboard/                 # template HTML/CSS của report
scripts/                   # tạo game, login, mở game bằng tay, discover entry point, liệt kê nút
```

Tài khoản test mỗi game nằm trong `.env` (không commit): `FB_EMAIL_<SLUG>` / `FB_PASSWORD_<SLUG>`,
SLUG = tên thư mục viết hoa, `-` thành `_` (vd `goods-tidy` → `FB_EMAIL_GOODS_TIDY`).

## Chạy

```bash
npm test                                           # mọi feature, mọi game (chạy ẩn)
npx playwright test --project=goods-tidy           # 1 game
npx playwright test --project=goods-tidy features/responsive   # 1 game, 1 feature
npm run test:entry / test:responsive / test:auth   # 1 feature, mọi game
npm run dashboard                                  # mở report (docs/index.html)
npm run report:rebuild                             # dựng lại report sau khi sửa template giao diện
```

## Thêm game mới (không cần sửa code)

```bash
npm run game:new -- <slug> <app-id> "<Tên game>"   # tạo games/<slug>/game.json + dòng tài khoản trong .env
# điền FB_EMAIL_<SLUG> / FB_PASSWORD_<SLUG> vào .env
npm run login -- <slug>                            # đăng nhập 1 lần (có cửa sổ, tự điền form)
npm run game:buttons -- <slug>                     # game Cocos: xem scene + đường dẫn nút -> điền "cocos" trong game.json
npm run discover -- <slug>                         # (tuỳ chọn) dò các `source` entry point
npx playwright test --project=<slug>
```

- **App ID** là số trong URL `facebook.com/gaming/play/<app-id>` (thường 15–16 chữ số) — không phải ID Fanpage của game.
  Mở Gaming hub bằng account của game để thấy đúng ID.
- **Account mới đang ở tutorial**: game có thể ẩn nút Settings cho tới khi chơi xong tutorial.
  Chạy `npm run game:open -- <slug>`, chơi qua tutorial trên cửa sổ; script báo khi nút kiểm tra đã hiện.

## Thêm feature mới

- Dùng chung cho mọi game: tạo `features/<feature>/<tên>.spec.ts`.
- Riêng 1 game: tạo `games/<slug>/features/<feature>/<tên>.spec.ts`.

Import `test` từ `src/fixtures` để có sẵn fixture `game` (config của game đang chạy) và tự đóng popup Facebook.
Ghi dữ liệu lên report bằng `note()`, `check()`, `attachScreenshot()` trong `src/report.ts`;
report tự tạo 1 mục riêng cho feature theo tên thư mục.
