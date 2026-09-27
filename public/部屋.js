/* ============================================================
   部屋

   ⚠️ いまは「カフェ」1つだけ。増やすときはここに1つ足し、
      firestore.rules の rooms の席番号（'0'〜'3'）もそろえる。

   席の座標は、絵の上の点（左上からの %）。**人の足もと（椅子の脚）をそこに合わせる。**
     x, y   … 足もとの点（横 %・縦 %）
     幅     … 人の絵の幅（絵の横幅に対する割合、%）
     向き   … "右"＝絵のまま（右前を向く）／"左"＝左右を反転する
   ⚠️ 人の絵は「右前を向いて座る」で作っている（functions/index.js の 画風）。
      左を向かせたい席は、作り直さずに反転で済ませる。

   ⚠️ 本物の絵（public/部屋/cafe.webp）を作ったら、絵: にその道を書き、
      **席の点を絵を見て測り直す。**仮の絵と本物では、椅子の場所が違う。
   ============================================================ */

export const 部屋ら = {
  cafe: {
    名: "カフェ",
    英字: "Cafe",
    添え: "明るい中世の町かどの、古本に囲まれた小さなカフェ。だれも話さず、それぞれの本を読んでいる。",
    // 2026-09-27 に 04_tools/部屋を作る.mjs で作った案1（配信者が選んだ）。1536×1024
    絵: "/部屋/cafe.webp",
    比: "3 / 2",
    席: [
      { x: 30,   y: 71, 幅: 12, 向き: "右" },   // 奥の左（本の山の前）
      { x: 57.5, y: 71, 幅: 12, 向き: "左" },   // 奥の右（カウンターの前）
      { x: 42.5, y: 86, 幅: 13, 向き: "右" },   // 手前の左
      { x: 70,   y: 77, 幅: 13, 向き: "左" },   // 手前の右（敷物の右）
    ],
  },
};

export function 部屋の絵(部屋){
  return 部屋.絵 || 仮のカフェ;
}

/* ── 仮のカフェ ─────────────────────────────
   本物の絵ができるまでの下絵。斜め上から見た部屋（床はひし形、奥に壁が2枚）。
   ⚠️ 壁と床は、それぞれの面の座標で描いて matrix で斜めに貼っている。
      右の壁：(u,v) → (800+u, v+u/2)   左の壁：(u,v) → (220+u, 290+v-u/2)
      床：(p,q)（0〜1）→ (800+580(p−q), 380+290(p+q)) */
// ⚠️ vector-effect は子に受け継がれない。線ごとに付けないと、倍率（580）で太って床の外まで塗る
const 板目 = Array.from({ length: 9 }, (_, i) =>
  `<line x1="${(i + 1) / 10}" y1="0" x2="${(i + 1) / 10}" y2="1" vector-effect="non-scaling-stroke"/>`).join("");
const 棚の本 = Array.from({ length: 3 }, (_, 段) =>
  Array.from({ length: 7 }, (_, i) => {
    const 色 = ["#a4553d", "#3f6f8f", "#c9a24a", "#5f7f4f", "#8e5a8a", "#b7773f", "#46607f"][(i + 段 * 3) % 7];
    return `<rect x="${344 + i * 17}" y="${188 + 段 * 62}" width="13" height="${44 - (i % 3) * 5}" fill="${色}"/>`;
  }).join("")).join("");

