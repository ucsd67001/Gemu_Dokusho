/* ============================================================
   GEMuの静かな読書会 ― 裏の処理

   いまあるのは8つ：
     makeAvatar  写真から、ブロック風のアバターを3枚作る
                 ① ベンチごと座って本を読むアバター（sit）……顔がこちらを向く席で使う
                 ② 同じアバターで、ページをめくっているところ（turn）
                 ③ 顔のアイコン（face）
                 場所の絵では ①と② を交互に出して、読んでいるように見せる
                 ⚠️ 2026-10-10 配信者：④ 後ろから見たアバター（back）は**作らない**ことにした。
                    背中を使うのは「手前の席」（背中がこちらを向く席）だけで、いまの場所（ローテンブルク・大涌谷・芦ノ湖）には無い。
                    使われない絵に料金の約4分の1を払っていた。手前の席のある場所を足すときは、addBack と画面の「背中を足す」を戻す
     addBack     ④ だけを足す（いまは画面から呼ばない。手前の席のある場所を足すときのために残す）
     detectFacing  できているアバター（座る絵）が、左右どちらを向いているかを見て記録する
                   （向きを記録する前に作ったアバターのため。画面が一度だけ呼ぶ）
     borrowImages  アバターの絵を data URL で返す（読み終えたときの X 用の絵を、画面の canvas で描くため）
     sharePage     読書の記録ページ /s/{id}。X がリンクから絵（og:image）を読み取って、投稿に大きく出す
     resolveAmazonLink  Amazon の短縮リンク（amzn.asia など）の飛び先を辿って、商品のリンクを返す（本の申請の入力補助）
     cleanShares   毎日4時（日本）に、作ってから1週間たった読書の記録ページ（shares と、その絵）を消す（2026-10-10 配信者）
     readerStats   「読み方は、人それぞれ」：読了した冊数・読了した本の総ページ数・読んだ時間の、それぞれ上位3人。
                   あわせて「本のランキング」：本ごとの読了の数・読まれたページの数・読まれた時間の、それぞれ上位3冊

   ⚠️⚠️ **写真はどこにも残さない。**受け取って OpenAI に渡すだけ。
      残すのは出来上がった絵（Storage の avatars/{uid}/{版}/）だけ。
   ⚠️ ②③（と④）は、写真からではなく **①から作る。**写真から何回も作ると、
      別人になる（顔も服も毎回変わる）。
   ⚠️ 席の向きは、右向きと左向き。左右は画面で反転して作るので、要るのは「顔の向き」の1枚だけ。
   ⚠️ 座るものごと描かせるのは、背景の椅子に重ねると、向きと高さがずれて浮いて見えるため。
   ⚠️ 座るものは**小さな木のベンチ**（2026-09-27、カフェの椅子から替えた）。場所が観光地の広場・公園・川べりに
      なっても合うように。空いている席に置く空のベンチ（04_tools/部屋を作る.mjs bench）と、言い方をそろえる
   ⚠️⚠️ **「右前を向く」と頼んでも、左を向いて描かれることがある**（2026-09-27、配信者の一枚目がそうだった）。
      → 描いたあとに、左右どちらを向いているかを見る（avatar.facing＝"left"/"right"）。
        場所の絵では、席の向きと違えば左右を反転する。見分けを間違えたら、本人が「自分のページ」で反対にできる（users.flip）。
   ⚠️ 1人1日5回まで、**全員あわせて1日30回まで**（日本の日付で数える）。1回で絵を3枚作り、向きの見分けを1回する。
      ④だけを足す（addBack）のも1回に数える。
      だれでもログインして登録できる形にしたので、全員ぶんの上限が料金の歯止め（meta/usage）。

   鍵：OPENAI_API_KEY は Secret Manager に置く（README「鍵」）。
   ============================================================ */
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

initializeApp();
const db = getFirestore();
// ⚠️ どの処理も東京（asia-northeast1）。firebase.json の sharePage の rewrite も同じ場所を指す
setGlobalOptions({ region: "asia-northeast1" });

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
// ⚠️ 画像のモデルは、新しいものが出たら差し替えられるようにしておく（functions/.env に IMAGE_MODEL=…）
const IMAGE_MODEL = defineString("IMAGE_MODEL", { default: "gpt-image-1" });

