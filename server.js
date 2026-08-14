// 食譜小幫手後端
//
// 靜態網頁沒辦法自己上網搜尋，所以查不到的菜名由這個後端處理：
// 1. 先查本地食譜庫（data/recipes.js）
// 2. 再查已產生過的快取（data/generated.json）
// 3. 都沒有的話上網搜尋，判斷這道菜是否合理，產生食材與步驟後存進快取
//
// 需要 ANTHROPIC_API_KEY 環境變數。沒有金鑰時 /api/recipe 只會回報本地庫的結果，
// 前端會退回顯示「這道菜正在補充中」，網頁其餘功能不受影響。

const http = require("http");
const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const CACHE_PATH = path.join(ROOT, "data", "generated.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

// ---------- 食譜庫 ----------

function loadBuiltinRecipes() {
  const src = fs.readFileSync(path.join(ROOT, "data", "recipes.js"), "utf8");
  const json = src.replace(/^\s*const RECIPES\s*=\s*/, "").replace(/;\s*$/, "");
  return JSON.parse(json);
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return [];
  }
}

function saveToCache(recipe) {
  const cache = loadCache();
  if (cache.some((r) => r.id === recipe.id)) return;
  cache.push(recipe);
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function normalize(str) {
  return String(str || "").trim().toLowerCase();
}

function findLocal(query, recipes) {
  const q = normalize(query);
  if (!q) return null;
  for (const r of recipes) {
    const names = [r.name, ...(r.aliases || [])].map(normalize);
    if (names.includes(q)) return r;
  }
  for (const r of recipes) {
    const names = [r.name, ...(r.aliases || [])].map(normalize);
    if (names.some((n) => n.includes(q) || q.includes(n))) return r;
  }
  return null;
}

// ---------- 上網查食譜 ----------

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    is_dish: {
      type: "boolean",
      description:
        "輸入的文字是否是一道真實存在、可以烹調的菜餚。亂碼、非食物名詞、無法烹調的東西都是 false。",
    },
    reason: {
      type: "string",
      description:
        "當 is_dish 為 false 時，用一句繁體中文說明為什麼不是一道可烹調的菜；is_dish 為 true 時留空字串。",
    },
    recipe: {
      description: "is_dish 為 false 時為 null。",
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            name: { type: "string", description: "菜名，繁體中文" },
            aliases: {
              type: "array",
              items: { type: "string" },
              description: "其他常見寫法或英文名，2-3 個",
            },
            time: { type: "string", description: "烹調時間，例如「30 分鐘」" },
            servings: { type: "string", description: "份量，例如「3 人份」" },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "食材名，台灣常見用語" },
                  qty: {
                    type: "string",
                    description: "份量，例如「2 顆」「1 湯匙」",
                  },
                },
                required: ["name", "qty"],
                additionalProperties: false,
              },
            },
            steps: {
              type: "array",
              items: { type: "string" },
              description: "製作步驟，每一步一句話，依順序排列，適合初學者照著做",
            },
            sources: {
              type: "array",
              items: { type: "string" },
              description: "查證時參考的食譜網址",
            },
          },
          required: [
            "name",
            "aliases",
            "time",
            "servings",
            "ingredients",
            "steps",
            "sources",
          ],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ["is_dish", "reason", "recipe"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `你負責為一個食譜網站查證菜色。使用者輸入一個菜名，你要上網搜尋這道菜的真實做法，然後回傳結構化的食材與步驟。

判斷是否為一道菜：先確認輸入的是不是一道真實存在、可以烹調的菜餚。如果是亂碼、隨機字串、非食物的東西，或是無法烹調的東西，就把 is_dish 設為 false 並用一句話說明。菜名寫法不同、地方叫法、簡體字、英文名都算是有效的菜名，要照樣查。

查證方式：實際使用網路搜尋找 2-3 個食譜來源交叉比對，不要憑記憶編造份量或步驟。如果搜尋後確認這道菜存在但找不到具體做法，仍然把 is_dish 設為 true，並根據該菜系的通用做法給出合理的食材與步驟。

輸出要求：
- 食材份量以 2-4 人份為準
- 食材名稱用台灣常見中文用語（例如「蔥」不是「葱」、「豬絞肉」不是「猪肉末」、「太白粉」不是「淀粉」）
- 步驟清楚、按順序、每一步一句話，適合初學者照著做
- 全部使用繁體中文
- sources 放實際參考的網址`;

// 結構化輸出應該直接給出 JSON，但保險起見也處理被文字或程式碼框包住的情況
function parseRecipeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error("could not parse recipe JSON from response");
  }
}

