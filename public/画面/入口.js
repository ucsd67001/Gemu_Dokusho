/* ============================================================
   入口・はじめての登録（ユーザ名と写真）・アバターを作っているあいだ・できあがり
   ============================================================ */
import { 部屋ら, 最初の部屋 } from "../部屋.js";
import { 土台, 試しか, 画面, 状態, 頁ら, 動き, 変わったら, 誤りの言葉, 逃, 知らせる, 描く, 行く, 絵を入れる } from "./共通.js";
import { 人とベンチ } from "./ベンチ.js";

/* ── 入口 ─────────────────────────────── */
function 入口(){
  const 部屋 = 部屋ら[最初の部屋];
  画面.innerHTML = `
  <div class="看板"><div class="舞台" style="aspect-ratio:${部屋.比}"><img class="背景" src="${部屋.絵}" alt="${逃(部屋.名)}">${人とベンチ(部屋, [])}</div></div>
  <section class="幕">
    <p class="英字の札">GEMu Dokusho</p>
    <h1 class="大見出し">家にいながら、<br>景色のいい場所で読む。</h1>
    <p class="導き">だれにも邪魔されずに、ひとりで静かに本を読むのが好き。でも、景色のいいところで読むのにも、ちょっと憧れている。インドア派だから、なかなか行けないけれど。</p>
    <p class="導き 続き">ここでは、自分をブロックのアバターにして、世界の、読書が気持ちよさそうな場所のベンチに座ります。話さなくていい。となりのベンチでも、だれかが自分の本を読んでいます。最初の場所は、ドイツのローテンブルクです。</p>
    <div class="釦たち 上の広い間">
      <button class="釦" data-する="入る">${試しか ? "試しに入る" : "Google でログイン"}</button>
    </div>
    <p class="注">${試しか
      ? "これは試しです。この端末のブラウザの中だけで動きます。タブを2つ開くと、2人で入れます。"
      : "はじめてログインするときに、ユーザ名と写真を決めます。"}</p>
  </section>`;
}

/* ── 名前と写真 ─────────────────────────── */
let 選んだ写真 = null;   // 縮めた data URL

export function 写真の欄(){
  return `
    <p class="欄の名">自分の写真か、絵</p>
    <div class="写真の枠">
      ${選んだ写真 ? `<img class="写真の見本" src="${選んだ写真}" alt="">` : `<div class="写真の見本">まだです</div>`}
      <div>
        <label class="釦 枠だけ 小">写真を選ぶ<input type="file" accept="image/*" data-変わる="写真"></label>
        <p class="注 近く">自分の写真でも、好きなキャラクターの絵でも。写っているものを、そのままブロックのアバターにします。</p>
      </div>
    </div>
    <p class="注">写真は、アバターを作るために OpenAI へ送るだけで、保存しません。残るのは、できあがったブロックの絵だけです。</p>`;
}

function 登録(){
  const 誤り = 状態.自分?.アバター?.状態 === "failed" ? 状態.自分.アバター.誤り : "";
  画面.innerHTML = `
  <section class="幕 帳">
    <p class="英字の札">Welcome</p>
    <h1 class="中見出し">はじめまして</h1>
    <p class="導き">ユーザ名と写真を決めると、写真をもとに、ブロックのアバターを作ります。</p>
    <label class="欄の名" for="名の欄">ユーザ名（アバターの足もとに出ます）</label>
    <input id="名の欄" class="欄" maxlength="20" placeholder="例：しおり" value="${逃(状態.自分?.名 || "")}">
    ${写真の欄()}
    ${誤り ? `<p class="誤りの字">${逃(誤り)}</p>` : ""}
    <div class="釦たち 上の広い間">
      <button class="釦" data-する="はじめて作る">アバターを作る</button>
    </div>
    <p class="注">できあがるまで、1〜2分かかります。</p>
  </section>`;
}

function 作っている(){
  const a = 状態.自分?.アバター;
  画面.innerHTML = `
  <div class="待つ">
    <div class="積み木">${"<i></i>".repeat(6)}</div>
    <p class="段の字">${逃((a?.状態 === "making" && a.段階) || "描きはじめています")}</p>
    <p class="注">3枚描くので、1〜2分かかります。<br>このページを閉じても、描き続けます。できたら、次に開いたときに出ます。</p>
  </div>`;
}

