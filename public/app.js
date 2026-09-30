/* ============================================================
   GEMuの静かな読書会 ― 画面

   流れ：入口（Googleで入る）→ 名前と写真 → アバターができるのを待つ → できあがり
         → 廊下（場所の一覧）→ 場所のベンチに座る（読む本の題を入れる）
   ⚠️ 画面の中の名前は「部屋」のまま（コードの名前）。利用者に見せる言葉は「場所」。
      2026-09-27 に、神保町のカフェから「世界の、読書が気持ちよさそうな観光地」へ変えた（最初はローテンブルク）

   ⚠️ Firebase には直接さわらない。**土台.js（試しでは 試し/土台.js）だけを通す。**
   ⚠️ 押せるものは onclick に値を書かず、data-する="…" と data-* で渡す。
      値を onclick の文字列に埋めると、題や名前に ' が入ったときにスクリプトが動く
      （Hongaeshi で実際に穴だった）。
   ============================================================ */

import { 部屋ら, 部屋の絵, 出す部屋ら, 最初の部屋 } from "./部屋.js";
import { AmazonのASIN, ISBN13にする, ISBNで確かめる } from "./書誌.js";

const 試しか = location.pathname === "/demo" || location.pathname.startsWith("/demo/");
const 土台 = await import(試しか ? "./試し/土台.js" : "./土台.js");
const 根 = 試しか ? "/demo" : "";

const 画面 = document.getElementById("画面");
const 状態 = {
  起きた:false, 私:null,
  自分:undefined,          // undefined＝読み込み中／null＝まだ名前が無い
  人々:new Map(),
  席ら:[],                 // いま見ている部屋の席
  頁:"廊下", 部屋:最初の部屋,
  作ったばかり:false,
  頼んでいる:false,         // 作る を押してから、裏の処理が返るまで
};
let 片づけ = [];           // 頁を離れるときに止めるもの（見張り・時計）
let 自分の見張り = null, 人々の見張り = null;
let 向きを確かめた = false;