const 一日の上限 = 5;          // 1人あたり
const 全員の一日の上限 = 30;   // 全員あわせて
const 写真の上限 = 6 * 1024 * 1024;   // 画面で 1024px の JPEG に縮めてから送るので、ふつうは 0.3MB ほど

/* ── 絵の指示 ──────────────────────────────
   ⚠️ 場所の絵は、どれも斜め上から見たミニチュアの立体（04_tools/部屋を作る.mjs）。
      アバターはそこに置くので、**同じ斜めの角度（右前を向く 3/4）**で描かせる。
      左向きの席では、画面で左右を反転する。 */
/* ⚠️⚠️ **人の写真とは限らない。**キャラクターの絵を上げる人もいる（2026-09-27、二人目の方は黄色いキャラクターの絵で、
      「写真の人」を前提にした指示だったため、眼鏡の人間に描き替えられた）。
      → 「写っているものを、そのままブロックにする」。人なら人、キャラクターならその形・色・表情・持ち物を残す。
        **人でないものを人にしない。**
      ⚠️ 人の姿のキャラクターでも、猫耳・しっぽは落ちやすい（配信者の一枚目。耳が目立たず、しっぽが消えた）。名指しで残させる */
const 画風 =
  "Blocky voxel style in the style of Minecraft: built from cubes, with flat pixel-art textures, simple and cute. " +
  "Clean 3D render, soft even lighting, " +
  "isometric view from slightly above. The character and its seat are turned 45 degrees: " +
  "it faces DIAGONALLY toward the lower-right corner of the image, not straight at the viewer " +
  "(we see its face and front in three-quarter view, and its left side). " +
  "Fully transparent background. No text, no floor, no shadow on the ground, no other objects.";

const ベンチ =
  "a small wooden park bench with a backrest and simple dark iron legs, just wide enough for one person";

const 座る指示 =
  "Turn the main subject of this image into a single character in " + 画風 + " " +
  "The subject may be a real person, an illustrated character, a mascot, an animal or a creature. " +
  "Make a blocky voxel version of THAT SAME subject: keep what it is, its overall silhouette and body shape, " +
  "its colors, its facial expression, and its distinctive features and items: animal ears, tail, horns, wings, " +
  "two-tone or unusual hair colors, eye colors, jackets and accessories, and things worn or placed on its head. " +
  "Make these features clearly visible even in blocky form (for example, cat ears as small cubes on top of the head, " +
  "a tail made of blocks). " +
  "If it is a person, keep hair style and color, skin tone, glasses if any, and clothing colors. " +
  "If it is not a human, do NOT turn it into a human; keep it the same kind of character, just made of blocks. " +
  "The character sits on " + ベンチ + " (the bench is part of the image), " +
  "holding an open book and reading it calmly. The whole bench and body fit inside the image.";

const めくる指示 =
  "Keep this exact same character, bench, pose, camera angle, size and position. " +
  "Change only one thing: one hand is turning a page of the open book (a page lifted in mid-turn). " +
  "Fully transparent background. No text.";

const 顔の指示 =
  "Using this exact same character, make a square portrait icon: only its face and the top of its body " +
  "(head and shoulders if it has them), facing the front, centered, filling most of the image. " +
  "Same shape, pixel textures and colors, and keep items on its head. " +
  "Fully transparent background. No book, no bench, no text.";

const 背中の指示 =
  "Keep this exact same character: same blocky body, same hair, same clothes and colors, same ears or tail if any, " +
  "same bench, same size. " +
  "Now show it from BEHIND: the camera looks at the character's back and the back of the bench. " +
  "The character sits facing away from the viewer, turned 45 degrees DIAGONALLY toward the upper-right corner of the image " +
  "(we see its back in three-quarter view, and its left side), " +
  "reading a book held in front of them (the book is mostly hidden by the body). " +
  "Isometric three-quarter view from slightly above, like the original. " +
  "Fully transparent background. No text, no floor, no other objects.";

