/* ============================================================
   GEMuの静かな読書会 ― 裏の処理

   いまあるのは3つ：
     makeAvatar  写真から、ブロック風のアバターを4枚作る
                 ① 椅子ごと座って本を読む姿（sit）……奥の席で使う（顔がこちらを向く）
                 ② 同じ姿で、ページをめくっているところ（turn）
                 ③ 顔のアイコン（face）
                 ④ 同じ人を、後ろから見た姿（back）……手前の席で使う（テーブルに向くと背中がこちらを向く）
                 部屋では ①と② を交互に出して、読んでいるように見せる
     addBack     ④が無いアバター（④を足す前に作ったもの）に、④だけを足す
     detectFacing  できているアバター（座る姿）が、左右どちらを向いているかを見て記録する
                   （向きを記録する前に作ったアバターのため。画面が一度だけ呼ぶ）
     borrowImages  アバターの絵を data URL で返す（読み終えたときの X 用の絵を、画面の canvas で描くため）
     sharePage     読書の記録ページ /s/{id}。X がリンクから絵（og:image）を読み取って、投稿に大きく出す
     readerStats   「読み方は、人それぞれ」：読了した冊数・読了した本の総ページ数・読んだ時間の、それぞれ上位3人

   ⚠️⚠️ **写真はどこにも残さない。**受け取って OpenAI に渡すだけ。
      残すのは出来上がった絵（Storage の avatars/{uid}/{版}/）だけ。
   ⚠️ ②③④は、写真からではなく **①から作る。**写真から何回も作ると、
      別人になる（顔も服も毎回変わる）。
   ⚠️ 席は4つ。テーブルの左右×奥と手前。左右は反転で作れるので、要るのは「顔の向き」と「背中の向き」の2つだけ。
   ⚠️ 座るものごと描かせるのは、背景の椅子に重ねると、向きと高さがずれて浮いて見えるため。
   ⚠️ 座るものは**小さな木のベンチ**（2026-09-27、カフェの椅子から替えた）。場所が観光地の広場・公園・川べりに
      なっても合うように。空いている席に置く空のベンチ（04_tools/部屋を作る.mjs bench）と、言い方をそろえる
   ⚠️⚠️ **「右前を向く」と頼んでも、左を向いて描かれることがある**（2026-09-27、配信者の一枚目がそうだった）。
      → 描いたあとに、左右どちらを向いているかを見る（avatar.facing＝"left"/"right"）。
        部屋では、席の「テーブルの方向」と違えば左右を反転する。見分けを間違えたら、本人が「自分」で反対にできる（users.flip）。
   ⚠️ 1人1日5回まで、**全員あわせて1日30回まで**（日本の日付で数える）。1回で絵を4枚作るので、料金はその4倍。
      ④だけを足す（addBack）のも1回に数える。
      だれでもログインして登録できる形にしたので、全員ぶんの上限が料金の歯止め（meta/usage）。

   鍵：OPENAI_API_KEY は Secret Manager に置く（README「鍵」）。
   ============================================================ */
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

initializeApp();
const db = getFirestore();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
// ⚠️ 画像のモデルは、新しいものが出たら差し替えられるようにしておく（functions/.env に IMAGE_MODEL=…）
const IMAGE_MODEL = defineString("IMAGE_MODEL", { default: "gpt-image-1" });

const 一日の上限 = 5;          // 1人あたり
const 全員の一日の上限 = 30;   // 全員あわせて
const 写真の上限 = 6 * 1024 * 1024;   // 画面で 1024px の JPEG に縮めてから送るので、ふつうは 0.3MB ほど

