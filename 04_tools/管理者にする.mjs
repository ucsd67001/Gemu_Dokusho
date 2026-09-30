/* ============================================================
   管理者にする ― admins に uid を入れる／外す（Hongaeshi の 04_tools/管理者にする.mjs と同じ。2026-09-30）

     node 04_tools/管理者にする.mjs                 ← いまの管理者を並べる
     node 04_tools/管理者にする.mjs <uid> [名前]     ← 管理者にする
     node 04_tools/管理者にする.mjs --外す <uid>     ← 管理者をやめさせる

   ⚠️ **admins コレクションはルールで書き込み禁止にしてある。**
      管理者を増やせるのは、この道具（Admin SDK）からだけ。
      画面から管理者を増やせるようにすると、「管理者が自分で管理者を作れる」入口ができてしまう。

   ⚠️ 鍵（サービスアカウント）は **~/.gemu-dokusho/鍵.json**（リポジトリの外）。
      別の場所なら、環境変数 GEMU_DOKUSHO_KEY に場所を入れる。**鍵の中身を画面に出さない**
   ⚠️ uid は Firebase コンソールの Authentication で分かる。**リポジトリに uid やメールを書かない**
   ============================================================ */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// firebase-admin は functions に入っているものを借りる
const 借りる = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../functions/package.json"));
const { initializeApp, cert } = 借りる("firebase-admin/app");
const { getFirestore } = 借りる("firebase-admin/firestore");

const 鍵の場所 = process.env.GEMU_DOKUSHO_KEY || join(homedir(), ".gemu-dokusho", "鍵.json");
let 鍵;
try{ 鍵 = JSON.parse(readFileSync(鍵の場所, "utf8")); }
catch(e){ console.error(`× 鍵が読めません：${鍵の場所}`); process.exit(1); }
if(鍵.project_id !== "gemu-dokusho"){ console.error("× gemu-dokusho の鍵ではありません"); process.exit(1); }
initializeApp({ credential: cert(鍵) });
const db = getFirestore();

const 引数 = process.argv.slice(2);

if(!引数.length){
  const s = await db.collection("admins").get();
  console.log(`管理者 ${s.size}人`);
  s.docs.forEach(d=>console.log(`  ${d.id}  ${d.data().name || ""}`));
  process.exit(0);
}

if(引数[0] === "--外す"){
  const uid = 引数[1];
  if(!uid){ console.error("× uid を指定してください。"); process.exit(1); }
  await db.collection("admins").doc(uid).delete();
  console.log(`✓ ${uid} を管理者から外しました。`);
  process.exit(0);
}

const [uid, 名前] = 引数;
await db.collection("admins").doc(uid).set({
  name: 名前 || "", addedAt: new Date().toISOString()
});
console.log(`✓ ${uid} を管理者にしました。${名前 ? `（${名前}）` : ""}`);
process.exit(0);