/* ── 呼び出し ─────────────────────────────── */
export const makeAvatar = onCall({
  secrets: [OPENAI_API_KEY],
  timeoutSeconds: 540,
  memory: "1GiB",
}, async req => {
  const 私 = ログインした人(req);

  const 写真 = 写真をほどく(req.data?.photo);
  const 利用者 = db.doc(`users/${私.uid}`);
  const 全員 = db.doc("meta/usage");

  await 回数を使う(利用者, 全員, "座って読むアバターを描いています（1/3）");

  const 進み = step => 利用者.set({ avatar: { step } }, { merge: true });
  try{
    const ai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const 座る = await 描く(ai, 写真, "photo.jpg", "image/jpeg", 座る指示);
    await 進み("ページをめくるところと顔を描いています（2/3）");
    const 向きの約束 = 向きを見る(ai, 座る, "image/png");
    // ⚠️ 背中（④）は作らない（2026-10-10 配信者。いまの場所に手前の席が無いため。上の説明）
    const [めくる, 顔] = await Promise.all([
      描く(ai, 座る, "sit.png", "image/png", めくる指示),
      描く(ai, 座る, "sit.png", "image/png", 顔の指示),
    ]);
    await 進み("仕上げています（3/3）");

    const 版 = Date.now().toString(36);
    const [sit, turn, face, facing] = await Promise.all([
      置く(私.uid, 版, "sit", 座る, 640),
      置く(私.uid, 版, "turn", めくる, 640),
      置く(私.uid, 版, "face", 顔, 256),
      向きの約束,
    ]);
    await 利用者.set({ avatar: {
      status: "ready", step: FieldValue.delete(), sit, turn, face, facing,
      at: FieldValue.serverTimestamp()
    }, flip: false }, { merge: true });
    await 古い版を消す(私.uid, 版);
    return { ok: true };
  }catch(e){
    console.error(e);
    const 文 = 誤りの言葉(e);
    await 利用者.set({ avatar: { status: "failed", step: FieldValue.delete(), error: 文 } }, { merge: true });
    throw new HttpsError("internal", 文);
  }
});

/* ── 背中だけを足す ─────────────────────────── */
export const addBack = onCall({
  secrets: [OPENAI_API_KEY],
  timeoutSeconds: 300,
  memory: "1GiB",
}, async req => {
  ログインした人(req);
  const 利用者 = db.doc(`users/${req.auth.uid}`);
  const a = (await 利用者.get()).data()?.avatar || {};
  if(!a.sit) throw new HttpsError("failed-precondition", "アバターがまだありません");
  if(a.back) return { ok: true };
  await 回数を使う(利用者, db.doc("meta/usage"), null);
  try{
    const ai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    // ①は WebP で置いてあるので、PNG に戻してから渡す
    const [webp] = await getStorage().bucket().file(a.sit).download();
    const 座る = await sharp(webp).png().toBuffer();
    const 背中 = await 描く(ai, 座る, "sit.png", "image/png", 背中の指示);
    const 版 = a.sit.split("/")[2];   // avatars/{uid}/{版}/sit.webp。同じ版に置く（古い版を消すときに残るように）
    const [back, backFacing] = await Promise.all([
      置く(req.auth.uid, 版, "back", 背中, 640),
      向きを見る(ai, 背中, "image/png", { 背中: true }),
    ]);
    await 利用者.set({ avatar: { back, backFacing } }, { merge: true });
    return { ok: true };
  }catch(e){
    console.error(e);
    throw new HttpsError("internal", 誤りの言葉(e));
  }
});

/* 回数と、作っている最中かを1つのトランザクションで見る（二度押しで2回走らせない）。
   段階 を渡すと「作っている」にする（makeAvatar）。null なら数えるだけ（addBack） */
