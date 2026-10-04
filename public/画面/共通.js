/* ============================================================
   画面の共通（どの画面のファイルも、ここだけを土台にする）

   ⚠️ 2026-10-04 のリファクタリングで app.js（1500行）を画面ごとのファイルに分けた。
      ・ここ：土台の読み込み・状態・小さな道具・小さな画面（ダイアログ）・頁の行き来
      ・画面のファイルどうしは、なるべく直接は読み込み合わない。
        頁は 頁ら に、押したときの動きは 動き に、それぞれのファイルが自分で登録する
      ・小さな画面が閉じたときの後始末は 窓が閉じたら に登録する（本を選ぶ画面の状態を消す など）
   ⚠️ Firebase には直接さわらない。**土台.js（試しでは 試し/土台.js）だけを通す。**
   ⚠️ 押せるものは onclick に値を書かず、data-する="…" と data-* で渡す（CLAUDE.md）
   ⚠️ 画面に出す言葉と書き方の決まりは app.js の冒頭
   ============================================================ */

import { 部屋ら, 最初の部屋 } from "../部屋.js";

export const 試しか = location.pathname === "/demo" || location.pathname.startsWith("/demo/");
export const 土台 = await import(試しか ? "../試し/土台.js" : "../土台.js");
export const 根 = 試しか ? "/demo" : "";

export const 画面 = document.getElementById("画面");
export const 状態 = {
  起きた:false, 私:null,
  自分:undefined,          // undefined＝読み込み中／null＝まだユーザ名が無い
  人々:new Map(),
  席ら:[],                 // いま見ている場所の席
  頁:"廊下", 部屋:最初の部屋,
  作ったばかり:false,
  頼んでいる:false,         // 作る を押してから、裏の処理が返るまで
  管理者:false,
  いまの本:null,           // いま読む本（読了のときに総ページ数をはじめから入れるため）
  片づけ:[],               // 頁を離れるときに止めるもの（見張り・時計）
};

// 登録の場所
export const 頁ら = {};            // 頁の名前 → 描く関数（入口・登録・作っている・できあがり・廊下・部屋・記録・自分・管理）
export const 動き = {};            // data-する の値 → 押したときの関数
export const 窓が閉じたら = new Set();   // 小さな画面が閉じたときの後始末

// しまってある場所（部屋.js の 出す: false）は開かない
export const 開ける場所か = id => !!部屋ら[id] && 部屋ら[id].出す !== false;

