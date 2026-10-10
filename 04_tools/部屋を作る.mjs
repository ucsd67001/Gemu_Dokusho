/* ============================================================
   部屋（場所）の背景の絵を作る（部屋ごとに一度だけ使う道具）

   使い方（リポジトリの一番上で）：
     node 04_tools/部屋を作る.mjs rothenburg      … ローテンブルクを2枚
     node 04_tools/部屋を作る.mjs owakudani       … 箱根・大涌谷を2枚
     node 04_tools/部屋を作る.mjs ashinoko        … 箱根・芦ノ湖を2枚
     node 04_tools/部屋を作る.mjs cafe 4          … カフェを4枚
     node 04_tools/部屋を作る.mjs bench           … 空いた席に置く空のベンチ（前向き・後ろ向きの2枚。背景は透明）
       → 気に入ったら public/部屋/bench_front.webp と bench_back.webp にする

   ・鍵は Secret Manager（functions と同じ OPENAI_API_KEY）から、firebase コマンドで読む。
     **ファイルに書き出さない。**画面にも出さない（読んだものをそのまま API へ渡すだけ）
     ⚠️ 鍵は Hongaeshi と同じもの（2026-09-27 配信者の指示）。GEMu_AITuber の .env の鍵は使わない
   ・できた絵は 04_tools/下書き/ に PNG と WebP で置く（.gitignore 済み）
   ・気に入った1枚の WebP を public/部屋/{部屋}.webp にして、
     public/部屋.js の 絵: と 比: と 席 を直す。場所を足すときは firestore.rules の okRoom にも足す（README「場所を足す」）
   ・広場を広げる（構図はそのまま）：node 04_tools/部屋を作る.mjs owakudani 2 --広げる

   ⚠️ 絵の中に人も動物も描かせない。アバターを上に置くため。
   ⚠️ 座るもの（椅子・ベンチ）も描かせない。アバターは座るものごと描いてある（functions/index.js）。
      代わりに、**何も置いていない地面**をあけさせる（最初のカフェは「四隅に4か所」。観光地は手前の広場に二人掛けを4つ置く）。
   ⚠️ 画風は、どの部屋も「斜め上から見た、やわらかい立体のミニチュア（ジオラマ）」にそろえる。
      場所が変わっても、アバターの角度（斜め上から 3/4）と合うように。
   ============================================================ */
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ここ = dirname(fileURLToPath(import.meta.url));
// sharp は functions に入っているものを借りる
const sharp = createRequire(join(ここ, "../functions/package.json"))("sharp");

const 共通 = [
  "Soft, warm 3D render with rounded clay-like shapes and gentle lighting, like a cozy handmade miniature.",
  "No people, no animals, no characters, no cars, no text, no signs with letters.",
  "A quiet, calm, bright atmosphere where people would enjoy reading a book; a soft pale background around the diorama.",
];

