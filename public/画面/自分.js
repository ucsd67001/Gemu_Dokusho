/* ============================================================
   自分のページ（ユーザ名の直し・アバターの作り直し・ログアウト）
   ============================================================ */
import { 土台, 画面, 状態, 頁ら, 動き, 逃, 知らせる, 絵を入れる, 顔の絵 } from "./共通.js";
import { 写真の欄, 三枚, 名を読む } from "./入口.js";

/* ── 自分 ─────────────────────────────── */
function 自分の頁(){
  const 自分 = 状態.自分, a = 自分.アバター;
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Me</p>
    <div class="自分の頭">
      ${顔の絵(自分, "大")}
      <div><h1 class="中見出し">${逃(自分.名)}</h1>
        <p class="注">${逃(状態.私.メール)}</p></div>
    </div>
  </section>
  <section class="節 帳">
    <div class="節の頭"><h2 class="節見出し">ユーザ名</h2></div>
    <input id="名の欄" class="欄" maxlength="20" value="${逃(自分.名)}" aria-label="ユーザ名">
    <div class="釦たち 上の間"><button class="釦 小" data-する="名を直す">ユーザ名を直す</button></div>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">アバター</h2><p class="節の添え">作り直せるのは1日5回まで</p></div>
    ${三枚(a)}
    <div class="釦たち 上の間">
      <button class="釦 枠だけ 小" data-する="向きを反対にする">向きを反対にする</button>
    </div>
    <p class="注">場所ごとに、決まった方を向いて座ります。逆を向いていたら押してください。</p>
    <div class="帳">
      ${写真の欄()}
      ${a.状態 === "failed" && a.誤り ? `<p class="誤りの字">${逃(a.誤り)}</p>` : ""}
      <div class="釦たち 上の広い間">
        <button class="釦" data-する="作り直す">この写真で作り直す</button>
      </div>
    </div>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">ログイン</h2></div>
    <div class="釦たち 上の間"><button class="釦 枠だけ 小" data-する="出る">ログアウト</button></div>
  </section>`;
  絵を入れる(画面);
}

頁ら.自分 = 自分の頁;
Object.assign(動き, {
  名を直す: async ()=>{
    const 名 = 名を読む(); if(!名) return;
    try{ await 土台.名を決める(名); 知らせる("ユーザ名を直しました"); }
    catch(e){ 知らせる("ユーザ名を直せませんでした", true); }
  },
  向きを反対にする: async ()=>{
    try{ await 土台.向きを反対にする(!状態.自分.反転); 知らせる("向きを反対にしました"); }
    catch(e){ 知らせる("向きを変えられませんでした", true); }
  },
  /* ⚠️ 「背中のアバターを足す」は外した（2026-10-10 配信者。背中を使う手前の席が、いまの場所に無い）。
        手前の席のある場所を足すときは、ここと functions の addBack（残してある）をつなぎ直す */
});
