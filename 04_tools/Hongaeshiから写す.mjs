/* ============================================================
   Hongaeshi（本返し）の本棚を、GEMu の本棚に写す（2026-09-29 配信者）

   使い方（リポジトリの一番上で）：
     node 04_tools/Hongaeshiから写す.mjs
   → public/本棚.json を書き直す。そのあと hosting を上げる

   ・Hongaeshi の books は**だれでも読める**決まりなので、鍵を使わずに公開の入口（Firestore の REST）から読む
   ・写すのは**書誌**（書名・副題・著者・出版社・ISBN・ページ数・刊行年）と、Amazon の ASIN（表紙とリンクのため）。
     紹介文（AI が作った文）は写さない。
     ⚠️ 2026-10-04 に「Amazon のリンクは写さない」を改めた（配信者「本も表紙を小さく出したい。Hongaeshi のように Amazon のリンクを」）。
        写すのは ASIN だけ。リンク（タグ付き）と表紙の URL は、画面が 書誌.js の Amazonの道 で作る
   ・public が false の本は写さない
   ⚠️ GEMu の Firestore には書かない（こちらの管理用の鍵が無いため）。画面が public/本棚.json を
      **本登録の本**として一覧に混ぜる（土台.js の 本らを読む）。id は "h-{Hongaeshi の id}"
   ============================================================ */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ここ = dirname(fileURLToPath(import.meta.url));
const 値 = f => f == null ? null
  : "stringValue" in f ? f.stringValue
  : "integerValue" in f ? Number(f.integerValue)
  : "booleanValue" in f ? f.booleanValue
  : null;

/* Hongaeshi にページ数が無かった本の補い（2026-09-29 に調べた）。写し直しても消えないように、ここに持つ */
const ページの補い = {
  "9784990428808": 40,    // カチカチ山（パブリック・ブレイン）… 出版社のページ「40ページ／絵本」
  "9784591010136": 208,   // それいけズッコケ三人組（ポプラ社文庫）… 絵本ナビ 208ページ（202 とする書店もある）
  "9784003355022": 362,   // レオナルド・ダ・ヴィンチの手記 下（岩波文庫）… 岩波書店のページ 362頁
};

// Hongaeshi の amazonLinks（配列）か、古い形の amazonUrl から ASIN を取り出す
const ASINを取る = f => {
  const url = f.amazonLinks?.arrayValue?.values?.[0]?.mapValue?.fields?.url?.stringValue || 値(f.amazonUrl) || "";
  const m = url.match(/\/(?:dp|gp\/product|ASIN)\/([0-9A-Za-z]{10})/);
  return m ? m[1].toUpperCase() : "";
};

const 本ら = [];
let tok = "";
do {
  const u = "https://firestore.googleapis.com/v1/projects/hongaeshi/databases/(default)/documents/books?pageSize=300"
    + (tok ? "&pageToken=" + tok : "");
  const j = await (await fetch(u)).json();
  if(j.error){ console.error("読めませんでした：", j.error.message); process.exit(1); }
  本ら.push(...(j.documents || []));
  tok = j.nextPageToken || "";
} while (tok);

const 棚 = 本ら
  .filter(d => 値(d.fields?.public) !== false)
  .map(d => {
    const f = d.fields || {};
    return {
      id: "h-" + d.name.split("/").pop(),
      題: 値(f.title) || "",
      副題: 値(f.subtitle) || "",
      著: 値(f.authorText) || "",
      版元: 値(f.publisherText) || "",
      isbn: 値(f.isbn) || "",
      ページ: 値(f.pages) || ページの補い[値(f.isbn)] || 0,
      年: 値(f.year) || null,
      asin: ASINを取る(f),
    };
  })
  .filter(b => b.題)
  .sort((a, b) => a.題.localeCompare(b.題, "ja"));

writeFileSync(join(ここ, "../public/本棚.json"), JSON.stringify({
  写した日: new Date().toISOString().slice(0, 10),
  出どころ: "Hongaeshi（本返し）の本棚",
  本: 棚,
}, null, 1) + "\n");
console.log(`${棚.length} 冊を public/本棚.json に写しました（Hongaeshi の本は ${本ら.length} 冊）`);