function できあがり(){
  const a = 状態.自分.アバター;
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Your avatar</p>
    <h1 class="中見出し">できました</h1>
    <p class="導き">場所ごとに、決まった方を向いてベンチに座ります。ときどき、ページをめくります。</p>
    ${三枚(a)}
    <div class="釦たち 上の広い間">
      <button class="釦" data-する="場所へ" data-部屋="${最初の部屋}">${逃(部屋ら[最初の部屋].名)}へ</button>
      <button class="釦 枠だけ" data-する="行く" data-頁="自分">自分のページで作り直す</button>
    </div>
  </section>`;
  状態.作ったばかり = false;
  絵を入れる(画面);
}

/* できあがったアバターの3枚（座って読む・ページをめくる・顔）。
   ⚠️ 背中は作らない（2026-10-10 配信者。いまの場所に手前の席が無い）。前は4枚目に「背中（手前の席）」を出していた */
export const 三枚 = a => `<div class="三枚">
  <figure><img data-道="${逃(a.座る)}" alt="座って読むアバター"><figcaption>座って読む</figcaption></figure>
  <figure><img data-道="${逃(a.めくる)}" alt="ページをめくるアバター"><figcaption>ページをめくる</figcaption></figure>
  <figure><img data-道="${逃(a.顔)}" alt="アバターの顔"><figcaption>顔</figcaption></figure>
</div>`;

/* ── 押したとき ─────────────────────────── */
async function 写真を縮める(ファイル){
  const 絵 = await createImageBitmap(ファイル, { imageOrientation:"from-image" });
  const 倍 = Math.min(1, 1024 / Math.max(絵.width, 絵.height));
  const c = document.createElement("canvas");
  c.width = Math.round(絵.width * 倍); c.height = Math.round(絵.height * 倍);
  c.getContext("2d").drawImage(絵, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", .9);
}

export function 名を読む(){
  const 名 = document.getElementById("名の欄")?.value.trim() || "";
  if(!名){ 知らせる("ユーザ名を入れてください", true); return null; }
  return 名;
}

async function 作る(名){
  if(!選んだ写真) return 知らせる("写真を選んでください", true);
  try{
    if(名) await 土台.名を決める(名);
    状態.作ったばかり = true;
    状態.頼んでいる = true;
    const 写真 = 選んだ写真;
    選んだ写真 = null;
    描く();
    scrollTo(0, 0);
    await 土台.アバターを作る(写真);
    状態.頼んでいる = false;
    描く();
  }catch(e){
    console.error(e);
    状態.頼んでいる = false;
    状態.作ったばかり = false;
    知らせる(誤りの言葉(e, "アバターを作れませんでした。時間をおいて、もう一度試してください"), true);
    描く();
  }
}

// 写真を選んだら、縮めて見本を出す
変わったら.写真 = async 欄=>{
  const f = 欄.files?.[0];
  if(!f) return;
  try{ 選んだ写真 = await 写真を縮める(f); }
  catch(err){ return 知らせる("この写真は読めませんでした", true); }
  // 入れかけの名前を消さないように、見本の絵だけ差し替える
  const 見本 = document.querySelector(".写真の見本");
  見本?.insertAdjacentHTML("afterend", `<img class="写真の見本" src="${選んだ写真}" alt="">`);
  見本?.remove();
};

Object.assign(頁ら, { 入口, 登録, 作っている, できあがり });
Object.assign(動き, {
  // Firebase の英語の誤り（auth/… など）は画面に出さない。ログインの窓を自分で閉じたときは何も言わない
  入る: ()=>土台.入る().catch(e=>{
    console.error(e);
    if(/popup-closed|cancelled-popup/.test(e?.code || "")) return;
    知らせる("ログインできませんでした。もう一度お試しください", true);
  }),
  出る: async ()=>{ await 土台.出る(); 状態.自分 = undefined; 行く("廊下"); },
  はじめて作る: ()=>{ const 名 = 名を読む(); if(名) 作る(名); },
  作り直す: ()=>作る(null),
});
