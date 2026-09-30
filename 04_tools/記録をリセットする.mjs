/* ============================================================
   記録をリセットする（2026-09-30 配信者「一度、リセットをお願いします」→ 二人分の記録を全部）

     node 04_tools/記録をリセットする.mjs --下見     ← 何件消えるかを数えるだけ
     node 04_tools/記録をリセットする.mjs --消す     ← 本当に消す（元に戻せない）

   消すもの：logs（読んだ時間）と finishes（読了の印＝冊数・ページ数）。**全員分**
   残すもの：users（名前・アバター）・books（本棚・申請）・rooms（いま座っている席）・admins・
            shares（X に投稿した記録ページ。消すと、X の投稿の絵が出なくなる）

   ⚠️ 鍵は ~/.gemu-dokusho/鍵.json（管理者にする.mjs と同じ）。中身を画面に出さない
   ============================================================ */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

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

const 消す = process.argv.includes("--消す");
if(!消す && !process.argv.includes("--下見")){
  console.error("× --下見 か --消す を付けてください"); process.exit(1);
}

for(const 名 of ["logs", "finishes"]){
  const s = await db.collection(名).get();
  console.log(`${名}：${s.size}件`);
  if(!消す) continue;
  for(let i = 0; i < s.docs.length; i += 400){
    const b = db.batch();
    s.docs.slice(i, i + 400).forEach(d => b.delete(d.ref));
    await b.commit();
  }
  console.log(`  → ${s.size}件を消しました`);
}
if(!消す) console.log("（下見です。消すときは --消す）");
process.exit(0);