/* ── 絵の指示 ──────────────────────────────
   ⚠️ 部屋の背景は「明るい中世ヨーロッパのカフェ」を、斜め上から見た立体の絵。
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
  region: "asia-northeast1",
  secrets: [OPENAI_API_KEY],
  timeoutSeconds: 540,
  memory: "1GiB",
}, async req => {
  const 私 = req.auth;
  if(!私) throw new HttpsError("unauthenticated", "ログインしてください");

  const 写真 = 写真をほどく(req.data?.photo);
  const 利用者 = db.doc(`users/${私.uid}`);
  const 全員 = db.doc("meta/usage");

  await 回数を使う(利用者, 全員, "座っている姿を描いています（1/3）");

  const 進み = step => 利用者.set({ avatar: { step } }, { merge: true });
  try{
    const ai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const 座る = await 描く(ai, 写真, "photo.jpg", "image/jpeg", 座る指示);
    await 進み("ページをめくる姿・背中・顔を描いています（2/3）");
    const 向きの約束 = 向きを見る(ai, 座る, "image/png");
    const [めくる, 顔, 背中] = await Promise.all([
      描く(ai, 座る, "sit.png", "image/png", めくる指示),
      描く(ai, 座る, "sit.png", "image/png", 顔の指示),
      描く(ai, 座る, "sit.png", "image/png", 背中の指示),
    ]);
    await 進み("仕上げています（3/3）");

    const 版 = Date.now().toString(36);
    const [sit, turn, face, back, facing, backFacing] = await Promise.all([
      置く(私.uid, 版, "sit", 座る, 640),
      置く(私.uid, 版, "turn", めくる, 640),
      置く(私.uid, 版, "face", 顔, 256),
      置く(私.uid, 版, "back", 背中, 640),
      向きの約束,
      背中の向きを見る(ai, 背中, "image/png"),
    ]);
    await 利用者.set({ avatar: {
      status: "ready", step: FieldValue.delete(), sit, turn, face, back, facing, backFacing,
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
  region: "asia-northeast1",
  secrets: [OPENAI_API_KEY],
  timeoutSeconds: 300,
  memory: "1GiB",
}, async req => {
  if(!req.auth) throw new HttpsError("unauthenticated", "ログインしてください");
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
      背中の向きを見る(ai, 背中, "image/png"),
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
    if(!s.exists) throw new HttpsError("failed-precondition", "先に名前を決めてください");
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
  region: "asia-northeast1",
  secrets: [OPENAI_API_KEY],
  timeoutSeconds: 60,
}, async req => {
  if(!req.auth) throw new HttpsError("unauthenticated", "ログインしてください");
  const 利用者 = db.doc(`users/${req.auth.uid}`);
  const a = (await 利用者.get()).data()?.avatar || {};
  if(!a.sit) throw new HttpsError("failed-precondition", "アバターがまだありません");
  if(a.facing) return { facing: a.facing };
  const [絵] = await getStorage().bucket().file(a.sit).download();
  const facing = await 向きを見る(new OpenAI({ apiKey: OPENAI_API_KEY.value() }), 絵, "image/webp");
  await 利用者.set({ avatar: { facing } }, { merge: true });
  return { facing };
});

/* 座っている姿が、見る人から見て左右どちらを向いているか。
   ⚠️ 見分けられなかったら "right"（頼んだ向き）にする。間違えていたら本人が「自分」で反対にできる */
async function 向きを見る(ai, 絵, 型){
  try{
    const r = await ai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 3,
      messages: [{ role: "user", content: [
        { type: "text", text:
          "This image shows a blocky character sitting on a bench or chair. From the viewer's point of view, " +
          "is the character's face and body turned toward the LEFT side or the RIGHT side of the image? " +
          "Answer with exactly one word: left or right." },
        { type: "image_url", image_url: { url: `data:${型};base64,${絵.toString("base64")}`, detail: "low" } },
      ]}],
    });
    return /left/i.test(r.choices?.[0]?.message?.content || "") ? "left" : "right";
  }catch(e){
    console.error("向きを見られませんでした", e);
    return "right";
  }
}

/* 背中の姿が、左上と右上のどちらへ向いて座っているか。見分けられなければ "right"（頼んだ向き） */
async function 背中の向きを見る(ai, 絵, 型){
  try{
    const r = await ai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 3,
      messages: [{ role: "user", content: [
        { type: "text", text:
          "This image shows a blocky character sitting on a bench or chair, seen from behind (facing away from the viewer). " +
          "Is the character facing toward the upper-LEFT or the upper-RIGHT of the image? " +
          "Answer with exactly one word: left or right." },
        { type: "image_url", image_url: { url: `data:${型};base64,${絵.toString("base64")}`, detail: "low" } },
      ]}],
    });
    return /left/i.test(r.choices?.[0]?.message?.content || "") ? "left" : "right";
  }catch(e){
    console.error("背中の向きを見られませんでした", e);
    return "right";
  }
}