async function 回数を使う(利用者, 全員, 段階){
  const 今日 = 日本の日付();
  await db.runTransaction(async tx => {
    const [s, u] = await Promise.all([tx.get(利用者), tx.get(全員)]);
    if(!s.exists) throw new HttpsError("failed-precondition", "先にユーザ名を決めてください");
    const a = s.data().avatar || {};
    const 最中 = a.status === "making" && a.at && Date.now() - a.at.toMillis() < 10 * 60 * 1000;
    if(最中) throw new HttpsError("already-exists", "いま作っているところです");
    const 回 = a.day === 今日 ? (a.count || 0) : 0;
    if(回 >= 一日の上限)
      throw new HttpsError("resource-exhausted", `アバターを作れるのは1日${一日の上限}回までです`);
    const 全員の回 = u.exists && u.data().day === 今日 ? (u.data().count || 0) : 0;
    if(全員の回 >= 全員の一日の上限)
      throw new HttpsError("resource-exhausted", "今日はアバターを作れる回数が終わりました。明日また試してください");
    tx.set(全員, { day: 今日, count: 全員の回 + 1 });
    tx.set(利用者, { avatar: 段階 ? {
      ...a, status: "making", step: 段階,
      back: FieldValue.delete(), backFacing: FieldValue.delete(),   // 作り直すと古い版は消えるので、道も消す
      error: FieldValue.delete(), at: FieldValue.serverTimestamp(), day: 今日, count: 回 + 1
    } : { day: 今日, count: 回 + 1 }}, { merge: true });
  });
}

/* ── 向きを確かめる ─────────────────────────── */
export const detectFacing = onCall({
  secrets: [OPENAI_API_KEY],
  timeoutSeconds: 60,
}, async req => {
  ログインした人(req);
  const 利用者 = db.doc(`users/${req.auth.uid}`);
  const a = (await 利用者.get()).data()?.avatar || {};
  if(!a.sit) throw new HttpsError("failed-precondition", "アバターがまだありません");
  if(a.facing) return { facing: a.facing };
  const [絵] = await getStorage().bucket().file(a.sit).download();
  const facing = await 向きを見る(new OpenAI({ apiKey: OPENAI_API_KEY.value() }), 絵, "image/webp");
  await 利用者.set({ avatar: { facing } }, { merge: true });
  return { facing };
});

/* 座っているアバターが、見る人から見て左右どちらを向いているか（背中：true なら、後ろから見た絵が左上と右上のどちらへ向くか）。
   ⚠️ 見分けられなかったら "right"（頼んだ向き）にする。間違えていたら本人が「自分のページ」で反対にできる */
const 向きの問い = {
  顔: "This image shows a blocky character sitting on a bench or chair. From the viewer's point of view, " +
      "is the character's face and body turned toward the LEFT side or the RIGHT side of the image? " +
      "Answer with exactly one word: left or right.",
  背中: "This image shows a blocky character sitting on a bench or chair, seen from behind (facing away from the viewer). " +
      "Is the character facing toward the upper-LEFT or the upper-RIGHT of the image? " +
      "Answer with exactly one word: left or right.",
};
async function 向きを見る(ai, 絵, 型, { 背中 = false } = {}){
  try{
    const r = await ai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 3,
      messages: [{ role: "user", content: [
        { type: "text", text: 背中 ? 向きの問い.背中 : 向きの問い.顔 },
        { type: "image_url", image_url: { url: `data:${型};base64,${絵.toString("base64")}`, detail: "low" } },
      ]}],
    });
    return /left/i.test(r.choices?.[0]?.message?.content || "") ? "left" : "right";
  }catch(e){
    console.error("向きを見られませんでした", e);
    return "right";
  }
}

/* ── X に投稿する絵のため ─────────────────────────
   ⚠️ Storage の絵を画面の canvas に描くと、別の場所（firebasestorage）の絵なので canvas が「汚れ」、
      書き出せなくなる（バケットの CORS を開ければ済むが、その設定を持ち込みたくない）。
      → 裏の処理が読んで data URL で返す。**アバターの絵だけ**（avatars/ の下の決まった名前だけ）、一度に12枚まで */
export const borrowImages = onCall({}, async req => {
  ログインした人(req);
  const 道ら = Array.isArray(req.data?.paths) ? [...new Set(req.data.paths)].slice(0, 12) : [];
  const 形 = /^avatars\/[A-Za-z0-9_-]+\/[a-z0-9]+\/(sit|turn|back|face)\.webp$/;
  const 返す = {};
  await Promise.all(道ら.filter(d => 形.test(d)).map(async 道 => {
    try{
      const [buf] = await getStorage().bucket().file(道).download();
      返す[道] = "data:image/webp;base64," + buf.toString("base64");
    }catch(e){ /* 消えた版など。描かないだけ */ }
  }));
  return { images: 返す };
});