/* ── 小さな道具 ─────────────────────────── */
const 逃 = s => String(s ?? "").replace(/[&<>"']/g, c=>({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

function 知らせる(文, 悪い=false){
  document.querySelector(".知らせ")?.remove();
  const d = document.createElement("div");
  d.className = "知らせ" + (悪い ? " 悪い" : "");
  d.textContent = 文;
  document.body.appendChild(d);
  setTimeout(()=>d.remove(), 3800);
}

function 窓を出す(題, 中){
  document.getElementById("窓").innerHTML = `
  <div class="覆い" data-する="覆いの外">
    <div class="窓" role="dialog" aria-label="${逃(題)}">
      <div class="窓の頭"><h3>${逃(題)}</h3>
        <button class="閉じる" data-する="窓を閉じる" aria-label="閉じる">✕</button></div>
      <div class="窓の中">${中}</div>
    </div></div>`;
  document.querySelector("#窓 input")?.focus();
}
const 窓を閉じる = () =>{ document.getElementById("窓").innerHTML = ""; 本窓 = null; };   // 本の窓の状態も消す（読み込みのあとで開き直らないように）

// 絵の道（Storage の場所）から URL を引いて、img[data-道] に入れる
const URLの控え = new Map();
function 絵を入れる(根の要素 = document){
  for(const img of 根の要素.querySelectorAll("img[data-道]")){
    const 道 = img.dataset.道;
    if(!道) continue;
    if(URLの控え.has(道)){ img.src = URLの控え.get(道); continue; }
    土台.絵のURL(道).then(u=>{ URLの控え.set(道, u); img.src = u; }).catch(()=>{});
  }
}
const 顔の絵 = (人, 大きさ = "") =>
  `<img class="顔 ${大きさ}" data-道="${逃(人?.アバター?.顔 || "")}" alt="">`;

function 分に(ms){
  const 分 = Math.max(0, Math.round(ms / 60000));
  if(分 < 60) return `${分}分`;
  return `${Math.floor(分 / 60)}時間${分 % 60 ? (分 % 60) + "分" : ""}`;
}

/* ── 頁の行き来 ─────────────────────────── */
const 道の頁 = { "":"廊下", "/log":"記録", "/me":"自分", "/admin":"管理" };
const 頁の道 = { 廊下:"", 記録:"/log", 自分:"/me", 管理:"/admin" };

// /room/{部屋} で場所を開く。⚠️ /cafe は最初の形の名残り（カフェを開く）
function 道を読む(){
  const 道 = location.pathname.slice(根.length).replace(/\/$/, "");
  const m = 道.match(/^\/room\/([a-z0-9-]+)$/) || (道 === "/cafe" ? [0, "cafe"] : null);
  if(m && 部屋ら[m[1]]) return { 頁:"部屋", 部屋:m[1] };
  return { 頁:道の頁[道] || "廊下" };
}

function 行く(頁, 履歴に積む = true){
  if(状態.頁 === "部屋" && 頁 !== "部屋") 土台.立つ().catch(()=>{});
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
// タブを閉じるときに席を立つ（届かないこともある。そのときは3分で空き扱いになる）
addEventListener("pagehide", ()=>{ 土台.立つ().catch(()=>{}); });

/* ── 描く ─────────────────────────────── */
function 描く(){
  for(const f of 片づけ) f();
  片づけ = [];
  帯を描く();

  if(!状態.起きた) return 画面.innerHTML = 待ちの画面("ひらいています");
  if(!状態.私) return 入口();
  if(状態.自分 === undefined) return 画面.innerHTML = 待ちの画面("読みこんでいます");

  /* ⚠️⚠️ 作り直しのとき、押した直後はまだ裏の処理が「作っている」と書いていない。
        記録の状態（making）だけで見ると、**古いアバターの「できました」が一瞬出て、作ったばかりが消え、
        作っているあいだ何も変わらない画面になった**（2026-09-27、配信者が二度押した）。
        → 押した瞬間から返るまでは、画面の側の「頼んでいる」で「描いています」を出し続ける */
  const 自分 = 状態.自分, a = 自分?.アバター;
  if(!自分 || !a?.座る){
    if(状態.頼んでいる || a?.状態 === "making") return 作っている();
    return 登録();
  }
  if(状態.作ったばかり){
    if(状態.頼んでいる || a.状態 === "making") return 作っている();
    if(a.状態 === "ready") return できあがり();
    状態.作ったばかり = false;
    if(a.誤り) 知らせる(a.誤り, true);
  }
  if(状態.頁 === "管理" && !状態.管理者) 状態.頁 = "廊下";
  ({ 廊下, 部屋:部屋の頁, 記録:記録の頁, 自分:自分の頁, 管理:管理の頁 }[状態.頁] || 廊下)();
}

function 帯を描く(){
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
  else if(状態.起きた && !状態.私) 右.innerHTML = `<button class="釦 小" data-する="入る">${試しか ? "試しに入る" : "Google で入る"}</button>`;
  else 右.innerHTML = "";
  絵を入れる(右);
  document.querySelector(".試用札").hidden = !試しか;
}

const 待ちの画面 = 字 => `<div class="待つ"><div class="積み木">${"<i></i>".repeat(6)}</div>
  <p class="段の字">${逃(字)}</p></div>`;

/* ── 入口 ─────────────────────────────── */
function 入口(){
  const 部屋 = 部屋ら[最初の部屋];
  画面.innerHTML = `
  <div class="看板"><div class="舞台" style="aspect-ratio:${部屋.比}"><img class="背景" src="${部屋の絵(部屋)}" alt="${逃(部屋.名)}">${人とベンチ(部屋, [])}</div></div>
  <section class="幕">
    <p class="英字の札">GEMu Dokusho</p>
    <h1 class="大見出し">家にいながら、<br>景色のいい場所で読む。</h1>
    <p class="導き">誰にも邪魔されずに、ひとりで静かに本を読むのが好き。でも、景色のいいところで読むのにも、ちょっと憧れている。インドア派だから、なかなか行けないけれど。</p>
    <p class="導き" style="margin-top:10px">ここでは、自分の姿をブロックにして、世界の、読書が気持ちよさそうな場所のベンチに座ります。話さなくていい。となりのベンチでも、だれかが自分の本を読んでいます。最初の場所は、ドイツのローテンブルクです。</p>
    <div class="釦たち" style="margin-top:30px">
      <button class="釦" data-する="入る">${試しか ? "試しに入る" : "Google で入る"}</button>
    </div>
    <p class="注">${試しか
      ? "これは試しです。この端末のブラウザの中だけで動きます。タブを2つ開くと、2人で入れます。"
      : "はじめて入るときに、名前と写真を決めます。"}</p>
  </section>`;
}

/* ── 名前と写真 ─────────────────────────── */
let 選んだ写真 = null;   // 縮めた data URL

function 写真の欄(){
  return `
    <label class="名札">自分の写真か、絵</label>
    <div class="写真の枠">
      ${選んだ写真 ? `<img class="写真の見本" src="${選んだ写真}" alt="">` : `<div class="写真の見本">まだです</div>`}
      <div>
        <label class="釦 枠だけ 小">写真を選ぶ<input type="file" accept="image/*" data-する="写真"></label>
        <p class="注" style="margin-top:8px">自分の写真でも、好きなキャラクターの絵でも。写っているものを、そのままブロックの姿にします。</p>
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
    <p class="導き">名前と写真を決めると、写真をもとに、ブロックの姿のアバターを作ります。</p>
    <label class="名札" for="名の欄">名前（ベンチの名札に出ます）</label>
    <input id="名の欄" class="欄" maxlength="20" placeholder="例：しおり" value="${逃(状態.自分?.名 || "")}">
    ${写真の欄()}
    ${誤り ? `<p class="誤りの字">${逃(誤り)}</p>` : ""}
    <div class="釦たち" style="margin-top:30px">
      <button class="釦 藤" data-する="はじめて作る">アバターを作る</button>
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
    <p class="注">4枚描くので、1〜2分かかります。<br>このページを閉じても、描き続けます。できたら、次に開いたときに出ます。</p>
  </div>`;
}

function できあがり(){
  const a = 状態.自分.アバター;
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Your avatar</p>
    <h1 class="中見出し">できました</h1>
    <p class="導き">奥の席では顔が、手前の席では背中が見えます。ときどき、ページをめくります。</p>
    ${三枚(a)}
    <div class="釦たち" style="margin-top:30px">
      <button class="釦" data-する="場所へ" data-部屋="${最初の部屋}">${逃(部屋ら[最初の部屋].名)}へ</button>
      <button class="釦 枠だけ" data-する="行く" data-頁="自分">作り直す</button>
    </div>
  </section>`;
  状態.作ったばかり = false;
  絵を入れる(画面);
}

const 三枚 = a => `<div class="三枚">
  <figure><img data-道="${逃(a.座る)}" alt="座って読む姿"><figcaption>座って読む（奥の席）</figcaption></figure>
  <figure><img data-道="${逃(a.めくる)}" alt="ページをめくる姿"><figcaption>ページをめくる</figcaption></figure>
  <figure>${a.背中 ? `<img data-道="${逃(a.背中)}" alt="後ろから見た姿">` : `<div class="まだ">まだありません</div>`}
    <figcaption>背中（手前の席）</figcaption></figure>
  <figure><img data-道="${逃(a.顔)}" alt="顔"><figcaption>顔</figcaption></figure>
</div>`;

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
      <button class="部屋の札" data-する="場所へ" data-部屋="${id}">
        <div class="小さな舞台"><div class="舞台" id="小舞台-${id}" style="border:none;aspect-ratio:${部屋.比}"><img class="背景" src="${部屋の絵(部屋)}" alt="">${人とベンチ(部屋, [])}</div></div>
        <div>
          <div class="部屋の名">${逃(部屋.名)}</div>
          <div class="部屋の素性" id="居る数-${id}">${逃(部屋.添え)}</div>
          <div class="顔の列" id="顔の列-${id}"></div>
        </div>
        <span class="釦 小 枠だけ 入口の釦" id="札-${id}">ここで読む →</span>
      </button>`).join("")}
    </div>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">読み方は、人それぞれ</h2><p class="節の添え">これまでの全部</p></div>
    <p class="注">競うものではありません。たくさんの本を読む人、厚い本を読む人、長い時間をかける人。いろいろな読み方の人がいます。</p>
    <div class="読み方" id="読み方">${待ちの画面("数えています")}</div>
  </section>`;
  読み方を描く();
  // 誰がいるかを出す
  for(const [id, 部屋] of 出す部屋ら()){
    片づけ.push(土台.席を見張る(id, 席ら=>{
      const 数 = document.getElementById(`居る数-${id}`), 列 = document.getElementById(`顔の列-${id}`);
      if(!数) return;
      const 満席 = 席ら.length >= 部屋.席.length;
      数.textContent = 満席 ? `いまは満席です（${部屋.席.length}人）。のぞいて、ベンチが空くのを待つことはできます`
        : 席ら.length ? `いま${席ら.length}人が読んでいます（${部屋.席.length}席）` : `いまは誰もいません（${部屋.席.length}席）`;
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

/* 読み方は、人それぞれ（2026-09-29 配信者）。
   ⚠️ 順位の数字は付けない。3つの列を横に並べ、どれが上ということもない形にする */
async function 読み方を描く(){
  let r;
  try{ r = await 土台.読み方を読む(); }catch(e){ console.error(e); r = null; }
  const 置き場 = document.getElementById("読み方");
  if(!置き場) return;
  if(!r) return 置き場.innerHTML = `<p class="注">いまは数えられませんでした。</p>`;
  const 時間に = 分 => 分 >= 60 ? `${Math.floor(分 / 60)}時間${分 % 60 ? (分 % 60) + "分" : ""}` : `${分}分`;
  const 列 = (見出し, 人ら, 単位) => `
    <div class="読み方の列">
      <h3>${見出し}</h3>
      ${人ら.length ? 人ら.map(x=>`<div class="読み方の人">${顔の絵({ アバター:{ 顔:x.顔 } }, "中")}
        <span class="名">${逃(x.名)}</span><span class="数">${単位(x.数)}</span></div>`).join("")
        : `<p class="注">まだだれもいません</p>`}
    </div>`;
  置き場.innerHTML =
    列("たくさんの本を", r.冊, n=>`${n}冊`) +
    列("たくさんのページを", r.ページ, n=>`${n.toLocaleString()}ページ`) +
    列("長い時間を", r.分, 時間に);
  絵を入れる(置き場);
}

/* ── 部屋 ─────────────────────────────── */
function 部屋の頁(){
  if(!部屋ら[状態.部屋]) 状態.部屋 = 最初の部屋;
  const 部屋 = 部屋ら[状態.部屋];
  画面.innerHTML = `
  <section class="幕" style="padding-top:34px">
    <p class="英字の札">${逃(部屋.英字)}</p>
    <h1 class="中見出し">${逃(部屋.名)}</h1>
    <p class="導き">${逃(部屋.添え)}</p>
  </section>
  <section class="節" style="padding-top:22px">
    <p class="気配" id="気配"></p>
    <div class="舞台" id="舞台" style="aspect-ratio:${部屋.比}"><img class="背景" src="${部屋の絵(部屋)}" alt="${逃(部屋.名)}の部屋"></div>
    <div id="手もと"></div>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">いま読んでいる人</h2><p class="節の添え" id="居る数"></p></div>
    <div class="居る列" id="居る列"></div>
  </section>`;

  /* ⚠️ 本の題を聞く窓は、席の様子が届いてから出す（満席なら出さない）。
        前は開いた瞬間に出していて、9人目にも題を聞き、座ろうとしたところで「満席です」と断っていた */
  状態.席ら = [];
  let 初めて = true;
  片づけ.push(土台.席を見張る(状態.部屋, 席ら=>{
    const 前は満席 = 満席か();
    状態.席ら = 席ら;
    部屋を描き直す();
    if(土台.座っている()) return;
    if(初めて){
      初めて = false;
      if(!満席か()) 題の窓("席に着く");
    }else if(前は満席 && !満席か()){
      知らせる("ベンチがひとつ空きました");
      if(document.hidden) document.title = "ベンチが空きました ― " + 元の題名;
    }else if(!前は満席 && 満席か() && document.getElementById("題の欄")){
      // 題を入れているあいだに、最後のベンチが埋まった
      窓を閉じる();
      知らせる("ちょうど今、最後のベンチが埋まりました", true);
    }
  }));

  // ときどきページをめくる
  const めくり = setInterval(()=>{
    for(const el of document.querySelectorAll("#舞台 .人:not(.空き)")){
      if(Math.random() < .28){
        el.classList.add("めくり中");
        setTimeout(()=>el.classList.remove("めくり中"), 1300);
      }
    }
  }, 3500);
  // 1分ごとに「まだいます」を送る。読んだ時間の表示も直す
  const 生きる = setInterval(()=>{ 土台.生きている().catch(()=>{}); }, 60000);
  const 時計 = setInterval(手もとを描く, 30000);
  片づけ.push(()=>{ clearInterval(めくり); clearInterval(生きる); clearInterval(時計); });

}

const 満席か = () => 状態.席ら.length >= (部屋ら[状態.部屋]?.席.length || 0);
const 元の題名 = document.title;
addEventListener("visibilitychange", ()=>{ if(!document.hidden) document.title = 元の題名; });

const 置き = (席, 幅) => `left:${席.x}%;top:${席.y}%${幅 ? `;width:${席.幅}%` : ""}`;

/* 場所の絵の上に置く、空のベンチと座っている人（名札は無し）。
   場所の中の舞台と、一覧の小さな絵・入口の看板で同じものを使う（2026-09-29 配信者：サムネイルにもベンチを） */
function 人とベンチ(部屋, 席ら){
  const 座られた = new Set(席ら.map(s=>s.番));
  // 誰も座っていない席には、空のベンチを置く（場所に 空き の絵があるときだけ）。絵の向きは 空きの向き
  const 空きの絵 = 部屋.空き ? 部屋.席.map((席, 番)=>座られた.has(番) ? "" : `
    <div class="人 空き ${空きを反転するか(部屋, 席) ? "左向き" : ""}" style="${置き(席, true)}">
      <div class="姿"><img class="座る" src="${部屋.空き[席.姿] || 部屋.空き.顔}" alt=""></div>
    </div>`).join("") : "";
  // 奥（y が小さい）から描いて、手前の人が上に重なるようにする
  const 並び = [...席ら].sort((a, b)=>(部屋.席[a.番]?.y || 0) - (部屋.席[b.番]?.y || 0));
  return 空きの絵 + 並び.map(s=>{
    const 席 = 部屋.席[s.番];
    if(!席) return "";
    const 人 = 状態.人々.get(s.uid), a = 人?.アバター || {};
    // 手前の席は背中を見せる。背中の絵がまだ無い人は、顔の絵のまま座る（めくる動きは背中では見えないので同じ絵）
    const 背中 = 席.姿 === "背中" && !!a.背中;
    return `
    <div class="人 ${反転するか(人, 席, 背中) ? "左向き" : ""}" style="${置き(席, true)}">
      <div class="姿">
        <img class="座る" data-道="${逃(背中 ? a.背中 : a.座る)}" alt="">
        <img class="めくる" data-道="${逃(背中 ? a.背中 : a.めくる)}" alt="">
      </div>
    </div>`;
  }).join("");
}

function 部屋を描き直す(){
  const 舞台 = document.getElementById("舞台");
  if(!舞台) return;
  const 部屋 = 部屋ら[状態.部屋];
  // 奥（y が小さい）から描いて、手前の人が上に重なるようにする
  const 並び = [...状態.席ら].sort((a, b)=>(部屋.席[a.番]?.y || 0) - (部屋.席[b.番]?.y || 0));
  const 背景 = 舞台.querySelector("img.背景").outerHTML;
  const 座られた = new Set(状態.席ら.map(s=>s.番));
  // ⚠️ 名札は人の絵と別の層にして、最後に重ねる。人の中に入れると、手前の人が奥の人の名札を隠す
  舞台.innerHTML = 背景 + 人とベンチ(部屋, 状態.席ら) + 並び.map(s=>{
    const 席 = 部屋.席[s.番];
    if(!席) return "";
    // 同じベンチに2人いるときは、2人目の名札を1段下げる（横に振り分けると、隣のブロックの名札とぶつかった）
    const 下段 = 席.隣 && 座られた.has(席.相方) ? "下段" : "";
    // tabindex：スマホでは押すと全文が出る（:focus）。パソコンは指を乗せると出る（:hover）
    return `<div class="名の札 ${s.uid === 状態.私.uid ? "自分" : ""} ${下段}" style="${置き(席)}" tabindex="0">
      <b>${逃(状態.人々.get(s.uid)?.名 || "…")}</b>${s.題 ? `<span>『${逃(s.題)}』</span>` : ""}</div>`;
  }).join("");
  絵を入れる(舞台);

  document.getElementById("居る数").textContent = `${状態.席ら.length} / ${部屋.席.length}席`;
  // 部屋の気配。数を誇らず、静かに一行だけ
  const 人数 = 状態.席ら.length, 自分も = 状態.席ら.some(s=>s.uid === 状態.私.uid);
  document.getElementById("気配").textContent =
    人数 === 0 ? "いまは、だれもいません。" :
    人数 === 1 && 自分も ? "いまは、ひとりで読んでいます。だれかが来るかもしれません。" :
    `いま、${人数}人が、それぞれの本をひらいています。`;
  const 列 = document.getElementById("居る列");
  列.innerHTML = 状態.席ら.length ? 状態.席ら.map(s=>{
    const 人 = 状態.人々.get(s.uid);
    return `<div class="居る">${顔の絵(人, "中")}
      <span class="名">${逃(人?.名 || "…")}</span>
      <span class="題">${s.題 ? `『${逃(s.題)}』` : `<span class="注">（題は出していません）</span>`}</span>
      <span class="時">${分に(Date.now() - s.入った)}</span></div>`;
  }).join("") : `<p class="注">まだ誰もいません。</p>`;
  絵を入れる(列);
  手もとを描く();
}

/* 席の向き（テーブルの方）と、絵の向きが違えば左右を反転する。
   ⚠️ 絵は「右前を向く」と頼んでも左を向くことがあるので、描いたあとに見た向き（アバター.向き）を使う。
      本人が「向きを反対にする」を押していたら、さらに逆にする */
// 空のベンチの絵の向き（部屋.空きの向き。書いていなければ右）と、席の向きが違えば反転する
function 空きを反転するか(部屋, 席){
  const 絵の向き = 部屋.空きの向き?.[席.姿] || "右";
  return 絵の向き !== 席.向き;
}

function 反転するか(人, 席, 背中){
  const a = 人?.アバター || {};
  if(背中) return (a.背中の向き === "left" ? "左" : "右") !== 席.向き;
  let 絵の向き = a.向き === "left" ? "左" : "右";
  if(人?.反転) 絵の向き = 絵の向き === "左" ? "右" : "左";
  return 絵の向き !== 席.向き;
}

function 手もとを描く(){
  const el = document.getElementById("手もと");
  if(!el) return;
  const 席 = 土台.座っている();
  if(!席){
    const 部屋 = 部屋ら[状態.部屋];
    el.innerHTML = 満席か() ? `<div class="手もと">
      <div class="何を"><div class="書名">ベンチが空くのを待っています</div>
        <div class="時">いまは${部屋.席.length}人ぶんのベンチが、すべて埋まっています。空いたら、ここでお知らせします。<br>それまでは、のぞいて待つことができます。</div></div>
      <button class="釦" disabled>満席です</button></div>`
    : `<div class="手もと">
      <div class="何を"><div class="時">いまはのぞいているだけです</div></div>
      <button class="釦" data-する="席に着く">ベンチに座る</button></div>`;
    return;
  }
  const 題 = 状態.席ら.find(s=>s.uid === 状態.私.uid)?.題 ?? "";
  el.innerHTML = `<div class="手もと">
    ${顔の絵(状態.自分, "中")}
    <div class="何を"><div class="書名">${題 ? `『${逃(題)}』` : "題は名札に出していません"}</div>
      <div class="時">読みはじめて ${分に(Date.now() - 席.入った)}</div></div>
    <div class="釦たち">
      <button class="釦 枠だけ 小" data-する="本を替える">本を替える</button>
      <button class="釦 小" data-する="読み終える">読み終える</button>
    </div></div>`;
  絵を入れる(el);
}

/* ── 本の窓 ─────────────────────────────
   入室（と本を替える）のとき（2026-09-29 配信者）：
     1. 題を名札に出すか、出さないかを選ぶ
     2. 出すなら、登録済みの本から選ぶ（書名か著者名で絞り込む）
     3. 無ければ申請する。申請した本は**仮登録**。**申請した本人は、仮登録のままその題で座れる**。
        管理者が承認すると**本登録**になり、みんなが選べるようになる
   ⚠️ 前は題を自由に打ち込んでいた。同じ本が表記ゆれで別の本になるのを防ぐため、登録済みから選ぶ形にした */
let 本窓 = null;   // { やること, 出す, 本ら, 選んだ, 探す, 申請, 送信中 }
const 前の本 = () =>{ try{ return localStorage.getItem("gemuの前の本") || ""; }catch{ return ""; } };
const 本の見出し = b => [b.著, b.版元].filter(Boolean).join("／") + (b.状態 === "仮登録" ? "（仮登録）" : "");

async function 題の窓(やること){
  const w = 本窓 = { やること, 出す:true, 本ら:null, 選んだ:null, 探す:"", 申請:false, 送信中:false };
  本の窓を描く();
  let 本ら;
  try{ 本ら = await 土台.本らを読む(); }
  catch(e){ console.error(e); 本ら = []; }
  // ⚠️ 読み終える前に窓が閉じられた（先に座った・✕を押した）なら、何もしない
  if(本窓 !== w) return;
  w.本ら = 本ら;
  w.選んだ = 本ら.find(b=>b.id === 前の本()) || null;
  本の窓を描く();
}

function 本の候補(){
  const w = 本窓;
  if(w.本ら === null) return 待ちの画面("本棚を読んでいます");
  const 語 = w.探す.trim().toLowerCase();
  const 候補 = w.本ら.filter(b=>!語 || (b.題 + " " + (b.副題 || "") + " " + b.著).toLowerCase().includes(語))
    .sort((a, b)=>a.題.localeCompare(b.題, "ja")).slice(0, 50);
  if(!候補.length) return `<p class="注">見つかりません。</p>`;
  return 候補.map(b=>`<button class="本の候補の札 ${w.選んだ?.id === b.id ? "いま" : ""}" data-する="本を選ぶ" data-本="${逃(b.id)}">
    <b>『${逃(b.題)}』</b><span>${逃(本の見出し(b))}</span></button>`).join("");
}

function 本の窓を描く(){
  const w = 本窓;
  if(!w) return;
  const 座る = w.やること === "席に着く";
  if(w.申請) return 窓を出す("本の登録を申請する", `
    <p class="窓の文" style="font-size:14px">一覧に無い本を教えてください。管理者が確かめてから<b>本登録</b>にします。
      それまでは<b>仮登録</b>ですが、申請したあなたは、この題ですぐに${座る ? "座れます" : "替えられます"}。</p>
    ${/* Amazon のリンク・ISBN から書誌を引く（Hongaeshi の申請の窓と同じ。2026-09-30 配信者） */ ""}
    <label class="名札" for="申amazon">Amazon の URL（任意・ここから書誌を引けます）</label>
    <div class="欄と釦">
      <input id="申amazon" class="欄" placeholder="https://www.amazon.co.jp/…/dp/4166612476">
      <button class="釦 枠だけ 小" data-する="Amazonから読む">読み取る</button>
    </div>
    <p class="注">紙の本の URL なら、書名・著者名・出版社名を自動で入れます。短縮リンク（amzn.to/… など）は、一度開いて出てきた URL を貼ってください。<b>リンク自体は保存しません。</b></p>
    <label class="名札" for="申isbn">ISBN（わかれば。あると確実です）</label>
    <div class="欄と釦">
      <input id="申isbn" class="欄" maxlength="20" inputmode="numeric" placeholder="9784166612475">
      <button class="釦 枠だけ 小" data-する="ISBNを確かめる">確かめる</button>
    </div>
    <div id="申請の確認"></div>
    <label class="名札" for="申題">書名（必須）</label>
    <input id="申題" class="欄" maxlength="120" value="${逃(w.探す)}">
    <label class="名札" for="申著">著者名（必須）</label>
    <input id="申著" class="欄" maxlength="80">
    <label class="名札" for="申版元">出版社名（必須）</label>
    <input id="申版元" class="欄" maxlength="80">
    <label class="名札" for="申ひとこと">ひとこと（任意）</label>
    <input id="申ひとこと" class="欄" maxlength="300" placeholder="例）文庫版です">
    <p class="注">書名だけでは別の本と取り違えるので、著者名と出版社名もお願いしています。</p>
    <div class="釦たち" style="margin-top:20px">
      <button class="釦 全幅" data-する="申請して決める" ${w.送信中 ? "disabled" : ""}>${w.送信中 ? "送っています…" : 座る ? "申請して、この本で座る" : "申請して、この本に替える"}</button>
      <button class="釦 枠だけ 全幅" data-する="申請をとじる">一覧に戻る</button>
    </div>`);
  窓を出す(座る ? "いま読む本" : "本を替える", `
    <div class="出すか">
      <label><input type="radio" name="出すか" value="出す" ${w.出す ? "checked" : ""}> 読んでいる本の題を、名札に出す</label>
      <label><input type="radio" name="出すか" value="伏せる" ${w.出す ? "" : "checked"}> 題は出さない（名札は名前だけ）</label>
    </div>
    ${w.出す ? `
      <label class="名札" for="本をさがす">本をさがす</label>
      <input id="本をさがす" class="欄" placeholder="書名か著者名（Amazon の URL も貼れます）" value="${逃(w.探す)}" autocomplete="off">
      <div class="本の候補" id="本の候補">${本の候補()}</div>
      <p class="注">一覧に無いときは、<a data-する="申請をひらく">本の登録を申請する</a>（Amazon の URL から書誌を自動で入れられます）</p>` : ""}
    <div class="釦たち" style="margin-top:20px">
      <button class="釦 全幅" data-する="題を決める" ${w.出す && !w.選んだ ? "disabled" : ""}>${座る ? "ベンチに座る" : "替える"}</button>
    </div>`);
}

/* ISBN から書誌を引いて、申請の欄に入れる。
   ⚠️ 窓ごと描き直さない（打ちかけの欄が消える）。欄の値だけを入れ替え、結果は #申請の確認 に出す。
   ⚠️ 確かめた ISBN の本が、もう本棚にあれば知らせて、その本を選べるようにする（Hongaeshi と同じ。二重の申請を減らす） */
async function 書誌を入れる(isbn){
  const 確認 = document.getElementById("申請の確認");
  const 出す = html =>{ if(確認) 確認.innerHTML = html; };
  出す(`<p class="注">さがしています…</p>`);
  const 十三 = ISBN13にする(isbn);
  const 棚の本 = 十三 && 本窓?.本ら?.find(b=>ISBN13にする(b.isbn) === 十三);
  if(棚の本) return 出す(`<div class="申請の知らせ"><b>この本は、もう本棚にあります。</b><br>
    『${逃(棚の本.題)}』 ${逃(本の見出し(棚の本))}
    <div class="釦たち" style="margin-top:8px"><button class="釦 枠だけ 小" data-する="棚の本を選ぶ" data-本="${逃(棚の本.id)}">この本を選ぶ</button></div></div>`);
  const r = await ISBNで確かめる(isbn);
  if(!r) return 出す(`<p class="注" style="color:var(--誤り)">その ISBN の書誌は見つかりませんでした。下に手で書いてください。</p>`);
  const 入れる = (id, v)=>{ const e = document.getElementById(id); if(e && v) e.value = v; };
  入れる("申題", r.題); 入れる("申著", r.著); 入れる("申版元", r.版元); 入れる("申isbn", r.isbn);
  if(本窓) 本窓.申請のページ = r.ページ || 0;
  出す(`<div class="申請の知らせ">見つかりました。書名・著者名・出版社名を入れました。<br>
    <b>『${逃(r.題)}』</b> ${逃(r.著)}／${逃(r.版元)}${r.年 ? `・${逃(r.年)}` : ""}${r.ページ ? `・${r.ページ}ページ` : ""}</div>`);
}

async function 本で決める(el){
  const w = 本窓;
  if(!w) return;
  if(w.出す && !w.選んだ) return 知らせる("本を選んでください", true);
  const 題 = w.出す ? w.選んだ.題 : "", 本 = w.出す ? w.選んだ.id : "";
  状態.いまの本 = w.出す ? w.選んだ : null;   // 読了のときに総ページ数をはじめから入れるため
  try{ if(本) localStorage.setItem("gemuの前の本", 本); }catch{}
  if(el) el.disabled = true;
  try{
    if(w.やること === "席に着く") await 土台.座る(状態.部屋, 題, 部屋ら[状態.部屋].席.length, 本);
    else await 土台.題を替える(題, 本);
    本窓 = null;
    窓を閉じる();
    手もとを描く();
  }catch(e){
    console.error(e);
    if(el) el.disabled = false;
    if(e.message === "満席です"){
      本窓 = null;
      窓を閉じる();
      手もとを描く();
      知らせる("ちょうど今、最後のベンチが埋まりました。空いたら、お知らせします", true);
    }else 知らせる("席に着けませんでした", true);
  }
}

// 本をさがす欄は、打つたびに候補だけを描き直す（窓ごと描き直すと、打っている字の位置が飛ぶ）
document.addEventListener("input", e=>{
  if(e.target.id !== "本をさがす" || !本窓) return;
  本窓.探す = e.target.value;
  const 候補 = document.getElementById("本の候補");
  if(!候補) return;
  if(/amazon\.|amzn\.|\/dp\//i.test(本窓.探す)) return Amazonで探す(本窓.探す, 候補);
  候補.innerHTML = 本の候補();
});

/* 本をさがす欄に Amazon の URL が貼られたとき（2026-09-30 配信者「Amazon のリンクはどこで入れられますか？」）。
   本棚にあればその本を1冊だけ候補に出す。無ければ「この本を申請する」を出し、押すと書誌の入った申請の窓を開く */
async function Amazonで探す(url, 候補){
  if(/link\.amazon|amzn\.to|amzn\.asia/.test(url))
    return 候補.innerHTML = `<p class="注">短縮リンクは辿れません。一度開いて、出てきた URL を貼ってください。</p>`;
  const asin = AmazonのASIN(url), isbn = asin && ISBN13にする(asin);
  if(!isbn) return 候補.innerHTML = `<p class="注">${asin ? "Kindle 版などは書誌を引けません。紙の本の URL を貼ってください。" : "Amazon の URL から商品番号を読み取れませんでした。"}</p>`;
  const 棚の本 = 本窓.本ら?.find(b=>ISBN13にする(b.isbn) === isbn);
  if(棚の本){
    本窓.選んだ = 棚の本;
    候補.innerHTML = `<button class="本の候補の札 いま" data-する="本を選ぶ" data-本="${逃(棚の本.id)}">
      <b>『${逃(棚の本.題)}』</b><span>${逃(本の見出し(棚の本))}</span></button>`;
    const 釦 = document.querySelector("[data-する=題を決める]");
    if(釦) 釦.disabled = false;
    return;
  }
  候補.innerHTML = `<p class="注">本棚にはまだありません。さがしています…</p>`;
  const r = await ISBNで確かめる(isbn);
  if(本窓?.探す !== url) return;   // 待つあいだに打ち直された
  候補.innerHTML = `<div class="申請の知らせ" style="margin:10px 0">本棚にはまだありません。
    ${r ? `<br><b>『${逃(r.題)}』</b> ${逃(r.著)}／${逃(r.版元)}` : ""}
    <div class="釦たち" style="margin-top:8px"><button class="釦 小" data-する="URLで申請をひらく" data-isbn="${isbn}">この本を申請する</button></div></div>`;
}
document.addEventListener("change", e=>{
  if(e.target.name !== "出すか" || !本窓) return;
  本窓.出す = e.target.value === "出す";
  本の窓を描く();
});

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
  try{ [記録, 読了ら] = await Promise.all([土台.記録を読む(), 土台.読了を読む().catch(()=>[])]); }
  catch(e){ console.error(e); 記録 = null; }
  const 中 = document.getElementById("記録の中");
  if(!中) return;
  if(!記録) return 中.innerHTML = `<p class="誤りの字">記録を読めませんでした。</p>`;

  const 長さ = r => Math.max(0, r.終わり - r.始め);
  const 今日の始め = new Date(); 今日の始め.setHours(0, 0, 0, 0);
  const 計 = 条件 => 記録.filter(条件).reduce((s, r)=>s + 長さ(r), 0);
  const 日付 = t => { const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  const 数字 = (名, ms) =>{
    const 分 = Math.round(ms / 60000);
    return `<div class="数字"><div class="名">${名}</div>
      <div class="値">${分 >= 60 ? `${Math.floor(分 / 60)}<small>時間</small>${分 % 60}<small>分</small>` : `${分}<small>分</small>`}</div></div>`;
  };
  中.innerHTML = `
    <div class="数字たち">
      ${数字("Today", 計(r=>r.始め >= 今日の始め.getTime()))}
      ${数字("7 days", 計(r=>r.始め >= Date.now() - 7 * 86400000))}
      ${数字("All", 計(()=>true))}
    </div>
    <div class="数字たち" style="margin-top:0;border-top:none">
      <div class="数字"><div class="名">Books</div><div class="値">${読了ら.length}<small>冊</small></div></div>
      <div class="数字"><div class="名">Pages</div><div class="値">${読了ら.reduce((s, r)=>s + (r.ページ || 0), 0).toLocaleString()}<small>ページ</small></div></div>
      <div class="数字"></div>
    </div>
    <p class="注">冊数とページ数は、「読み終える」で「この本を最後まで読んだ」に印を付けた本だけを数えます。</p>
    <section class="節">
      <div class="節の頭"><h2 class="節見出し">これまで</h2><p class="節の添え">${記録.length}回</p></div>
      <div class="記録の列">
        ${記録.length ? 記録.map(r=>`<div class="記録">
          <span class="日">${日付(r.始め)}</span>
          <span class="題">『${逃(r.題)}』</span>
          <span class="分">${分に(長さ(r))}</span></div>`).join("")
          : `<p class="注">まだありません。ベンチに座ると、ここに残ります。</p>`}
      </div>
    </section>`;
}

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
    <div id="申請の列">${待ちの画面("読んでいます")}</div>
  </section>`;
  let 申請ら;
  try{ 申請ら = await 土台.申請らを読む(); }catch(e){ console.error(e); 申請ら = null; }
  const 列 = document.getElementById("申請の列");
  if(!列) return;
  if(!申請ら) return 列.innerHTML = `<p class="誤りの字">読めませんでした。</p>`;
  if(!申請ら.length) return 列.innerHTML = `<p class="注" style="margin-top:24px">いま、申請はありません。</p>`;
  列.innerHTML = `<div class="申請の列">${申請ら.map(b=>`
    <div class="申請">
      <div class="申請の素性">申請：${逃(状態.人々.get(b.申請者)?.名 || "（名前なし）")}
        ${b.isbn ? `／ISBN ${逃(b.isbn)}` : ""}${b.ひとこと ? `／「${逃(b.ひとこと)}」` : ""}</div>
      <label class="名札">書名</label><input class="欄" id="管題-${逃(b.id)}" maxlength="120" value="${逃(b.題)}">
      <label class="名札">著者名</label><input class="欄" id="管著-${逃(b.id)}" maxlength="80" value="${逃(b.著)}">
      <label class="名札">出版社名</label><input class="欄" id="管版元-${逃(b.id)}" maxlength="80" value="${逃(b.版元)}">
      ${b.isbn ? `<div class="釦たち" style="margin-top:10px">
        <button class="釦 枠だけ 小" data-する="書誌を引き直す" data-本="${逃(b.id)}" data-isbn="${逃(b.isbn)}">ISBN から書誌を引き直す</button></div>
        <div id="管確認-${逃(b.id)}"></div>` : ""}
      <div class="釦たち" style="margin-top:14px">
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
  if(!r){ if(確認) 確認.innerHTML = `<p class="注" style="color:var(--誤り)">書誌は見つかりませんでした。</p>`; return; }
  const 入れる = (k, v)=>{ const e = document.getElementById(`${k}-${id}`); if(e && v) e.value = v; };
  入れる("管題", r.題); 入れる("管著", r.著); 入れる("管版元", r.版元);
  if(確認) 確認.innerHTML = `<p class="注">openBD の書誌を入れました：『${逃(r.題)}』 ${逃(r.著)}／${逃(r.版元)}${r.ページ ? `・${r.ページ}ページ` : ""}</p>`;
}

async function 申請を決める(el, 承認){
  const id = el.dataset.本;
  const 値 = k => document.getElementById(`${k}-${id}`)?.value.trim() || "";
  el.disabled = true;
  try{
    await 土台.申請を決める(id, 承認, { 題:値("管題"), 著:値("管著"), 版元:値("管版元") });
    知らせる(承認 ? "本登録にしました" : "見送りました");
    管理の頁();
  }catch(e){
    console.error(e);
    el.disabled = false;
    知らせる("決められませんでした", true);
  }
}

/* ── 自分 ─────────────────────────────── */
function 自分の頁(){
  const 自分 = 状態.自分, a = 自分.アバター;
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Me</p>
    <div style="display:flex;gap:22px;align-items:center">
      ${顔の絵(自分, "大")}
      <div><h1 class="中見出し" style="margin:0">${逃(自分.名)}</h1>
        <p class="注" style="margin:4px 0 0">${逃(状態.私.メール)}</p></div>
    </div>
  </section>
  <section class="節 帳">
    <div class="節の頭"><h2 class="節見出し">名前</h2></div>
    <input id="名の欄" class="欄" maxlength="20" value="${逃(自分.名)}" style="margin-top:14px">
    <div class="釦たち" style="margin-top:16px"><button class="釦 小" data-する="名を直す">名前を直す</button></div>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">アバター</h2><p class="節の添え">作り直せるのは1日5回まで</p></div>
    ${三枚(a)}
    <div class="釦たち" style="margin-top:16px">
      <button class="釦 枠だけ 小" data-する="向きを反対にする">向きを反対にする</button>
    </div>
    <p class="注">場所ごとに、決まった方を向いて座ります。奥の席で逆を向いていたら押してください。</p>
    ${a.背中 ? "" : `<div class="釦たち" style="margin-top:18px">
      <button class="釦 枠だけ 小" data-する="背中を足す">背中の姿を足す</button></div>
    <p class="注">手前の席では、テーブルに向かう背中が見えます。いまの姿から背中だけを描きます（1分ほど。1日の回数に1回数えます）。</p>`}
    <div class="帳">
      ${写真の欄()}
      ${a.状態 === "failed" && a.誤り ? `<p class="誤りの字">${逃(a.誤り)}</p>` : ""}
      <div class="釦たち" style="margin-top:24px">
        <button class="釦 藤" data-する="作り直す">この写真で作り直す</button>
      </div>
    </div>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">ログイン</h2></div>
    <div class="釦たち" style="margin-top:16px"><button class="釦 枠だけ 小" data-する="出る">ログアウト</button></div>
  </section>`;
  絵を入れる(画面);
}

/* ── 押したとき ─────────────────────────── */
async function 写真を縮める(ファイル){
  const 絵 = await createImageBitmap(ファイル, { imageOrientation:"from-image" });
  const 倍 = Math.min(1, 1024 / Math.max(絵.width, 絵.height));
  const c = document.createElement("canvas");
  c.width = Math.round(絵.width * 倍); c.height = Math.round(絵.height * 倍);
  c.getContext("2d").drawImage(絵, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", .9);
}

function 名を読む(){
  const 名 = document.getElementById("名の欄")?.value.trim() || "";
  if(!名){ 知らせる("名前を入れてください", true); return null; }
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
    知らせる(e.message || "作れませんでした", true);
    描く();
  }
}

const 動き = {
  入る: ()=>土台.入る().catch(e=>知らせる("ログインできませんでした：" + (e.code || e.message), true)),
  出る: async ()=>{ await 土台.出る(); 状態.自分 = undefined; 行く("廊下"); },
  行く: el=>行く(el.dataset.頁),
  場所へ: el=>{ 状態.部屋 = 部屋ら[el.dataset.部屋] ? el.dataset.部屋 : 最初の部屋; 行く("部屋"); },
  覆いの外: (el, e)=>{ if(e.target === el) 窓を閉じる(); },
  窓を閉じる,
  はじめて作る: ()=>{ const 名 = 名を読む(); if(名) 作る(名); },
  作り直す: ()=>作る(null),
  名を直す: async ()=>{
    const 名 = 名を読む(); if(!名) return;
    try{ await 土台.名を決める(名); 知らせる("名前を直しました"); }
    catch(e){ 知らせる("直せませんでした", true); }
  },
  向きを反対にする: async ()=>{
    try{ await 土台.向きを反対にする(!状態.自分.反転); 知らせる("向きを反対にしました"); }
    catch(e){ 知らせる("変えられませんでした", true); }
  },
  背中を足す: async el=>{
    el.disabled = true;
    el.textContent = "背中を描いています…";
    try{ await 土台.背中を足す(); 知らせる("背中の姿を足しました"); }
    catch(e){ console.error(e); el.disabled = false; el.textContent = "背中の姿を足す"; 知らせる(e.message || "描けませんでした", true); }
  },
  席に着く: ()=>満席か() ? 知らせる("いまは満席です。空いたら、お知らせします", true) : 題の窓("席に着く"),
  本を替える: ()=>題の窓("本を替える"),
  題を決める: el=>本で決める(el),
  本を選ぶ: el=>{
    本窓.選んだ = 本窓.本ら.find(b=>b.id === el.dataset.本) || null;
    本の窓を描く();
  },
  申請をひらく: ()=>{ 本窓.申請 = true; 本の窓を描く(); document.getElementById("申題")?.focus(); },
  // さがす欄に貼られた Amazon の URL から、書誌の入った申請の窓を開く
  URLで申請をひらく: async el=>{
    const url = 本窓.探す;
    本窓.探す = "";
    本窓.申請 = true;
    本の窓を描く();
    const 欄 = document.getElementById("申amazon");
    if(欄) 欄.value = url;
    document.getElementById("申isbn").value = el.dataset.isbn;
    await 書誌を入れる(el.dataset.isbn);
  },
  申請をとじる: ()=>{ 本窓.申請 = false; 本の窓を描く(); },
  申請して決める: async ()=>{
    const 値 = id => document.getElementById(id)?.value.trim() || "";
    const 申 = { 題:値("申題"), 著:値("申著"), 版元:値("申版元"), isbn:値("申isbn").replace(/[^0-9Xx]/g, ""), ひとこと:値("申ひとこと"),
      ページ:本窓.申請のページ || 0 };
    if(!申.題 || !申.著 || !申.版元) return 知らせる("書名・著者名・出版社名を入れてください", true);
    本窓.送信中 = true;
    本の窓を描く();
    try{
      const 本 = await 土台.本を申請する(申);
      本窓.本ら.push(本);
      本窓.選んだ = 本;
      本窓.出す = true;
      本窓.申請 = false;
      本窓.送信中 = false;
      知らせる("申請しました。いまは仮登録です");
      await 本で決める(null);
    }catch(e){
      console.error(e);
      本窓.送信中 = false;
      本の窓を描く();
      知らせる("申請できませんでした", true);
    }
  },
  Amazonから読む: async ()=>{
    const u = document.getElementById("申amazon")?.value.trim() || "";
    if(/link\.amazon|amzn\.to|amzn\.asia/.test(u)) return 知らせる("短縮リンクは辿れません。一度開いて、出てきた URL を貼ってください", true);
    const asin = AmazonのASIN(u);
    if(!asin) return 知らせる("Amazon の URL から商品番号を読み取れませんでした", true);
    const isbn = ISBN13にする(asin);
    if(!isbn) return 知らせる("Kindle 版などは書誌を引けません。紙の本の URL でお願いします", true);
    document.getElementById("申isbn").value = isbn;
    await 書誌を入れる(isbn);
  },
  ISBNを確かめる: async ()=>{
    const v = document.getElementById("申isbn")?.value || "";
    if(v.replace(/[^0-9Xx]/g, "").length < 10) return 知らせる("ISBN を10桁以上入れてください", true);
    await 書誌を入れる(v);
  },
  棚の本を選ぶ: el=>{
    本窓.選んだ = 本窓.本ら.find(b=>b.id === el.dataset.本) || null;
    本窓.出す = true;
    本窓.申請 = false;
    本の窓を描く();
  },
  書誌を引き直す: el=>書誌を引き直す(el),
  申請を承認: el=>申請を決める(el, true),
  申請を見送る: el=>申請を決める(el, false),
  読み終える: ()=>読み終える窓(),
  // ⚠️ 2026-09-27 に行の範囲で消したとき、これまで消えていた（「投稿しないで終える」が効かなかった）
  そのまま終える: ()=>終える(),
  投稿して終える: async el=>{
    el.disabled = true;
    el.textContent = "投稿の準備をしています…";
    const { 題, 分, 場所 } = 読み終えの中身;
    const 文 = 題 ? `『${題}』を${分}分、${場所}のベンチで読みました。` : `${場所}のベンチで、${分}分読みました。`;
    const スマホ = matchMedia("(pointer: coarse)").matches;
    // パソコン：窓は押した瞬間に開く（絵を置き終わってから開くと、ポップアップとして止められる）
    const 窓 = スマホ ? null : open("", "_blank");
    let 行き先 = location.origin + 根;
    try{ if(読み終えの絵) 行き先 = await 土台.共有を作る(読み終えの絵, { 題, 分, 場所 }); }
    catch(e){ console.error(e); }
    /* 文・ハッシュタグ・リンクのあいだに空の行を1つずつ（2026-09-29 配信者）。
       ⚠️ リンクは url= で渡さず、文に入れる。url= だと X が文のすぐ後ろ（同じ行）につなげる */
    const 先 = "https://x.com/intent/post?text=" + encodeURIComponent(`${文}\n\n#GEMuの静かな読書会\n\n${行き先}`);
    await 土台.立つ({ 記録する:true, 読了:読了を読む() }).catch(()=>{});
    /* スマホ：このページのまま X へ移る（X のアプリが入っていれば、アプリが開く）。
       ⚠️ 絵を置き終わってから新しい窓を開くと、スマホでは止められて、X が立ち上がらなかった（2026-09-27 配信者） */
    if(スマホ){ location.href = 先; return; }
    if(窓){ 窓.opener = null; 窓.location.href = 先; }
    else open(先, "_blank", "noopener");
    await 終える();
  },
};