/* ── X に投稿する絵のため ─────────────────────────
   ⚠️ Storage の絵を画面の canvas に描くと、別の場所（firebasestorage）の絵なので canvas が「汚れ」、
      書き出せなくなる（バケットの CORS を開ければ済むが、その設定を持ち込みたくない）。
      → 裏の処理が読んで data URL で返す。**アバターの絵だけ**（avatars/ の下の決まった名前だけ）、一度に12枚まで */
export const borrowImages = onCall({ region: "asia-northeast1" }, async req => {
  if(!req.auth) throw new HttpsError("unauthenticated", "ログインしてください");
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
export const sharePage = onRequest({ region: "asia-northeast1" }, async (req, res) => {
  const id = (req.path.match(/^\/s\/([A-Za-z0-9]{10,40})\/?$/) || [])[1];
  const d = id ? (await db.doc(`shares/${id}`).get()).data() : null;
  if(!d){ res.redirect(302, "/"); return; }
  const 逃 = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const 題 = `『${d.title}』を${d.minutes}分、${d.place}のベンチで読みました`;
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
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>body{margin:0;background:#f8f6fc;color:#17141f;font-family:"Hiragino Mincho ProN","Yu Mincho",serif;line-height:1.9}
main{width:min(1080px,100% - 32px);margin:40px auto}img{width:100%;border:1px solid rgba(38,28,66,.13);border-radius:2px}
p{margin:18px 0 0}a{color:#513397}</style></head>
<body><main><img src="${逃(d.image)}" alt="${逃(題)}"><p>${逃(題)}</p>
<p><a href="/">GEMuの静かな読書会</a> ― 家にいながら、景色のいい場所で読む。</p></main></body></html>`);
});

/* ── 読み方は、人それぞれ ─────────────────────────
   2026-09-29 配信者：競わせはしないが、参考として「冊数が多い人」「ページ数が多い人」「時間が長い人」を出す。
   志向が違う人がいる、と伝えるため。期間は**これまで全部**。
   ⚠️ 記録（logs・finishes）は本人しか読めない決まりのまま。ここで全員分を数え、**上位3人の名前・顔・数だけ**を返す。
   ⚠️ 人数が少ないうちは、呼ばれるたびに全部を数え直す。記録が数万件を超えたら、書かれたときに足し込む形（トリガー）に替える */
export const readerStats = onCall({ region: "asia-northeast1" }, async req => {
  if(!req.auth) throw new HttpsError("unauthenticated", "ログインしてください");
  const [logs, fins, users] = await Promise.all([
    db.collection("logs").select("uid", "from", "to").get(),
    db.collection("finishes").select("uid", "pages").get(),
    db.collection("users").get(),
  ]);
  const 計 = new Map();
  const 足す = (uid, k, v) => {
    if(!uid) return;
    const x = 計.get(uid) || { books: 0, pages: 0, minutes: 0 };
    x[k] += v;
    計.set(uid, x);
  };
  logs.forEach(d => {
    const x = d.data();
    const ms = (x.to?.toMillis?.() || 0) - (x.from?.toMillis?.() || 0);
    if(ms > 0) 足す(x.uid, "minutes", ms / 60000);
  });
  fins.forEach(d => {
    const x = d.data();
    足す(x.uid, "books", 1);
    足す(x.uid, "pages", Number(x.pages) || 0);
  });
  const 人 = new Map(users.docs.map(d => [d.id, d.data()]));
  const 上位 = k => [...計].filter(([uid, v]) => Math.round(v[k]) > 0 && 人.has(uid))
    .sort((a, b) => b[1][k] - a[1][k]).slice(0, 3)
    .map(([uid, v]) => ({ uid, name: 人.get(uid).name || "", face: 人.get(uid).avatar?.face || "", value: Math.round(v[k]) }));
  return { books: 上位("books"), pages: 上位("pages"), minutes: 上位("minutes") };
});

/* ── 道具 ─────────────────────────────── */
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

function 誤りの言葉(e){
  const m = String(e?.message || "");
  if(e?.status === 400 && /safety|moderation|rejected/i.test(m))
    return "この写真では作れませんでした。別の写真で試してください";
  if(e?.status === 429) return "混み合っています。少し待ってから試してください";
  if(e?.status === 401) return "OpenAI の鍵が効いていません（運営者に知らせてください）";
  return "作れませんでした：" + m.slice(0, 120);
}
