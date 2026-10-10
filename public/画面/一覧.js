/* ============================================================
   場所の一覧（上のメニューの「場所」）・ベンチでひらかれた本・読み方は、人それぞれ
   ============================================================ */
import { 出す部屋ら } from "../部屋.js";
import { 土台, 画面, 状態, 頁ら, 逃, 絵を入れる, 顔の絵, 時間に, 待ちの画面 } from "./共通.js";
import { 人とベンチ } from "./ベンチ.js";
import { 表紙, 書籍名, 本の表 } from "./本.js";

/* ── 廊下（部屋の一覧） ─────────────────────── */
function 廊下(){
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Places</p>
    <h1 class="中見出し">どこで読みますか</h1>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">場所</h2><p class="節の添え">世界の、読書が気持ちよさそうな場所を増やしていきます</p></div>
    <div class="部屋の列">
      ${出す部屋ら().map(([id, 部屋])=>`
      <div class="部屋の札" data-する="場所へ" data-部屋="${id}">
        <div class="小さな舞台"><div class="舞台" id="小舞台-${id}" style="aspect-ratio:${部屋.比}"><img class="背景" src="${部屋.絵}" alt="">${人とベンチ(部屋, [])}</div></div>
        <div>
          <div class="部屋の名">${逃(部屋.名)}</div>
          <div class="部屋の素性" id="居る数-${id}">${逃(部屋.添え)}</div>
          <div class="顔の列" id="顔の列-${id}"></div>
        </div>
        <button class="釦 小 枠だけ 入口の釦" id="札-${id}" data-する="場所へ" data-部屋="${id}">ここで読む →</button>
      </div>`).join("")}
    </div>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">ベンチでひらかれた本</h2><p class="節の添え">これまでの全部</p></div>
    <p class="注">本の側から見た数です。だれが読んだかは出しません。</p>
    <div class="読み方" id="本のランキング">${待ちの画面("数えています")}</div>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">読み方は、人それぞれ</h2><p class="節の添え">これまでの全部</p></div>
    <p class="注">競うものではありません。たくさんの本を読む人、厚い本を読む人、長い時間をかける人。いろいろな読み方の人がいます。</p>
    <div class="読み方" id="読み方">${待ちの画面("数えています")}</div>
  </section>`;
  読み方を描く();
  // だれがいるかを出す
  for(const [id, 部屋] of 出す部屋ら()){
    状態.片づけ.push(土台.席を見張る(id, 席ら=>{
      const 数 = document.getElementById(`居る数-${id}`), 列 = document.getElementById(`顔の列-${id}`);
      if(!数) return;
      const 満席 = 席ら.length >= 部屋.席.length;
      数.textContent = 満席 ? `いまは満席です（${部屋.席.length}人）。のぞいて、ベンチが空くのを待つことはできます`
        : 席ら.length ? `いま${席ら.length}人が読んでいます（${部屋.席.length}席）` : `いまは、だれもいません（${部屋.席.length}席）`;
      const 札 = document.getElementById(`札-${id}`);
      // ⚠️ 前は「入る」という札で、何のためのものか分かりにくかった（配信者）。行全体が押せる。札は「何が起きるか」を言う
      if(札) 札.textContent = 満席 ? "のぞく →" : "ここで読む →";
      列.innerHTML = 席ら.map(s=>顔の絵(状態.人々.get(s.uid), "中")).join("");
      絵を入れる(列);
      const 小舞台 = document.getElementById(`小舞台-${id}`);
      if(小舞台){
        小舞台.innerHTML = 小舞台.querySelector("img.背景").outerHTML + 人とベンチ(部屋, 席ら);
        絵を入れる(小舞台);
      }
    }));
  }
}

// 3つの列の1つ（ベンチでひらかれた本・読み方は、人それぞれ で共通）。行ら が空なら 空 の文
const 列 = (見出し, 行ら, 空) => `
    <div class="読み方の列">
      <h3>${見出し}</h3>
      ${行ら.length ? 行ら.join("") : `<p class="注">${空}</p>`}
    </div>`;

/* ベンチでひらかれた本（2026-10-01 配信者「本を起点として、読了の数、読まれたページの数、読まれた時間で」。
   最初は「本のランキング」と呼んでいたが、同じ日にコンセプトに合わせてこの名前にした。順位の数字は残す）。
   「読み方は、人それぞれ」と同じ3列の形。本は順位つき（人のほうは順位を付けない）。だれが読んだかは出さない */
async function 本のランキングを描く(本){
  const 置き場 = document.getElementById("本のランキング");
  if(!置き場) return;
  if(!本) return 置き場.innerHTML = `<p class="誤りの字">いまは数えられませんでした。</p>`;
  const 表 = await 本の表();
  const 本の列 = (見出し, 本ら, 単位) => 列(見出し, 本ら.map((x, i)=>`<div class="読み方の人">
        <span class="順位">${i + 1}</span>
        ${表紙(表.引く(x.本, x.題))}
        <span class="名 書籍名">${書籍名(表.引く(x.本, x.題), x.題)}</span><span class="数">${単位(x.数)}</span></div>`), "まだありません。");
  置き場.innerHTML =
    本の列("読了の数", 本.読了, n=>`${n}回`) +
    本の列("読まれたページの数", 本.ページ, n=>`${n.toLocaleString()}ページ`) +
    本の列("読まれた時間", 本.分, 時間に);
}

/* 読み方は、人それぞれ（2026-09-29 配信者）。
   ⚠️ 順位の数字は付けない。3つの列を横に並べ、どれが上ということもない形にする */
async function 読み方を描く(){
  let r;
  try{ r = await 土台.読み方を読む(); }catch(e){ console.error(e); r = null; }
  const 置き場 = document.getElementById("読み方");
  if(!置き場) return;
  本のランキングを描く(r?.本);
  if(!r) return 置き場.innerHTML = `<p class="誤りの字">いまは数えられませんでした。</p>`;
  const 人の列 = (見出し, 人ら, 単位) => 列(見出し, 人ら.map(x=>`<div class="読み方の人">${顔の絵({ アバター:{ 顔:x.顔 } }, "中")}
        <span class="名">${逃(x.名)}</span><span class="数">${単位(x.数)}</span></div>`), "まだ、だれもいません。");
  置き場.innerHTML =
    人の列("たくさんの本を", r.冊, n=>`${n}冊`) +
    人の列("たくさんのページを", r.ページ, n=>`${n.toLocaleString()}ページ`) +
    人の列("長い時間を", r.分, 時間に);
  絵を入れる(置き場);
}

頁ら.廊下 = 廊下;
