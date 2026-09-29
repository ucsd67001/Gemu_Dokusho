/* ============================================================
   Hongaeshi（本返し）の本棚を、GEMu の本棚に写す（2026-09-29 配信者）

   使い方（リポジトリの一番上で）：
     node 04_tools/Hongaeshiから写す.mjs
   → public/本棚.json を書き直す。そのあと hosting を上げる

   ・Hongaeshi の books は**だれでも読める**決まりなので、鍵を使わずに公開の入口（Firestore の REST）から読む
   ・写すのは**書誌だけ**（書名・副題・著者・出版社・ISBN・ページ数・刊行年）。
     紹介文（AI が作った文）と Amazon のリンク（Hongaeshi のアフィリエイトのタグ付き）は写さない
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