const MAX_CONTINUATIONS = 5;

async function researchRecipe(dishName) {
  const client = new Anthropic();

  const messages = [
    { role: "user", content: `請查證這道菜並回傳食材與製作步驟：${dishName}` },
  ];

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const stream = client.messages.stream({
      model: "claude-opus-5",
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: RECIPE_SCHEMA },
      },
      messages,
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") throw new Error("refusal");

    // 網路搜尋達到伺服器端的回圈上限時會回 pause_turn，把這一輪接回去繼續
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    if (message.stop_reason === "max_tokens") {
      throw new Error("response truncated (max_tokens)");
    }

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock) throw new Error("no text block in response");
    return parseRecipeJson(textBlock.text);
  }

  throw new Error("still paused after max continuations");
}

function toRecipeRecord(researched, fallbackName) {
  const r = researched.recipe;
  const name = r.name || fallbackName;
  return {
    id: "ai-" + Buffer.from(name).toString("hex").slice(0, 24),
    name,
    aliases: [...new Set([...(r.aliases || []), fallbackName])].filter(
      (a) => a && a !== name
    ),
    time: r.time,
    servings: r.servings,
    ingredients: r.ingredients,
    steps: r.steps,
    sources: r.sources || [],
    generated: true,
  };
}

// ---------- HTTP ----------

const inFlight = new Map();

async function handleRecipeApi(req, res, url) {
  const name = (url.searchParams.get("name") || "").trim();
  if (!name) {
    return sendJson(res, 400, { error: "missing name" });
  }
  if (name.length > 60) {
    return sendJson(res, 400, { error: "name too long" });
  }

  const builtin = loadBuiltinRecipes();
  const local = findLocal(name, builtin) || findLocal(name, loadCache());
  if (local) {
    return sendJson(res, 200, { status: "found", source: "database", recipe: local });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 503, {
      status: "unavailable",
      message: "伺服器未設定 ANTHROPIC_API_KEY，無法上網查詢新菜色。",
    });
  }

  // 同一道菜同時被查多次時只跑一次
  const key = normalize(name);
  if (!inFlight.has(key)) {
    inFlight.set(
      key,
      researchRecipe(name).finally(() => inFlight.delete(key))
    );
  }

  try {
    const researched = await inFlight.get(key);
    if (!researched.is_dish) {
      return sendJson(res, 200, {
        status: "not_a_dish",
        message: researched.reason || `「${name}」看起來不是一道可以烹調的菜。`,
      });
    }
    const record = toRecipeRecord(researched, name);
    saveToCache(record);
    return sendJson(res, 200, {
      status: "found",
      source: "researched",
      recipe: record,
    });
  } catch (err) {
    const isRefusal = err && err.message === "refusal";
    console.error("research failed:", err && err.message);
    return sendJson(res, 502, {
      status: "error",
      message: isRefusal
        ? "這個查詢無法處理，請換一個菜名。"
        : "查詢這道菜時發生問題，請稍後再試。",
    });
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const filePath = path.join(ROOT, rel);
  // 不允許跳出專案目錄
  if (!filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/recipe") {
    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "method not allowed" });
    }
    handleRecipeApi(req, res, url).catch((err) => {
      console.error(err);
      sendJson(res, 500, { status: "error", message: "伺服器錯誤" });
    });
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`食譜小幫手 http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("提示：未設定 ANTHROPIC_API_KEY，查不到的菜色將無法上網查詢。");
  }
});