/* ── 小さな道具 ─────────────────────────── */
export const 逃 = s => String(s ?? "").replace(/[&<>"']/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

export function 知らせる(文, 悪い=false){
  document.querySelector(".知らせ")?.remove();
  const d = document.createElement("div");
  d.className = "知らせ" + (悪い ? " 悪い" : "");
  d.setAttribute("role", 悪い ? "alert" : "status");   // 読み上げに伝える
  d.textContent = 文;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 3800);
}

/* 小さな画面（ダイアログ）。
   閉じられない … ✕ を出さず、外側を押しても Esc でも閉じない。答えてもらう画面だけ
                  （「おかえりなさい」と、スマホの X 投稿。閉じると、記録を残したのに場所のページにとどまった）
   ⚠️ 開いたら中にフォーカスを移し（Tab は中だけを回る）、閉じたら開く前の場所へ戻す */
let 窓の前のフォーカス = null;

export function 窓を出す(題, 中, { 閉じられない = false } = {}){
  const 置き場 = document.getElementById("窓");
  if(!置き場.innerHTML) 窓の前のフォーカス = document.activeElement;
  置き場.innerHTML = `
  <div class="覆い" ${閉じられない ? "" : `data-する="覆いの外"`}>
    <div class="窓" role="dialog" aria-modal="true" aria-label="${逃(題)}" tabindex="-1" ${閉じられない ? "data-閉じられない" : ""}>
      <div class="窓の頭"><h3>${逃(題)}</h3>
        ${閉じられない ? "" : `<button class="閉じる" data-する="窓を閉じる" aria-label="閉じる">✕</button>`}</div>
      <div class="窓の中">${中}</div>
    </div></div>`;
  // ⚠️ 入力欄にはフォーカスしない（スマホでキーボードが出て、本の一覧が隠れる）。画面そのものにフォーカスする
  置き場.querySelector(".窓").focus();
}

export function 窓を閉じる(){
  const 置き場 = document.getElementById("窓");
  const 開いていた = !!置き場.innerHTML;
  置き場.innerHTML = "";
  for(const f of 窓が閉じたら) f();   // 本を選ぶ画面の状態を消す など（読み込みのあとで開き直らないように）
  if(開いていた && 窓の前のフォーカス?.isConnected) 窓の前のフォーカス.focus();
  窓の前のフォーカス = null;
}

// Esc で閉じる／Tab は小さな画面の中だけを回る
document.addEventListener("keydown", e=>{
  const 窓 = document.querySelector("#窓 .窓");
  if(!窓) return;
  if(e.key === "Escape" && !窓.hasAttribute("data-閉じられない")){ e.preventDefault(); 窓を閉じる(); return; }
  if(e.key !== "Tab") return;
  const 押せる = [...窓.querySelectorAll("a[href],button:not(:disabled),input:not(:disabled),[tabindex='0']")].filter(x=>x.offsetParent);
  if(!押せる.length) return;
  const 最初 = 押せる[0], 最後 = 押せる.at(-1);
  if(e.shiftKey && (document.activeElement === 最初 || document.activeElement === 窓)){ e.preventDefault(); 最後.focus(); }
  else if(!e.shiftKey && document.activeElement === 最後){ e.preventDefault(); 最初.focus(); }
});

// 絵の道（Storage の場所）から URL を引いて、img[data-道] に入れる
const URLの控え = new Map();

export function 絵を入れる(根の要素 = document){
  for(const img of 根の要素.querySelectorAll("img[data-道]")){
    const 道 = img.dataset.道;
    if(!道) continue;
    if(URLの控え.has(道)){ img.src = URLの控え.get(道); continue; }
    土台.絵のURL(道).then(u=>{ URLの控え.set(道, u); img.src = u; }).catch(()=>{});
  }
}

export const 顔の絵 = (人, 大きさ = "") =>
  `<img class="顔 ${大きさ}" data-道="${逃(人?.アバター?.顔 || "")}" alt="">`;

// 時間の書き方（2026-10-04 にそろえた）：「45分」「2時間」「2時間5分」。X の投稿文と絵も同じ
export const 時間に = 分 => 分 < 60 ? `${分}分` : `${Math.floor(分 / 60)}時間${分 % 60 ? (分 % 60) + "分" : ""}`;

export const 分に = ms => 時間に(Math.max(0, Math.round(ms / 60000)));

export const 待ちの画面 = 字 => `<div class="待つ"><div class="積み木">${"<i></i>".repeat(6)}</div>
  <p class="段の字">${逃(字)}</p></div>`;

// 「10月3日 21:33」の形（申請の日時など）
export const 日時に = t =>{ const d = new Date(t);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

/* ── 頁の行き来 ─────────────────────────── */
const 道の頁 = { "":"廊下", "/log":"記録", "/me":"自分", "/admin":"管理" };

const 頁の道 = { 廊下:"", 記録:"/log", 自分:"/me", 管理:"/admin" };

/* /room/{部屋} で場所を開く。
   ⚠️ しまってある場所（カフェ）は開かない（2026-10-04。前は /cafe と /room/cafe で開けた） */
export function 道を読む(){
  const 道 = location.pathname.slice(根.length).replace(/\/$/, "");
  const m = 道.match(/^\/room\/([a-z0-9-]+)$/);
  if(m && 開ける場所か(m[1])) return { 頁:"部屋", 部屋:m[1] };
  return { 頁:道の頁[道] || "廊下" };
}

export function 行く(頁, 履歴に積む = true){
  if(状態.頁 === "部屋" && 頁 !== "部屋") 土台.立つ().catch(()=>{});
  窓を閉じる();   // ページを移ったら、前のページの小さな画面は閉じる（ほかのページに残らないように）
  状態.頁 = 頁;
  const 道 = 頁 === "部屋" ? `/room/${状態.部屋}` : (頁の道[頁] ?? "");
  if(履歴に積む) history.pushState({}, "", 根 + 道 || "/");
  描く();
  scrollTo(0, 0);
}

addEventListener("popstate", ()=>{
  const { 頁, 部屋 } = 道を読む();
  if(部屋) 状態.部屋 = 部屋;
  行く(頁, false);
});

// タブを閉じるとき：この端末が座っているつもりをやめるだけ。席は消さない（ほかの端末で読んでいるかもしれない。
// どこも読んでいなければ12時間で空く）
addEventListener("pagehide", ()=>{ 土台.立つ().catch(()=>{}); });

/* ── 描く ─────────────────────────────── */
export function 描く(){
  for(const f of 状態.片づけ) f();
  状態.片づけ = [];
  帯を描く();

  if(!状態.起きた) return 画面.innerHTML = 待ちの画面("ひらいています");
  if(!状態.私) return 頁ら.入口();
  if(状態.自分 === undefined) return 画面.innerHTML = 待ちの画面("読みこんでいます");

  /* ⚠️⚠️ 作り直しのとき、押した直後はまだ裏の処理が「作っている」と書いていない。
        記録の状態（making）だけで見ると、**古いアバターの「できました」が一瞬出て、作ったばかりが消え、
        作っているあいだ何も変わらない画面になった**（2026-09-27、配信者が二度押した）。
        → 押した瞬間から返るまでは、画面の側の「頼んでいる」で「描いています」を出し続ける */
  const 自分 = 状態.自分, a = 自分?.アバター;
  if(!自分 || !a?.座る){
    if(状態.頼んでいる || a?.状態 === "making") return 頁ら.作っている();
    return 頁ら.登録();
  }
  if(状態.作ったばかり){
    if(状態.頼んでいる || a.状態 === "making") return 頁ら.作っている();
    if(a.状態 === "ready") return 頁ら.できあがり();
    状態.作ったばかり = false;
    if(a.誤り) 知らせる(a.誤り, true);
  }
  if(状態.頁 === "管理" && !状態.管理者) 状態.頁 = "廊下";
  (頁ら[状態.頁] || 頁ら.廊下)();
}

export function 帯を描く(){
  const 入った = 状態.私 && 状態.自分?.アバター?.座る;
  document.getElementById("nav").innerHTML = 入った ? [
    // 「自分」は外した。右の顔と名前のボタンが自分のページへの入口（2026-09-29 配信者）
    ["廊下", "場所"], ["記録", "記録"], ...(状態.管理者 ? [["管理", "管理"]] : []),
  ].map(([頁, 字])=>`<button class="${状態.頁 === 頁 || (頁 === "廊下" && 状態.頁 === "部屋") ? "いま" : ""}"
      data-する="行く" data-頁="${頁}">${字}</button>`).join("") : "";
  const 右 = document.getElementById("帯の右");
  // 顔と名前を1つのボタンに（Hongaeshi の「わたし」と同じ形。2026-09-27 配信者）
  if(入った) 右.innerHTML = `<button class="わたし ${状態.頁 === "自分" ? "いま" : ""}" data-する="行く" data-頁="自分" title="自分のページ">
      ${顔の絵(状態.自分)}<span class="名">${逃(状態.自分.名)}</span></button>`;
  else if(状態.起きた && !状態.私) 右.innerHTML = `<button class="釦 小" data-する="入る">${試しか ? "試しに入る" : "Google でログイン"}</button>`;
  else 右.innerHTML = "";
  絵を入れる(右);
  document.querySelector(".試用札").hidden = !試しか;
}

Object.assign(動き, {
  行く: el=>行く(el.dataset.頁),
  場所へ: el=>{ 状態.部屋 = 開ける場所か(el.dataset.部屋) ? el.dataset.部屋 : 最初の部屋; 行く("部屋"); },
  覆いの外: (el, e)=>{ if(e.target === el) 窓を閉じる(); },
  窓を閉じる,
});
