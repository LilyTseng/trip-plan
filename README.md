# Trip Plan

多人即時同步的旅遊規劃 App，支援行程安排、行李清單、分帳結算。

**Live:** https://lilytseng.github.io/trip-plan/

## 功能

- **行程管理** — 每日行程事件，支援長按拖曳排序、跨日移動
- **行李 / 伴手禮清單** — 每趟旅行獨立的 checklist
- **分帳** — 多幣別支援、即時匯率、自動結算誰欠誰多少
- **帳本** — JPY 快速換算計算機
- **即時同步** — Firebase Firestore 多人即時共享
- **離線支援** — localStorage 離線快取，恢復連線後自動同步

## Tech Stack

- Angular 21 (standalone components)
- Firebase Firestore + Anonymous Auth
- Tailwind CSS 3
- GitHub Pages 部署

## 開發

```bash
npm install
npm start         # http://localhost:4200
```

需要 Node.js >= 20.19。

## 部署

```bash
make deploy       # build → 複製到 docs/ → commit → push
```

或分開執行：

```bash
make build        # 只 build
```

## 專案結構

```
src/app/
  models/types.ts              # 資料型別定義
  services/
    trip.service.ts            # 核心資料管理 + Firestore 同步
    ledger.service.ts          # 帳本（JPY 換算）
    exchange-rate.service.ts   # 即時匯率 API
    undo.service.ts            # 刪除復原 snackbar
  components/
    itinerary/                 # 行程頁（含拖曳排序）
    checklist/                 # 行李 / 伴手禮清單
    ledger/                    # 帳本計算機
    split/                     # 分帳 + 結算
    bottom-sheet/              # 新增 / 編輯表單
    trip-manager/              # 旅行管理 modal
  firebase.config.ts           # Firebase 初始化 + 匿名登入
firestore.rules                # Firestore 安全規則
```