const 指示ら = {
  /* 2026-09-27 配信者：最初の場所。プレーンライン（黄色い木組みの家を挟んで、道が二手に分かれる角）。
     「ベンチを置く」場所として。 */
  rothenburg: [
    "Isometric diorama of a small corner of a medieval German old town, viewed from above at a 3/4 angle,",
    "a square cut-out block of the town floating on a plain background.",
    "It is the famous Ploenlein in Rothenburg ob der Tauber: a narrow yellow half-timbered house with a steep",
    "red-tiled roof and green shutters stands where two cobblestone lanes fork; behind it on the left a tall stone gate tower",
    "with a clock and a pointed roof, and down the right lane a lower stone gate tower; pastel half-timbered houses",
    "with flower boxes full of red geraniums line both lanes; an old lantern on a wall.",
    "Bright sunny morning light, blue-sky daylight feeling.",
    "In the front there is a small open cobblestone plaza.",
    "IMPORTANT: leave four clear, empty spots on the cobblestones of the front plaza (left-back, right-back, left-front, right-front)",
    "where seated characters on benches will be added later. There are NO benches, NO chairs, NO stools at those spots.",
    ...共通,
  ],
  /* 箱根・大涌谷（2026-10-03 配信者）。湯けむりの立つ岩の谷と、とがった山。看板は文字なし */
  owakudani: [
    "Isometric diorama of a small piece of Owakudani volcanic valley in Hakone, Japan, viewed from above at a 3/4 angle,",
    "a square cut-out block of the landscape floating on a plain background.",
    "Rocky pale yellow-gray volcanic slopes with several white steam vents and soft clouds of sulfur steam rising,",
    "a jagged mountain peak with dry brown and green bushes behind, a calm blue sky with soft white clouds feeling.",
    "A walking path paved with flat stones and a few stone steps, lined with low wooden posts connected by rope,",
    "a small wooden signboard frame WITHOUT any letters, a few large rounded boulders.",
    "Bright, clear daytime, peaceful and fresh mountain air.",
    "In the front there is a flat open stone-paved viewing terrace.",
    "IMPORTANT: leave four clear, empty spots on the front terrace (left-back, right-back, left-front, right-front)",
    "where seated characters on benches will be added later. There are NO benches, NO chairs, NO stools at those spots.",
    ...共通,
  ],
  /* 箱根・芦ノ湖（2026-10-04 配信者）。湖に立つ赤い鳥居（箱根神社の平和の鳥居）と、湖の向こうの富士山。湖畔の遊歩道 */
  ashinoko: [
    "Isometric diorama of a small piece of the shore of Lake Ashi (Ashinoko) in Hakone, Japan, viewed from above at a 3/4 angle,",
    "a square cut-out block of the landscape floating on a plain background.",
    "Calm blue lake water fills the back half of the block; a bright red Japanese torii gate stands in the water near the shore,",
    "forested green hills of cedar trees around the lake, and the snow-capped Mount Fuji rising softly in the far distance.",
    "A small traditional wooden sightseeing boat floats on the lake (no letters on it).",
    "Along the near shore there is a lakeside promenade paved with flat stones, a low wooden railing at the water's edge,",
    "a few pine trees and stone lanterns, small clusters of hydrangea bushes.",
    "Bright, clear daytime, peaceful and fresh, gentle ripples on the water.",
    "In the front there is a flat open stone-paved lakeside terrace.",
    "IMPORTANT: leave four clear, empty spots on the front terrace (left-back, right-back, left-front, right-front)",
    "where seated characters on benches will be added later. There are NO benches, NO chairs, NO stools at those spots.",
    ...共通,
  ],
  /* 神保町のようなカフェ（2026-09-27 に作った。いまはしまってある） */
  cafe: [
    "Isometric cutaway diorama of a single room, viewed from above at a 3/4 angle:",
    "two back walls meeting at the far corner, a square floor seen as a diamond, the room floating on a plain background.",
    "The room is a small, BRIGHT medieval European cafe: whitewashed plaster walls with dark timber beams,",
    "stone and warm wooden plank floor, tall arched windows with daylight pouring in,",
    "it feels like an old book-town cafe (like the used-bookstore district of Jimbocho, Tokyo): shelves crowded with old second-hand books,",
    "small piles of well-read books stacked on the floor and window sills, a wooden counter with coffee cups and ceramic jugs,",
    "an unlit wrought-iron candle chandelier, potted herbs and flowers, a small woven rug.",
    "In the middle of the floor there are one or two round wooden tables with a teapot and cups.",
    "IMPORTANT: leave four clear, empty spots on the floor around the tables (left-back, right-back, left-front, right-front)",
    "where seated characters will be added later. There are NO chairs, NO stools, NO benches at those spots.",
    ...共通,
  ],
};

/* 空のベンチ。アバターの座るもの（functions/index.js の ベンチ）と言い方をそろえる。
   ⚠️ アバターと同じ角度・同じ向き（前向きは右前、後ろ向きは右奥）で描かせる。左の席では画面で反転する */
const ベンチ =
  "a small wooden park bench with a backrest and simple dark iron legs, just wide enough for one person";
const ベンチの画風 =
  "Blocky voxel style in the style of Minecraft: built from cubes, with flat pixel-art textures, simple and cute. " +
  "Clean 3D render, soft even lighting, isometric three-quarter view from slightly above. " +
  "Fully transparent background. No text, no floor, no shadow on the ground, no people, no other objects.";
const ベンチら = {
  front: `A single empty ${ベンチ}. The bench faces toward the front-right (we see its seat and the front of the backrest). ${ベンチの画風}`,
  back:  `A single empty ${ベンチ}, seen from BEHIND: we see the back of the backrest, and the bench faces toward the upper-right (back-right). ${ベンチの画風}`,
};

const 部屋 = process.argv[2];
const 枚数 = Math.min(4, Math.max(1, Number(process.argv[3]) || 2));
const モデル = process.env.IMAGE_MODEL || "gpt-image-1";

