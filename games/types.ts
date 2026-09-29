/** Kiểu dữ liệu của games/<slug>/game.json — mô tả chi tiết từng trường trong games/game.schema.json */
export type GameConfig = {
  /** Tên thư mục trong games/ — cũng là tên project Playwright (`--project=<slug>`) */
  slug: string;
  /** Facebook App ID. Mỗi account test chỉ được cấp quyền chơi 1 game */
  id: string;
  /** Tên hiển thị — dùng cho entry point qua ô tìm kiếm */
  name: string;
  /** Game Cocos Creator: dùng để chứng minh đã vào game thành công (xem `npm run game:buttons`) */
  cocos?: {
    readyScene: string;
    checkButton: string;
    checkExpectNode?: string;
    settleMs?: number;
  };
  /** Tên thiết bị trong `devices` của Playwright cho feature responsive */
  devices: string[];
};