/* ── 読み終える ─────────────────────────────
   2026-09-27 配信者：X への投稿は、読み終えるときに「投稿しますか？」と聞き、
   はいなら、絵・書名・読んだ時間と一緒に投稿する。
   ⚠️ X の投稿画面を開く形（intent）では、画像を添付できない。
      → 絵を置いた「読書の記録ページ」（/s/{id}。functions の sharePage）のリンクを付ける。
        X がリンクから絵（og:image）を読み取り、投稿に大きく出す。**配信者はこの形でよい**（2026-09-27、実際の投稿を見て）
      ⚠️ 一度「画像を添付したい」と受け取り、パソコンはコピーして貼り付け、スマホは画像を保存…の手順を作ったが、
         取り違えだった。**保存や貼り付けの手順は要らない**（配信者）。
      ⚠️ スマホは、このページのまま X へ移る（新しい窓は止められて、X が立ち上がらなかった）
   ⚠️ 絵に名前は入れない（ほかの人も写るため）。書名と時間と場所だけ */
let 読み終えの絵 = null, 読み終えの中身 = null;

function 読み終える窓(){
  const 席 = 土台.座っている();
  if(!席) return 終える();
  const 題 = 状態.席ら.find(s=>s.uid === 状態.私.uid)?.題 ?? "";
  const 本 = 席.区切り?.at(-1)?.本 || "";
  const 分 = Math.max(1, Math.round((Date.now() - 席.入った) / 60000));
  const 場所 = 部屋ら[状態.部屋].名;
  読み終えの絵 = null;
  読み終えの中身 = { 題, 本, 分, 場所 };
  窓を出す("読み終える", `
    <p class="窓の文">${題 ? `『${逃(題)}』を、` : ""}${逃(場所)}のベンチで <b>${分}分</b> 読みました。</p>
    ${題 ? `<label class="読了の印"><input type="checkbox" id="読了の印"> この本を最後まで読んだ（読了）</label>` : ""}
    <div id="総ページの欄" hidden>
      <label class="名札" for="総ページ">この本の総ページ数（わかれば）</label>
      <input id="総ページ" class="欄" type="number" inputmode="numeric" min="0" max="20000" placeholder="例：320"
        value="${状態.いまの本?.id === 本 && 状態.いまの本.ページ ? 状態.いまの本.ページ : ""}">
    </div>
    <div class="共有の見本" id="共有の見本">${待ちの画面("絵を描いています")}</div>
    <p class="窓の文">X に投稿しますか？</p>
    <div class="釦たち" style="margin-top:12px">
      <button class="釦 藤" data-する="投稿して終える" disabled>X に投稿して終える</button>
      <button class="釦 枠だけ" data-する="そのまま終える">投稿しないで終える</button>
    </div>
    <p class="注">投稿には、この絵と、書名と、読んだ時間が入ります。名前は入りません。</p>`);
  共有の絵を描く(題, 分, 場所).then(絵=>{
    読み終えの絵 = 絵;
    const 見本 = document.getElementById("共有の見本");
    if(見本) 見本.innerHTML = `<img src="${URL.createObjectURL(絵)}" alt="投稿する絵">`;
  }).catch(e=>{
    console.error(e);
    const 見本 = document.getElementById("共有の見本");
    if(見本) 見本.innerHTML = `<p class="注">絵を描けませんでした。文だけで投稿できます。</p>`;
  }).finally(()=>{
    const 釦 = document.querySelector("[data-する=投稿して終える]");
    if(釦) 釦.disabled = false;
  });
}