/* 読書の記録ページ。firebase.json の rewrites で /s/** がここに来る。
   ⚠️ 中身は shares/{id}（画面が書く）。絵は Storage の shares/{uid}/{id}.jpg（だれでも読める）。
   ⚠️ 人が開いたら、そのまま絵と一言を出し、トップへの道を置く */
export const sharePage = onRequest({}, async (req, res) => {
  const id = (req.path.match(/^\/s\/([A-Za-z0-9]{10,40})\/?$/) || [])[1];
  const d = id ? (await db.doc(`shares/${id}`).get()).data() : null;
  if(!d){ res.redirect(302, "/"); return; }
  const 逃 = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  // 時間は画面と同じ「2時間5分」の形（2026-10-04 にそろえた）。⚠️ public/画面/共通.js の 時間に の写し。片方を変えたら両方
  const 分 = Number(d.minutes) || 0;
  const 時間 = 分 < 60 ? `${分}分` : `${Math.floor(分 / 60)}時間${分 % 60 ? (分 % 60) + "分" : ""}`;
  const 題 = d.title ? `『${d.title}』を${時間}、${d.place}のベンチで読みました`
    : `${d.place}のベンチで、${時間}読みました`;   // 書籍名を出さなかった人
  const 説明 = "家にいながら、景色のいい場所で読む。GEMuの静かな読書会";
  // Hosting から回ってくると、hostname は裏の処理の名前になる。元の名前は x-forwarded-host
  const ここ = `https://${req.get("x-forwarded-host") || req.hostname}/s/${id}`;
  res.set("Cache-Control", "public, max-age=300, s-maxage=86400");
  res.send(`<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${逃(題)} ― GEMuの静かな読書会</title>
<meta name="description" content="${逃(説明)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${逃(ここ)}">
<!-- ⚠️ X は og:title を絵の下に黒い帯で重ねて出す（消せない）。書名と時間は絵と本文に入っているので、題名は短く（2026-09-27 配信者） -->
<meta property="og:title" content="GEMuの静かな読書会">
<meta property="og:description" content="${逃(説明)}">
<meta property="og:image" content="${逃(d.image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="GEMuの静かな読書会">
<meta name="twitter:description" content="${逃(説明)}">
<meta name="twitter:image" content="${逃(d.image)}">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<style>body{margin:0;background:#f8f6fc;color:#17141f;font-family:"Hiragino Mincho ProN","Yu Mincho",serif;line-height:1.9}
main{width:min(1080px,100% - 32px);margin:40px auto}img{width:100%;border:1px solid rgba(38,28,66,.13);border-radius:2px}
p{margin:18px 0 0}a{color:#513397}</style></head>
<body><main><img src="${逃(d.image)}" alt="${逃(題)}"><p>${逃(題)}</p>
<p><a href="/">GEMuの静かな読書会</a> ― 家にいながら、景色のいい場所で読む。</p></main></body></html>`);
});

/* ── 読書の記録ページを1週間で消す ─────────────────────
   2026-10-10 配信者「X の記録ページは、例えば、1週間たったら消す、みたいにしたい」。
   消したあとに X の投稿のリンクを開くと、sharePage がトップへ移す（記録が無いとき）。X が控えている絵は、しばらく出ることがある。
   ⚠️ 画面の「読み終える」の注にも「1週間で消えます」と書いてある（画面/読み終える.js） */
export const cleanShares = onSchedule({ schedule: "every day 04:00", timeZone: "Asia/Tokyo" }, async () => {
  const 境 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const 古い = await db.collection("shares").where("created", "<", 境).get();
  await Promise.all(古い.docs.map(async d => {
    const x = d.data();
    await getStorage().bucket().file(`shares/${x.uid}/${d.id}.jpg`).delete().catch(() => {});   // 絵が先に消えていても続ける
    await d.ref.delete();
  }));
  console.log(`読書の記録ページを ${古い.size} 件消しました`);
});

/* ── Amazon の短縮リンクを辿る ─────────────────────
   2026-10-03 配信者「https://amzn.asia/d/… だと検索できない」。短縮リンクはブラウザからは辿れない（CORS）ので、ここで辿る。
   ⚠️ **辿るのは Amazon の短縮リンクだけ**（どこへでも取りに行ける入口にしない）。飛び先も Amazon のときだけ返す。
   ⚠️ HEAD だと 404 が返る。GET で、飛び先（Location）だけを見る。中身は読まない。**リンクは保存しない** */
