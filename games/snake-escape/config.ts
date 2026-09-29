import type { GameConfig } from '../types';

export default {
  slug: 'snake-escape',
  id: '1329094249218455',
  name: 'Snake Escape Puzzle',
  cocos: {
    readyScene: 'DashboardScene',
    checkButton: 'Canvas/UI/Header/DashboardSceneHeader/ButtonsContainer/SettingsButton',
    checkExpectNode: 'Canvas/Screens/SettingsScreen',
    settleMs: 2_500,
  },
  devices: [
    // SE đời 1 (iOS 10) bị Facebook chặn chơi game -> dùng SE 3 (màn nhỏ 375px, iOS mới)
    'iPhone SE (3rd gen)',
    'iPhone 12',
    'iPhone 15 Pro Max',
    'Pixel 7',
    'Galaxy S9+',
    'Galaxy Tab S4',
    'iPad Mini',
    'iPad Pro 11',
  ],
} satisfies GameConfig;
