/* ============================================================
   GEMu 読書会 ― 裏の処理

   いまあるのは2つ：
     detectFacing  できているアバター（座る姿）が、左右どちらを向いているかを見て記録する
                   （向きを記録する前に作ったアバターのため。画面が一度だけ呼ぶ）
     makeAvatar  写真から、ブロック風のアバターを3枚作る
                 ① 椅子ごと座って本を読む姿（sit）
                 ② 同じ姿で、ページをめくっているところ（turn）
                 ③ 顔のアイコン（face）
                 部屋では ①と② を交互に出して、読んでいるように見せる

   ⚠️⚠️ **写真はどこにも残さない。**受け取って OpenAI に渡すだけ。
      残すのは出来上がった絵（Storage の avatars/{uid}/{版}/）だけ。
   ⚠️ ②と③は、写真からではなく **①から作る。**写真から3回作ると、
      3枚が別人になる（顔も服も毎回変わる）。
   ⚠️ 椅子ごと描かせるのは、背景の椅子に重ねると、向きと高さがずれて浮いて見えるため。
   ⚠️⚠️ **「右前を向く」と頼んでも、左を向いて描かれることがある**（2026-09-27、配信者の一枚目がそうだった）。
      → 描いたあとに、左右どちらを向いているかを見る（avatar.facing＝"left"/"right"）。
        部屋では、席の「テーブルの方向」と違えば左右を反転する。見分けを間違えたら、本人が「自分」で反対にできる（users.flip）。
   ⚠️ 1人1日5回まで、**全員あわせて1日30回まで**（日本の日付で数える）。1回で絵を3枚作るので、料金はその3倍。
      だれでもログインして登録できる形にしたので、全員ぶんの上限が料金の歯止め（meta/usage）。

   鍵：OPENAI_API_KEY は Secret Manager に置く（README「鍵」）。
   ============================================================ */
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
const 画風 =
  "Blocky voxel character in the style of Minecraft: cubic head, square body and limbs, " +
  "flat pixel-art textures, simple and cute. Clean 3D render, soft even lighting, " +
  "isometric three-quarter view from slightly above, the character faces toward the front-right. " +
  "Fully transparent background. No text, no floor, no shadow on the ground, no other objects.";

const 座る指示 =
  "Turn the person in this photo into a single " + 画風 + " " +
  "Keep their recognizable features as blocky pixel textures: hair style and hair color, " +
  "skin tone, glasses if any, and the colors of their clothes. " +
  "The character sits on a small medieval wooden chair (the chair is part of the image), " +
  "holding an open book in both hands and reading it calmly. The whole chair and body fit inside the image.";

const めくる指示 =
  "Keep this exact same character, chair, pose, camera angle, size and position. " +
  "Change only one thing: one hand is turning a page of the open book (a page lifted in mid-turn). " +
  "Fully transparent background. No text.";

const 顔の指示 =
  "Using this exact same character, make a square portrait icon: only the blocky head and shoulders, " +
  "facing the front, centered, filling most of the image. Same pixel textures and colors. " +
  "Fully transparent background. No book, no chair, no text.";

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

  // 回数と、作っている最中かを1つのトランザクションで見る（二度押しで2回走らせない）
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
    tx.set(利用者, { avatar: {
      ...a, status: "making", step: "座っている姿を描いています（1/3）",
      error: FieldValue.delete(), at: FieldValue.serverTimestamp(), day: 今日, count: 回 + 1
    }}, { merge: true });
  });

  const 進み = step => 利用者.set({ avatar: { step } }, { merge: true });
  try{
    const ai = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const 座る = await 描く(ai, 写真, "photo.jpg", "image/jpeg", 座る指示);
    await 進み("ページをめくる姿と、顔を描いています（2/3）");
    const 向きの約束 = 向きを見る(ai, 座る, "image/png");
    const [めくる, 顔] = await Promise.all([
      描く(ai, 座る, "sit.png", "image/png", めくる指示),
      描く(ai, 座る, "sit.png", "image/png", 顔の指示),
    ]);
    await 進み("仕上げています（3/3）");

    const 版 = Date.now().toString(36);
    const [sit, turn, face] = await Promise.all([
      置く(私.uid, 版, "sit", 座る, 640),
      置く(私.uid, 版, "turn", めくる, 640),
      置く(私.uid, 版, "face", 顔, 256),
    ]);
    const facing = await 向きの約束;
    await 利用者.set({ avatar: {
      status: "ready", step: FieldValue.delete(), sit, turn, face, facing, at: FieldValue.serverTimestamp()
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
          "This image shows a blocky character sitting on a chair. From the viewer's point of view, " +
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