// 「読み終える」で終えたときだけ、読んだ時間を記録に残す（2026-09-29 配信者）
// 読了の印と総ページ数（窓が閉じる前に読む）。冊数とページ数は、ここで印を付けた本だけを数える（2026-09-29 配信者）
function 読了を読む(){
  if(!document.getElementById("読了の印")?.checked || !読み終えの中身) return null;
  const ページ = Math.max(0, Math.min(20000, Math.round(Number(document.getElementById("総ページ")?.value) || 0)));
  return { 題:読み終えの中身.題, ページ, 本:読み終えの中身.本 };
}

async function 終える(){
  const 読了 = 読了を読む();
  窓を閉じる();
  await 土台.立つ({ 記録する:true, 読了 }).catch(()=>{});
  行く("廊下");
  知らせる("おつかれさまでした");
}

const 絵を読む = src => new Promise((ok, ng)=>{
  const 絵 = new Image();
  絵.onload = ()=>ok(絵);
  絵.onerror = ng;
  絵.src = src;
});

// 長い題は … で切る（『』は残す）
function 詰める(g, 文, 幅){
  if(g.measureText(文).width <= 幅) return 文;
  let t = 文;
  while(t.length > 2 && g.measureText(t + "…』").width > 幅) t = t.slice(0, -1);
  return t + "…』";
}

