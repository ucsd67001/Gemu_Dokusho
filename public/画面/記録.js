/* ============================================================
   記録（読んだ時間のページ）
   ============================================================ */
import { 土台, 画面, 頁ら, 分に, 日時に, 待ちの画面 } from "./共通.js";
import { 表紙, 書籍名, 本の表 } from "./本.js";

/* ── 記録 ─────────────────────────────── */
async function 記録の頁(){
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Reading log</p>
    <h1 class="中見出し">読んだ時間</h1>
    <p class="導き">ベンチに座っていた時間です。「読み終える」で終えた回だけが残ります。</p>
    <div id="記録の中">${待ちの画面("読みこんでいます")}</div>
  </section>`;
  let 記録;
  let 読了ら = [];
  let 表 = { 引く:()=>null };
  try{ [記録, 読了ら, 表] = await Promise.all([土台.記録を読む(), 土台.読了を読む().catch(()=>[]), 本の表()]); }
  catch(e){ console.error(e); 記録 = null; }
  const 中 = document.getElementById("記録の中");
  if(!中) return;
  if(!記録) return 中.innerHTML = `<p class="誤りの字">記録を読めませんでした。</p>`;

  const 長さ = r => Math.max(0, r.終わり - r.始め);
  const 今日の始め = new Date(); 今日の始め.setHours(0, 0, 0, 0);
  const 計 = 条件 => 記録.filter(条件).reduce((s, r)=>s + 長さ(r), 0);

  // 大きな数字で「2時間5分」（単位だけ小さく）。書き方は 分に と同じ
  const 数字 = (名, ms) => `<div class="数字"><div class="名">${名}</div>
      <div class="値">${分に(ms).replace(/(時間|分)/g, "<small>$1</small>")}</div></div>`;
  中.innerHTML = `
    <div class="数字たち">
      ${数字("今日", 計(r=>r.始め >= 今日の始め.getTime()))}
      ${数字("この7日間", 計(r=>r.始め >= Date.now() - 7 * 86400000))}
      ${数字("これまで", 計(()=>true))}
    </div>
    <div class="数字たち 続き">
      <div class="数字"><div class="名">冊数</div><div class="値">${読了ら.length}<small>冊</small></div></div>
      <div class="数字"><div class="名">ページ数</div><div class="値">${読了ら.reduce((s, r)=>s + (r.ページ || 0), 0).toLocaleString()}<small>ページ</small></div></div>
      <div class="数字"></div>
    </div>
    <p class="注">冊数とページ数は、「読み終える」で「この本を最後まで読んだ」に印を付けた本だけを数えます。</p>
    <section class="節">
      <div class="節の頭"><h2 class="節見出し">これまで</h2><p class="節の添え">${記録.length}回</p></div>
      <div class="記録の列">
        ${記録.length ? 記録.map(r=>`<div class="記録">
          <span class="日">${日時に(r.始め)}</span>
          ${r.題 === 土台.題を出さない印
            ? `<span class="題"><span class="表紙 小" aria-hidden="true"></span><span class="注">（書籍名を出さずに読んだ回）</span></span>`
            : `<span class="題">${表紙(表.引く(r.本, r.題))}<span>${書籍名(表.引く(r.本, r.題), r.題)}</span></span>`}
          <span class="分">${分に(長さ(r))}</span></div>`).join("")
          : `<p class="注">まだありません。ベンチに座ると、ここに残ります。</p>`}
      </div>
    </section>`;
}

頁ら.記録 = 記録の頁;