const 短縮の家 = /^(amzn\.asia|amzn\.to|a\.co|amzn\.com|link\.amazon(\.[a-z.]+)?)$/i;
const Amazonの家 = /^(www\.)?amazon\.(co\.jp|com|jp)$/i;
export const resolveAmazonLink = onCall({ timeoutSeconds: 20 }, async req => {
  ログインした人(req);
  let u;
  try{ u = new URL(String(req.data?.url || "")); }catch{ throw new HttpsError("invalid-argument", "URL が読めません"); }
  if(u.protocol !== "https:" || !短縮の家.test(u.hostname)) throw new HttpsError("invalid-argument", "Amazon の短縮リンクではありません");
  for(let 回 = 0; 回 < 4; 回++){
    const r = await fetch(u, { method: "GET", redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GEMu-dokusho/1.0)" } });
    const 先 = r.headers.get("location");
    if(!先) break;
    u = new URL(先, u);
    if(Amazonの家.test(u.hostname)) return { url: u.origin + u.pathname };
    if(!短縮の家.test(u.hostname)) break;
  }
  throw new HttpsError("not-found", "短縮リンクの飛び先が見つかりませんでした");
});

/* ── 読み方は、人それぞれ ─────────────────────────
   2026-09-29 配信者：競わせはしないが、参考として「冊数が多い人」「ページ数が多い人」「時間が長い人」を出す。
   志向が違う人がいる、と伝えるため。期間は**これまで全部**。
   ⚠️ 記録（logs・finishes）は本人しか読めない決まりのまま。ここで全員分を数え、**上位3人の名前・顔・数だけ**を返す。
   ⚠️ 人数が少ないうちは全部を数え直す。ただし場所の一覧を開くたびに呼ばれるので、同じ入れ物の中では2分のあいだ控えを返す。
      記録が数万件を超えたら、書かれたときに足し込む形（トリガー）に替える
   ⚠️ uid は返さない（画面は名前と顔しか使わない） */
let 読み方の控え = null;   // { 時, 中身 }
export const readerStats = onCall({}, async req => {
  ログインした人(req);
  if(読み方の控え && Date.now() - 読み方の控え.時 < 2 * 60 * 1000) return 読み方の控え.中身;
  const [logs, fins, users] = await Promise.all([
    db.collection("logs").select("uid", "from", "to", "title", "book").get(),
    db.collection("finishes").select("uid", "pages", "title", "book").get(),
    db.collection("users").get(),
  ]);
  const 計 = new Map();
  const 足す = (uid, k, v) => {
    if(!uid) return;
    const x = 計.get(uid) || { books: 0, pages: 0, minutes: 0 };
    x[k] += v;
    計.set(uid, x);
  };
  /* 本のランキング（2026-10-01 配信者）：本を起点に、読了の数・読まれたページの数・読まれた時間。
     本は id（book）でまとめ、id の無い記録は書籍名でまとめる。**だれが読んだかは返さない。**
     ⚠️ 書籍名を出さずに読んだ回（題を出さない印）はどの本か分からないので数えない */
  const 題を出さない印 = "（題を出さずに読んだ本）";   // ⚠️ public/席の決まり.js と同じ文字（画面が記録に書く印）
  const 本の計 = new Map();
  const 本に足す = (x, k, v) => {
    if(!x.title || x.title === 題を出さない印) return;
    const 鍵 = x.book || "t:" + x.title;
    const y = 本の計.get(鍵) || { title: x.title, book: x.book || "", finishes: 0, pages: 0, minutes: 0 };
    y[k] += v;
    本の計.set(鍵, y);
  };
  logs.forEach(d => {
    const x = d.data();
    const ms = (x.to?.toMillis?.() || 0) - (x.from?.toMillis?.() || 0);
    if(ms > 0){ 足す(x.uid, "minutes", ms / 60000); 本に足す(x, "minutes", ms / 60000); }
  });
  fins.forEach(d => {
    const x = d.data();
    足す(x.uid, "books", 1);
    足す(x.uid, "pages", Number(x.pages) || 0);
    本に足す(x, "finishes", 1);
    本に足す(x, "pages", Number(x.pages) || 0);
  });
  const 本の上位 = k => [...本の計.values()].filter(v => Math.round(v[k]) > 0)
    .sort((a, b) => b[k] - a[k]).slice(0, 3)
    .map(v => ({ title: v.title, book: v.book, value: Math.round(v[k]) }));   // book は表紙を出すため（2026-10-04）
  const 人 = new Map(users.docs.map(d => [d.id, d.data()]));
  const 上位 = k => [...計].filter(([uid, v]) => Math.round(v[k]) > 0 && 人.has(uid))
    .sort((a, b) => b[1][k] - a[1][k]).slice(0, 3)
    .map(([uid, v]) => ({ name: 人.get(uid).name || "", face: 人.get(uid).avatar?.face || "", value: Math.round(v[k]) }));
  const 中身 = { books: 上位("books"), pages: 上位("pages"), minutes: 上位("minutes"),
    bookRank: { finishes: 本の上位("finishes"), pages: 本の上位("pages"), minutes: 本の上位("minutes") } };
  読み方の控え = { 時: Date.now(), 中身 };
  return 中身;
});

/* ── 道具 ─────────────────────────────── */
function ログインした人(req){
  if(!req.auth) throw new HttpsError("unauthenticated", "ログインしてください");
  return req.auth;
}

function 写真をほどく(dataUrl){
  const m = typeof dataUrl === "string" && dataUrl.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if(!m) throw new HttpsError("invalid-argument", "写真の形式が読めません");
  const buf = Buffer.from(m[2], "base64");
  if(buf.length > 写真の上限) throw new HttpsError("invalid-argument", "写真が大きすぎます");
  return buf;
}

async function 描く(ai, 元, 名, 型, 指示){
  const 頼み = {
    model: IMAGE_MODEL.value(),
    image: await toFile(元, 名, { type: 型 }),
    prompt: 指示,
    size: "1024x1024",
    quality: "medium",
    background: "transparent",
    output_format: "png",
    input_fidelity: "high",   // 顔と服を元の絵に寄せる
  };
  let r;
  try{
    r = await ai.images.edit(頼み);
  }catch(e){
    // ⚠️ input_fidelity を受け付けないモデルに替えたときのため、外して1回だけやり直す
    if(e?.status === 400 && /input_fidelity/.test(e?.message || "")){
      delete 頼み.input_fidelity;
      頼み.image = await toFile(元, 名, { type: 型 });
      r = await ai.images.edit(頼み);
    }else throw e;
  }
  const b64 = r?.data?.[0]?.b64_json;
  if(!b64) throw new Error("絵が返ってきませんでした");
  return Buffer.from(b64, "base64");
}

// 部屋で何度も読むので、WebP に縮めて置く。透明はそのまま残す
async function 置く(uid, 版, 名, png, 幅){
  const webp = await sharp(png).resize(幅, 幅, { fit: "inside" })
    .webp({ quality: 88, alphaQuality: 100 }).toBuffer();
  const 道 = `avatars/${uid}/${版}/${名}.webp`;
  await getStorage().bucket().file(道).save(webp, {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000, immutable" },
  });
  return 道;
}

async function 古い版を消す(uid, 残す版){
  const [files] = await getStorage().bucket().getFiles({ prefix: `avatars/${uid}/` });
  await Promise.all(files.filter(f => !f.name.startsWith(`avatars/${uid}/${残す版}/`))
    .map(f => f.delete().catch(() => {})));
}

function 日本の日付(){
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/* 画面に出す、うまくいかなかったときの言葉（avatar.error に残り、登録の画面と自分のページに出る）。
   ⚠️ OpenAI の英語の誤りや内部の言葉はそのまま出さない（2026-10-10）。中身は console.error（ログ）で見る */
function 誤りの言葉(e){
  const m = String(e?.message || "");
  if(e?.status === 400 && /safety|moderation|rejected/i.test(m))
    return "この写真では作れませんでした。別の写真で試してください";
  if(e?.status === 429) return "混み合っています。少し待ってから試してください";
  return "アバターを作れませんでした。時間をおいて、もう一度試してください";
}
