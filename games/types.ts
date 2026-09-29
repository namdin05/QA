export type GameConfig = {
  /** Tên thư mục trong games/ — cũng là tên project Playwright (`--project=<slug>`) */
  slug: string;
  /** Facebook App ID. Mỗi account test chỉ được cấp quyền chơi 1 game */
  id: string;
  /** Tên hiển thị — dùng cho entry point qua ô tìm kiếm */
  name: string;

  /** Game Cocos Creator: dùng để chứng minh đã vào game thành công (xem `npm run game:buttons`) */
  cocos?: {
    /** Scene khi game đã load xong và vào màn hình chính */
    readyScene: string;
    /** Nút sẽ bấm — nên chọn nút không ảnh hưởng tiến trình chơi (vd Settings) */
    checkButton: string;
    /** Node phải hiện ra sau khi bấm (vd popup). Bỏ trống = chờ scene đổi */
    checkExpectNode?: string;
    /** Chờ thêm sau khi vào readyScene cho animation mở màn chạy xong, trước khi chụp */
    settleMs?: number;
  };

  /** Tên thiết bị trong `devices` của Playwright cho feature responsive */
  devices: string[];
};
