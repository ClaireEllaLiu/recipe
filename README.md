# 今天煮什麼 — 食譜小幫手

輸入或點選菜名，就顯示食材清單與逐步做法的網頁。

## 兩種執行方式

### 1. 純靜態（免費，不需要伺服器）

直接開 `index.html`，或部署到 GitHub Pages 之類的靜態空間。

- 內建 27 道食譜可以瀏覽與搜尋
- 資料庫裡沒有的菜，會顯示「這道菜正在補充中」

### 2. 加後端（可以查任何菜色）

後端會在查不到的時候上網搜尋那道菜，判斷是不是一道真實可烹調的菜，
產生食材與步驟，並存進快取供下次直接使用。

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...     # 需要自己的 API 金鑰
node server.js                          # 預設 http://localhost:3000
```

沒有設定 `ANTHROPIC_API_KEY` 時伺服器照樣可以跑，只是查不到的菜不會上網查詢，
行為跟純靜態版本一樣。

## 檔案說明

| 檔案 | 用途 |
| --- | --- |
| `index.html` / `style.css` / `app.js` | 前端 |
| `data/recipes.js` | 內建食譜庫（27 道，皆經查證） |
| `data/generated.json` | 上網查詢後產生的食譜快取（自動建立） |
| `server.js` | 後端：靜態檔案 + `/api/recipe` |

## API

`GET /api/recipe?name=<菜名>`

| 回傳 `status` | 意思 |
| --- | --- |
| `found` | 找到了，`recipe` 為食譜內容，`source` 是 `database` 或 `researched` |
| `not_a_dish` | 輸入的不是一道可以烹調的菜，`message` 說明原因 |
| `unavailable` | 伺服器沒有設定 API 金鑰 |
| `error` | 查詢過程出錯 |

## 新增食譜

把物件加進 `data/recipes.js` 的陣列即可：

```js
{
  id: "dish-id",
  name: "菜名",
  aliases: ["別名", "English name"],
  time: "30 分鐘",
  servings: "3 人份",
  ingredients: [{ name: "食材", qty: "2 顆" }],
  steps: ["步驟一。", "步驟二。"]
}
```

## 成本備註

每次上網查一道新菜會用到一次 Claude API 呼叫（含網路搜尋），查過的菜會存進
`data/generated.json`，之後不再重複查詢。
