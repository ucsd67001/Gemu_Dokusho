/* ============================================================
   カフェの背景の絵を作る（一度だけ使う道具）

   使い方（リポジトリの一番上で）：
     node 04_tools/部屋を作る.mjs          … 2枚作る
     node 04_tools/部屋を作る.mjs 4        … 4枚作る

   ・鍵は ~/.gemu-dokusho/openai.txt から読む（リポジトリの外。1行に鍵だけ）
     ⚠️ GEMu_AITuber の .env の鍵は使わない。このアプリ用に別の鍵を作る
   ・できた絵は 04_tools/下書き/ に PNG と WebP で置く（.gitignore 済み）
   ・気に入った1枚の WebP を public/部屋/cafe.webp にして、
     public/部屋.js の 絵: と 比: と 席 を直す（README「部屋の絵を差し替える」）

   ⚠️ 絵の中に人も動物も描かせない。アバターを上に置くため。
   ⚠️ 椅子も描かせない。アバターは椅子ごと描いてある（functions/index.js）。
      代わりに、テーブルのまわりに**何も置いていない床**を4か所あけさせる。
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ここ = dirname(fileURLToPath(import.meta.url));
// sharp は functions に入っているものを借りる
const sharp = createRequire(join(ここ, "../functions/package.json"))("sharp");

const 鍵 = readFileSync(join(homedir(), ".gemu-dokusho", "openai.txt"), "utf8").trim();
const 枚数 = Math.min(4, Math.max(1, Number(process.argv[2]) || 2));
const モデル = process.env.IMAGE_MODEL || "gpt-image-1";

const 指示 = [
  "Isometric cutaway diorama of a single room, viewed from above at a 3/4 angle:",
  "two back walls meeting at the far corner, a square floor seen as a diamond, the room floating on a plain background.",
  "Soft, warm 3D render with rounded clay-like shapes and gentle lighting, like a cozy miniature.",
  "The room is a small, BRIGHT medieval European cafe: whitewashed plaster walls with dark timber beams,",
  "stone and warm wooden plank floor, tall arched windows with daylight pouring in,",
  "it feels like an old book-town cafe (like the used-bookstore district of Jimbocho, Tokyo): shelves crowded with old second-hand books,",
  "small piles of well-read books stacked on the floor and window sills, a wooden counter with coffee cups and ceramic jugs,",
  "an unlit wrought-iron candle chandelier, potted herbs and flowers, a small woven rug.",
  "In the middle of the floor there are one or two round wooden tables with a teapot and cups.",
  "IMPORTANT: leave four clear, empty spots on the floor around the tables (left-back, right-back, left-front, right-front)",
  "where seated characters will be added later. There are NO chairs, NO stools, NO benches at those spots.",
  "No people, no animals, no characters, no text, no signs with letters.",
  "A quiet, calm, bright daytime atmosphere where people would read silently together; a soft pale background around the diorama.",
].join(" ");

const 置き場 = join(ここ, "下書き");
mkdirSync(置き場, { recursive: true });

console.log(`${モデル} で ${枚数} 枚作ります（1〜2分）…`);
const r = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: { "Authorization": `Bearer ${鍵}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: モデル, prompt: 指示, n: 枚数, size: "1536x1024", quality: "high" }),
});
const j = await r.json();
if(!r.ok){
  console.error("作れませんでした：", j?.error?.message || r.status);
  process.exit(1);
}
const 時 = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
for(const [i, d] of j.data.entries()){
  const png = Buffer.from(d.b64_json, "base64");
  const 名 = `cafe_${時}_${i + 1}`;
  writeFileSync(join(置き場, 名 + ".png"), png);
  await sharp(png).webp({ quality: 86 }).toFile(join(置き場, 名 + ".webp"));
  console.log("できました：", join("04_tools", "下書き", 名 + ".webp"));
}