const 絵のSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <defs>
    <linearGradient id="空" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#bfe0f5"/><stop offset="1" stop-color="#f6ecd2"/>
    </linearGradient>
    <radialGradient id="陽" cx=".62" cy=".55" r=".55">
      <stop offset="0" stop-color="#fff6dd" stop-opacity=".75"/><stop offset="1" stop-color="#fff6dd" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="#f3ede4"/>

  <!-- 床の厚み -->
  <polygon points="220,670 800,960 1380,670 1380,700 800,990 220,700" fill="#8a6446"/>
  <!-- 床：明るい板張り -->
  <g transform="matrix(580,290,-580,290,800,380)">
    <rect width="1" height="1" fill="#d9b88f"/>
    <g stroke="#c29a6c" stroke-width="1.2">${板目}</g>
  </g>
  <!-- 敷物 -->
  <g transform="matrix(580,290,-580,290,800,380)">
    <ellipse cx=".5" cy=".5" rx=".3" ry=".3" fill="#c7704f" opacity=".85"/>
    <ellipse cx=".5" cy=".5" rx=".26" ry=".26" fill="none" stroke="#f1d7a8" stroke-width="2" vector-effect="non-scaling-stroke"/>
  </g>

  <!-- 左の壁：漆喰と木の梁、本棚 -->
  <g transform="matrix(1,-0.5,0,1,220,290)">
    <rect width="580" height="380" fill="#f4ead8"/>
    <rect y="0" width="580" height="22" fill="#9a6a45"/>
    <rect y="340" width="580" height="40" fill="#b88a62"/>
    <rect x="0" width="18" height="380" fill="#9a6a45"/>
    <rect x="280" width="16" height="340" fill="#9a6a45"/>
    <rect x="330" y="170" width="140" height="210" fill="#7a5238"/>
    <rect x="336" y="176" width="128" height="198" fill="#5e3e2a"/>
    ${棚の本}
    <rect x="80" y="120" width="120" height="84" fill="#e9dcc4" stroke="#9a6a45" stroke-width="6"/>
    <path d="M100 190 q20 -40 40 -10 q20 -30 40 10" fill="none" stroke="#7d9a6a" stroke-width="5"/>
  </g>

  <!-- 右の壁：アーチの窓から外の光 -->
  <g transform="matrix(1,0.5,0,1,800,0)">
    <rect width="580" height="380" fill="#f7eedf"/>
    <rect y="0" width="580" height="22" fill="#9a6a45"/>
    <rect y="340" width="580" height="40" fill="#b88a62"/>
    <rect x="562" width="18" height="380" fill="#9a6a45"/>
    <g>
      <path d="M90 270 V140 A60 60 0 0 1 210 140 V270 Z" fill="#8f6a4c"/>
      <path d="M100 262 V142 A50 50 0 0 1 200 142 V262 Z" fill="url(#空)"/>
      <path d="M150 92 V262 M100 190 H200" stroke="#8f6a4c" stroke-width="6"/>
    </g>
    <g>
      <path d="M330 270 V140 A60 60 0 0 1 450 140 V270 Z" fill="#8f6a4c"/>
      <path d="M340 262 V142 A50 50 0 0 1 440 142 V262 Z" fill="url(#空)"/>
      <path d="M390 92 V262 M340 190 H440" stroke="#8f6a4c" stroke-width="6"/>
    </g>
    <rect x="80" y="270" width="140" height="12" fill="#9a6a45"/>
    <rect x="320" y="270" width="140" height="12" fill="#9a6a45"/>
  </g>

  <!-- 窓から床へ落ちる光 -->
  <rect width="1600" height="1000" fill="url(#陽)"/>

  <!-- 丸いテーブル -->
  <g>
    <rect x="788" y="660" width="24" height="70" fill="#6e4a33"/>
    <ellipse cx="800" cy="732" rx="46" ry="16" fill="#6e4a33"/>
    <ellipse cx="800" cy="662" rx="120" ry="60" fill="#8c5e3e"/>
    <ellipse cx="800" cy="654" rx="120" ry="60" fill="#b07c52"/>
    <rect x="770" y="630" width="26" height="22" rx="3" fill="#f5efe3"/>
    <ellipse cx="783" cy="630" rx="13" ry="5" fill="#6b4630"/>
    <rect x="818" y="644" width="44" height="12" fill="#3f6f8f" transform="rotate(-8 840 650)"/>
  </g>

  <!-- 鉢植え -->
  <g transform="translate(1250 600)">
    <path d="M-26 0 L26 0 L20 44 L-20 44 Z" fill="#b8663f"/>
    <ellipse cx="0" cy="-26" rx="44" ry="36" fill="#6f9a5a"/>
    <ellipse cx="-18" cy="-44" rx="24" ry="22" fill="#86b06c"/>
  </g>
</svg>`;

const 仮のカフェ = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(絵のSVG);