/* X に載る絵（1200×630。X の大きな画像の形）。場所の絵に、いま座っている人と空のベンチを描き、
   上に紙の帯を敷いて、書名・場所・時間を書く。
   ⚠️ 場所の絵と空のベンチは同じ場所（Hosting）なので、そのまま canvas に描ける。
      アバターは Storage にあるので、裏の処理から data URL で借りる（土台.絵を借りる） */
async function 共有の絵を描く(題, 分, 場所){
  const 部屋 = 部屋ら[状態.部屋];
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  await Promise.all([
    document.fonts.load('600 42px "Zen Old Mincho"'),
    document.fonts.load('400 24px "Zen Old Mincho"'),
  ]).catch(()=>{});

  const 背景 = await 絵を読む(部屋の絵(部屋));
  const 高さ = W * 背景.naturalHeight / 背景.naturalWidth;
  const ずらし = -(高さ - H) * 0.6;   // 上を少し切る（帯の下に、ベンチが来るように）
  g.fillStyle = "#f3e7d3";
  g.fillRect(0, 0, W, H);
  g.drawImage(背景, 0, ずらし, W, 高さ);

  const 座られた = new Map(状態.席ら.map(s=>[s.番, s]));
  const 描くもの = 部屋.席.map((席, 番)=>{
    const s = 座られた.get(番);
    if(s){
      const 人 = 状態.人々.get(s.uid), a = 人?.アバター || {};
      const 背中 = 席.姿 === "背中" && !!a.背中;
      return { 席, 道:背中 ? a.背中 : a.座る, 反転:反転するか(人, 席, 背中) };
    }
    if(部屋.空き) return { 席, src:部屋.空き[席.姿] || 部屋.空き.顔, 反転:空きを反転するか(部屋, 席) };
    return null;
  }).filter(Boolean).sort((a, b)=>a.席.y - b.席.y);
  const 借りた = await 土台.絵を借りる(描くもの.map(x=>x.道).filter(Boolean)).catch(()=>({}));
  for(const x of 描くもの){
    const src = x.道 ? 借りた[x.道] : x.src;
    if(!src) continue;
    const 絵 = await 絵を読む(src).catch(()=>null);
    if(!絵) continue;
    const w = W * x.席.幅 / 100, 中 = W * x.席.x / 100, 足 = ずらし + 高さ * x.席.y / 100;
    g.save();
    g.translate(中, 足 - w);
    if(x.反転) g.scale(-1, 1);
    g.drawImage(絵, -w / 2, 0, w, w);
    g.restore();
  }

  // 自分の名札（名前と『題』）を、自分の足もとに。⚠️ ほかの人の名前は入れない（2026-09-27 配信者：自分の名前と題を出したい）
  const 自分の席 = 状態.席ら.find(s=>s.uid === 状態.私.uid);
  if(自分の席 && 部屋.席[自分の席.番]){
    const 席 = 部屋.席[自分の席.番];
    const 中 = W * 席.x / 100, 上 = ずらし + 高さ * 席.y / 100 + 6;
    const 名 = 状態.自分?.名 || "";
    g.font = '600 17px "Hiragino Sans","Yu Gothic UI","Yu Gothic",sans-serif';
    const 名の幅 = Math.min(g.measureText(名).width, 260);
    g.font = '400 17px "Zen Old Mincho", serif';
    const 題の文 = 題 ? 詰める(g, `『${題}』`, 260) : "";
    const 幅 = Math.max(名の幅, 題の文 ? g.measureText(題の文).width : 0) + 24, 丈 = 題の文 ? 56 : 34;
    const 左 = Math.max(8, Math.min(W - 幅 - 8, 中 - 幅 / 2));
    g.fillStyle = "rgba(255,253,255,.94)";
    g.fillRect(左, 上, 幅, 丈);
    g.strokeStyle = "#6b4bc4";
    g.lineWidth = 1.5;
    g.strokeRect(左 + .75, 上 + .75, 幅 - 1.5, 丈 - 1.5);
    g.textAlign = "center";
    g.fillStyle = "#17141f";
    g.font = '600 17px "Hiragino Sans","Yu Gothic UI","Yu Gothic",sans-serif';
    g.fillText(名, 左 + 幅 / 2, 上 + 23, 260);
    g.fillStyle = "#59526b";
    g.font = '400 17px "Zen Old Mincho", serif';
    g.fillText(題の文, 左 + 幅 / 2, 上 + 46);
  }

  // 上の紙の帯
  g.fillStyle = "rgba(255,253,255,.92)";
  g.fillRect(0, 0, W, 132);
  g.fillStyle = "rgba(38,28,66,.13)";
  g.fillRect(0, 132, W, 1);
  g.textAlign = "left";
  g.fillStyle = "#17141f";
  g.font = '600 42px "Zen Old Mincho", serif';
  g.fillText(題 ? 詰める(g, `『${題}』`, W - 80) : `${分}分、読みました`, 40, 66);
  g.fillStyle = "#59526b";
  g.font = '400 24px "Zen Old Mincho", serif';
  g.fillText(題 ? `${場所}のベンチで、${分}分読みました` : `${場所}のベンチで`, 40, 110);
  g.textAlign = "right";
  g.fillStyle = "#6b4bc4";
  g.font = '600 18px "Hiragino Sans","Yu Gothic UI","Yu Gothic",sans-serif';
  g.fillText("GEMuの静かな読書会", W - 40, 110);

  return new Promise((ok, ng)=>c.toBlob(b=>b ? ok(b) : ng(new Error("書き出せませんでした")), "image/jpeg", .9));
}