/* ── 3つのやり方（新しく作る・広げる・空のベンチ）で同じ道具 ── */
// 鍵は Secret Manager から読み、そのまま API へ渡すだけ（ファイルにも画面にも出さない）
const 鍵を読む = () => execSync("firebase functions:secrets:access OPENAI_API_KEY --project gemu-dokusho",
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const 時刻 = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const 置き場 = join(ここ, "下書き");
// OpenAI に頼んで、返ってきた絵（b64）の並びを返す。うまくいかなければ止める
async function 頼む(道, 中身, json = true){
  const r = await fetch(`https://api.openai.com/v1/images/${道}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${鍵を読む()}`, ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(中身) : 中身,
  });
  const j = await r.json();
  if(!r.ok){ console.error("作れませんでした：", j?.error?.message || r.status); process.exit(1); }
  return j.data.map(d => Buffer.from(d.b64_json, "base64"));
}
// 04_tools/下書き/ に PNG と WebP で置く。整え は WebP にする前の sharp の処理（空のベンチは 640px に縮める）
async function 下書きに置く(png, 名, 整え = x => x.webp({ quality: 86 })){
  mkdirSync(置き場, { recursive: true });
  writeFileSync(join(置き場, 名 + ".png"), png);
  await 整え(sharp(png)).toFile(join(置き場, 名 + ".webp"));
  console.log("できました：", join("04_tools", "下書き", 名 + ".webp"));
}

/* ── 広げる：いまの絵の構図はそのままに、ベンチを置く広場だけを広げる（2026-10-04 配信者「ベンチの位置が近すぎるので、
   もう少しゆとりをもって配置できるように、ベンチを置くスペースを広げたい」）。
     node 04_tools/部屋を作る.mjs owakudani 2 --広げる
   いまの public/部屋/{部屋}.webp を OpenAI の images/edits に渡し、広場のことだけを頼む。
   ⚠️ 手直しすると、全体の色が少し黄色寄りになる（2026-10-04 に大涌谷と芦ノ湖でそうなった） */
const 広げ方 = {
  owakudani: "the flat stone-paved viewing terrace in the front",
  ashinoko: "the flat stone-paved lakeside terrace in the front",
};
if(process.argv.includes("--広げる")){
  if(!広げ方[部屋]){ console.error(`広げられる場所：${Object.keys(広げ方).join(" / ")}（足すときは 広げ方 に広場の言い方を書く）`); process.exit(1); }
  const 元 = await sharp(join(ここ, "../public/部屋", `${部屋}.webp`)).png().toBuffer();
  const 指示 = [
    "Edit this isometric diorama illustration.",
    "Keep the SAME overall composition, camera angle, art style, colors, lighting and every existing landmark and object exactly as they are.",
    `ONLY change one thing: make ${広げ方[部屋]} clearly larger — about twice its current area —`,
    "extending it wider to the left and right and a little deeper toward the viewer, so that four small two-person benches",
    "could later be placed on it with generous empty space between them. The diorama block may become slightly larger to fit it.",
    "Keep the terrace completely EMPTY: no benches, no chairs, no stools, no people, no animals, no text.",
  ].join(" ");
  const 書式 = new FormData();
  書式.append("model", モデル);
  書式.append("image", new Blob([元], { type: "image/png" }), `${部屋}.png`);
  書式.append("prompt", 指示);
  書式.append("n", String(枚数));
  書式.append("size", "1536x1024");
  書式.append("quality", "high");
  console.log(`${部屋} の広場を広げた絵を ${枚数} 枚作ります（1〜3分）…`);
  for(const [i, png] of (await 頼む("edits", 書式, false)).entries()) await 下書きに置く(png, `${部屋}_広げた_${時刻}_${i + 1}`);
  process.exit(0);
}

/* ── 空のベンチ（前向き・後ろ向き）。アバターと同じく 640px の WebP にする（場所の絵で同じ大きさに並べるため） ── */
if(部屋 === "bench"){
  for(const [向き, 指示] of Object.entries(ベンチら)){
    const [png] = await 頼む("generations", { model: モデル, prompt: 指示, n: 1,
      size: "1024x1024", quality: "medium", background: "transparent", output_format: "png" });
    await 下書きに置く(png, `bench_${向き}_${時刻}`, x => x.resize(640, 640, { fit: "inside" }).webp({ quality: 88, alphaQuality: 100 }));
  }
  process.exit(0);
}

/* ── 場所の絵を新しく作る ── */
if(!指示ら[部屋]){
  console.error(`場所の名前を付けてください：${Object.keys(指示ら).join(" / ")} / bench`);
  process.exit(1);
}
console.log(`${部屋} を ${モデル} で ${枚数} 枚作ります（1〜2分）…`);
const 絵ら = await 頼む("generations", { model: モデル, prompt: 指示ら[部屋].join(" "), n: 枚数, size: "1536x1024", quality: "high" });
for(const [i, png] of 絵ら.entries()) await 下書きに置く(png, `${部屋}_${時刻}_${i + 1}`);
