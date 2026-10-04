/* ============================================================
   管理（本の申請を承認する。管理者だけ）
   ============================================================ */
import { ISBNで確かめる } from "../書誌.js";
import { 土台, 画面, 状態, 頁ら, 動き, 逃, 知らせる, 待ちの画面, 日時に } from "./共通.js";

/* ── 管理（本の申請を承認する） ───────────────────
   管理者（Firebase コンソールで admins/{uid} を足した人）だけに出る（2026-09-29 配信者）。
   承認すると本登録（みんなが選べる）。見送ると、申請した本人の一覧からも消える。
   承認の前に、書名・著者名・出版社名を直せる（表記をそろえるため） */
async function 管理の頁(){
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Admin</p>
    <h1 class="中見出し">本の申請</h1>
    <p class="導き">仮登録の本です。確かめて、本登録にするか見送るかを決めてください。</p>
    <div id="申請の列">${待ちの画面("読みこんでいます")}</div>
  </section>`;
  let 申請ら;
  try{ 申請ら = await 土台.申請らを読む(); }catch(e){ console.error(e); 申請ら = null; }
  const 列 = document.getElementById("申請の列");
  if(!列) return;
  if(!申請ら) return 列.innerHTML = `<p class="誤りの字">申請を読めませんでした。</p>`;
  if(!申請ら.length) return 列.innerHTML = `<p class="注 離れて">いま、申請はありません。</p>`;
  列.innerHTML = `<div class="申請の列">${申請ら.map(b=>`
    <div class="申請">
      <div class="申請の素性">申請：${逃(状態.人々.get(b.申請者)?.名 || "（ユーザ名なし）")}
        ${b.申請日 ? `／${日時に(b.申請日)}` : ""}${b.isbn ? `／ISBN ${逃(b.isbn)}` : ""}${b.ひとこと ? `／「${逃(b.ひとこと)}」` : ""}</div>
      <label class="名札" for="管題-${逃(b.id)}">書籍名</label><input class="欄" id="管題-${逃(b.id)}" maxlength="120" value="${逃(b.題)}">
      <label class="名札" for="管著-${逃(b.id)}">著者名</label><input class="欄" id="管著-${逃(b.id)}" maxlength="80" value="${逃(b.著)}">
      <label class="名札" for="管版元-${逃(b.id)}">出版社名</label><input class="欄" id="管版元-${逃(b.id)}" maxlength="80" value="${逃(b.版元)}">
      <label class="名札" for="管ページ-${逃(b.id)}">ページ数（わかれば。読了のときに入っておく）</label><input class="欄" id="管ページ-${逃(b.id)}" type="number" inputmode="numeric" min="0" max="20000" value="${b.ページ || ""}">
      ${b.isbn ? `<div class="釦たち 上の間">
        <button class="釦 枠だけ 小" data-する="書誌を引き直す" data-本="${逃(b.id)}" data-isbn="${逃(b.isbn)}">ISBN から書誌を引き直す</button></div>
        <div id="管確認-${逃(b.id)}"></div>` : ""}
      <div class="釦たち 上の間">
        <button class="釦 小" data-する="申請を承認" data-本="${逃(b.id)}">本登録にする</button>
        <button class="釦 小 枠だけ" data-する="申請を見送る" data-本="${逃(b.id)}">見送る</button>
      </div>
    </div>`).join("")}</div>`;
}

/* 管理：申請の ISBN で openBD を引き直し、書名・著者・出版社を正しい表記に入れ替える（Hongaeshi の申請の処理と同じく、承認の前に書誌を確かめる） */
async function 書誌を引き直す(el){
  const id = el.dataset.本, 確認 = document.getElementById(`管確認-${id}`);
  if(確認) 確認.innerHTML = `<p class="注">さがしています…</p>`;
  const r = await ISBNで確かめる(el.dataset.isbn);
  if(!r){ if(確認) 確認.innerHTML = `<p class="誤りの字">書誌は見つかりませんでした。</p>`; return; }
  const 入れる = (k, v)=>{ const e = document.getElementById(`${k}-${id}`); if(e && v) e.value = v; };
  入れる("管題", r.題); 入れる("管著", r.著); 入れる("管版元", r.版元); if(r.ページ) 入れる("管ページ", String(r.ページ));
  if(確認) 確認.innerHTML = `<p class="注">openBD の書誌を入れました：『${逃(r.題)}』 ${逃(r.著)}／${逃(r.版元)}${r.ページ ? `・${r.ページ}ページ` : ""}</p>`;
}

async function 申請を決める(el, 承認){
  const id = el.dataset.本;
  const 値 = k => document.getElementById(`${k}-${id}`)?.value.trim() || "";
  el.disabled = true;
  try{
    await 土台.申請を決める(id, 承認, { 題:値("管題"), 著:値("管著"), 版元:値("管版元"),
      ページ:Math.max(0, Math.min(20000, Math.round(Number(値("管ページ")) || 0))) });
    知らせる(承認 ? "本登録にしました" : "見送りました");
    管理の頁();
  }catch(e){
    console.error(e);
    el.disabled = false;
    知らせる(承認 ? "本登録にできませんでした" : "見送れませんでした", true);
  }
}

頁ら.管理 = 管理の頁;
Object.assign(動き, {
  書誌を引き直す: el=>書誌を引き直す(el),
  申請を承認: el=>申請を決める(el, true),
  申請を見送る: el=>申請を決める(el, false),
});