document.addEventListener("click", e=>{
  const el = e.target.closest("[data-する]");
  if(!el || el.tagName === "INPUT") return;
  動き[el.dataset.する]?.(el, e);
});
// 読了の印を付けたら、総ページ数の欄を出す
document.addEventListener("change", e=>{
  if(e.target.id !== "読了の印") return;
  const 欄 = document.getElementById("総ページの欄");
  if(欄){ 欄.hidden = !e.target.checked; if(e.target.checked) document.getElementById("総ページ")?.focus(); }
});
document.addEventListener("change", async e=>{
  if(e.target.dataset?.する !== "写真") return;
  const f = e.target.files?.[0];
  if(!f) return;
  try{ 選んだ写真 = await 写真を縮める(f); }
  catch(err){ return 知らせる("この写真は読めませんでした", true); }
  // 入れかけの名前を消さないように、見本の絵だけ差し替える
  const 見本 = document.querySelector(".写真の見本");
  見本?.insertAdjacentHTML("afterend", `<img class="写真の見本" src="${選んだ写真}" alt="">`);
  見本?.remove();
});

/* ── 立ち上げ ───────────────────────────── */
{
  const { 頁, 部屋 } = 道を読む();
  状態.頁 = 頁;
  if(部屋) 状態.部屋 = 部屋;
}
描く();
土台.起動(({ 私 })=>{
  自分の見張り?.(); 人々の見張り?.();
  自分の見張り = 人々の見張り = null;
  状態.起きた = true;
  状態.私 = 私;
  状態.自分 = undefined; 状態.人々 = new Map(); 状態.管理者 = false;
  if(私){
    // 管理者（admins/{uid}）だけに「管理」を出す。本の申請を承認する頁
    土台.管理者か().then(か=>{ 状態.管理者 = か; if(か) 描く(); }).catch(()=>{});
    自分の見張り = 土台.自分を見張る(自分=>{
      const 前 = 状態.自分;
      // 中身が同じなら描き直さない（入れかけの名前が消えるため。試しでは、ほかのタブの変化でも届く）
      if(前 !== undefined && JSON.stringify(前) === JSON.stringify(自分)) return;
      状態.自分 = 自分;
      // 向きを記録する前に作ったアバターは、裏の処理に一度だけ見てもらう
      if(自分?.アバター?.座る && !自分.アバター.向き && !向きを確かめた){
        向きを確かめた = true;
        土台.向きを確かめる().catch(e=>console.error(e));
      }
      // 部屋にいるあいだは、自分の記録が変わっても頁を描き直さない（席の窓が消えるため）。
      // ⚠️ ただし帯と手もとは描き直す。描き直さないと、作り直しで古い絵が消されたあと、
      //    帯の顔が消えた絵を指したまま空の四角になった（2026-09-27 配信者）
      if(状態.頁 === "部屋" && 前?.アバター?.座る && 自分?.アバター?.座る && !状態.作ったばかり){
        帯を描く();
        手もとを描く();
        return;
      }
      描く();
    });
    人々の見張り = 土台.人々を見張る(人々=>{
      状態.人々 = 人々;
      if(状態.頁 === "部屋") 部屋を描き直す();
    });
  }
  描く();
}).catch(e=>{
  console.error(e);
  画面.innerHTML = `<section class="幕"><p class="誤りの字">ひらけませんでした：${逃(e.message)}</p></section>`;
});
