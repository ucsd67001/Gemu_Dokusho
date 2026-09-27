/* ============================================================
   GEMu 読書会 ― 画面

   流れ：入口（Googleで入る）→ 名前と写真 → アバターができるのを待つ → できあがり
         → 廊下（部屋の一覧。いまはカフェだけ）→ カフェの席に着く（読む本の題を入れる）

   ⚠️ Firebase には直接さわらない。**土台.js（試しでは 試し/土台.js）だけを通す。**
   ⚠️ 押せるものは onclick に値を書かず、data-する="…" と data-* で渡す。
      値を onclick の文字列に埋めると、題や名前に ' が入ったときにスクリプトが動く
      （Hongaeshi で実際に穴だった）。
   ============================================================ */

import { 部屋ら, 部屋の絵 } from "./部屋.js";

const 試しか = location.pathname === "/demo" || location.pathname.startsWith("/demo/");
const 土台 = await import(試しか ? "./試し/土台.js" : "./土台.js");
const 根 = 試しか ? "/demo" : "";

const 画面 = document.getElementById("画面");
const 状態 = {
  起きた:false, 私:null,
  自分:undefined,          // undefined＝読み込み中／null＝まだ名前が無い
  人々:new Map(),
  席ら:[],                 // いま見ている部屋の席
  頁:"廊下", 部屋:"cafe",
  作ったばかり:false,
};
let 片づけ = [];           // 頁を離れるときに止めるもの（見張り・時計）
let 自分の見張り = null, 人々の見張り = null;

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
const 窓を閉じる = () =>{ document.getElementById("窓").innerHTML = ""; };

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
const 道の頁 = { "":"廊下", "/cafe":"部屋", "/log":"記録", "/me":"自分" };
const 頁の道 = { 廊下:"", 部屋:"/cafe", 記録:"/log", 自分:"/me" };

function 行く(頁, 履歴に積む = true){
  if(状態.頁 === "部屋" && 頁 !== "部屋") 土台.立つ().catch(()=>{});
  状態.頁 = 頁;
  if(履歴に積む) history.pushState({}, "", 根 + (頁の道[頁] ?? "") || "/");
  描く();
  scrollTo(0, 0);
}
addEventListener("popstate", ()=>{
  const 頁 = 道の頁[location.pathname.slice(根.length).replace(/\/$/, "")] || "廊下";
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

  const 自分 = 状態.自分, a = 自分?.アバター;
  if(!自分 || !a?.座る){
    if(a?.状態 === "making") return 作っている();
    return 登録();
  }
  if(状態.作ったばかり){
    if(a.状態 === "making") return 作っている();
    if(a.状態 === "ready") return できあがり();
    状態.作ったばかり = false;
    if(a.誤り) 知らせる(a.誤り, true);
  }
  ({ 廊下, 部屋:部屋の頁, 記録:記録の頁, 自分:自分の頁 }[状態.頁] || 廊下)();
}

function 帯を描く(){
  const 入った = 状態.私 && 状態.自分?.アバター?.座る;
  document.getElementById("nav").innerHTML = 入った ? [
    ["廊下", "カフェ"], ["記録", "記録"], ["自分", "自分"],
  ].map(([頁, 字])=>`<button class="${状態.頁 === 頁 || (頁 === "廊下" && 状態.頁 === "部屋") ? "いま" : ""}"
      data-する="行く" data-頁="${頁}">${字}</button>`).join("") : "";
  const 右 = document.getElementById("帯の右");
  if(入った) 右.innerHTML = `<button data-する="行く" data-頁="自分" aria-label="自分">${顔の絵(状態.自分)}</button>`;
  else if(状態.起きた && !状態.私) 右.innerHTML = `<button class="釦 小" data-する="入る">${試しか ? "試しに入る" : "Google で入る"}</button>`;
  else 右.innerHTML = "";
  絵を入れる(右);
  document.querySelector(".試用札").hidden = !試しか;
}

const 待ちの画面 = 字 => `<div class="待つ"><div class="積み木">${"<i></i>".repeat(6)}</div>
  <p class="段の字">${逃(字)}</p></div>`;

/* ── 入口 ─────────────────────────────── */
function 入口(){
  const 部屋 = 部屋ら.cafe;
  画面.innerHTML = `
  <div class="看板"><div class="舞台" style="aspect-ratio:${部屋.比}"><img class="背景" src="${部屋の絵(部屋)}" alt="明るい中世のカフェの部屋"></div></div>
  <section class="幕">
    <p class="英字の札">GEMu Dokusho</p>
    <h1 class="大見出し">しずかに、同じ部屋で読む。</h1>
    <p class="導き">神保町の喫茶店のように、だれも話さず、それぞれが自分の本を読んでいる。それなのに、同じ時間に本をひらいている人がいる。読書好きどうしの、ふしぎな一体感の場所です。</p>
    <p class="導き" style="margin-top:10px">自分の姿をブロックの人にして、カフェの席に座ります。</p>
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
    <label class="名札">自分の写真</label>
    <div class="写真の枠">
      ${選んだ写真 ? `<img class="写真の見本" src="${選んだ写真}" alt="">` : `<div class="写真の見本">まだです</div>`}
      <div>
        <label class="釦 枠だけ 小">写真を選ぶ<input type="file" accept="image/*" data-する="写真"></label>
        <p class="注" style="margin-top:8px">顔と服が分かる写真がおすすめです。</p>
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
    <label class="名札" for="名の欄">名前（カフェで名札に出ます）</label>
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
    <p class="段の字">${逃(a?.段階 || "描いています")}</p>
    <p class="注">1〜2分かかります。この画面のまま待っていてください。</p>
  </div>`;
}

function できあがり(){
  const a = 状態.自分.アバター;
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Your avatar</p>
    <h1 class="中見出し">できました</h1>
    <p class="導き">カフェでは、座って読む姿と、ページをめくる姿が、ときどき入れかわります。</p>
    ${三枚(a)}
    <div class="釦たち" style="margin-top:30px">
      <button class="釦" data-する="カフェへ">カフェへ</button>
      <button class="釦 枠だけ" data-する="行く" data-頁="自分">作り直す</button>
    </div>
  </section>`;
  状態.作ったばかり = false;
  絵を入れる(画面);
}

const 三枚 = a => `<div class="三枚">
  <figure><img data-道="${逃(a.座る)}" alt="座って読む姿"><figcaption>座って読む</figcaption></figure>
  <figure><img data-道="${逃(a.めくる)}" alt="ページをめくる姿"><figcaption>ページをめくる</figcaption></figure>
  <figure><img data-道="${逃(a.顔)}" alt="顔"><figcaption>顔</figcaption></figure>
</div>`;

/* ── 廊下（部屋の一覧） ─────────────────────── */
function 廊下(){
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Rooms</p>
    <h1 class="中見出し">どの部屋で読みますか</h1>
  </section>
  <section class="節">
    <div class="節の頭"><h2 class="節見出し">部屋</h2><p class="節の添え">いまはひとつだけ</p></div>
    <div class="部屋の列">
      ${Object.entries(部屋ら).map(([id, 部屋])=>`
      <button class="部屋の札" data-する="カフェへ" data-部屋="${id}">
        <div class="小さな舞台"><div class="舞台" style="border:none;aspect-ratio:${部屋.比}"><img class="背景" src="${部屋の絵(部屋)}" alt=""></div></div>
        <div>
          <div class="部屋の名">${逃(部屋.名)}</div>
          <div class="部屋の素性" id="居る数-${id}">${逃(部屋.添え)}</div>
          <div class="顔の列" id="顔の列-${id}"></div>
        </div>
        <span class="札 藤">入る</span>
      </button>`).join("")}
    </div>
  </section>`;
  // 誰がいるかを出す
  片づけ.push(土台.席を見張る("cafe", 席ら=>{
    const 数 = document.getElementById("居る数-cafe"), 列 = document.getElementById("顔の列-cafe");
    if(!数) return;
    数.textContent = 席ら.length ? `いま${席ら.length}人が読んでいます（${部屋ら.cafe.席.length}席）` : `いまは誰もいません（${部屋ら.cafe.席.length}席）`;
    列.innerHTML = 席ら.map(s=>顔の絵(状態.人々.get(s.uid), "中")).join("");
    絵を入れる(列);
  }));
}

/* ── 部屋 ─────────────────────────────── */
function 部屋の頁(){
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

  片づけ.push(土台.席を見張る(状態.部屋, 席ら=>{ 状態.席ら = 席ら; 部屋を描き直す(); }));

  // ときどきページをめくる
  const めくり = setInterval(()=>{
    for(const el of document.querySelectorAll("#舞台 .人")){
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

  if(!土台.座っている()) 題の窓("席に着く");
}

function 部屋を描き直す(){
  const 舞台 = document.getElementById("舞台");
  if(!舞台) return;
  const 部屋 = 部屋ら[状態.部屋];
  // 奥（y が小さい）から描いて、手前の人が上に重なるようにする
  const 並び = [...状態.席ら].sort((a, b)=>(部屋.席[a.番]?.y || 0) - (部屋.席[b.番]?.y || 0));
  const 背景 = 舞台.querySelector("img.背景").outerHTML;
  const 置き = (席, 幅) => `left:${席.x}%;top:${席.y}%${幅 ? `;width:${席.幅}%` : ""}`;
  // ⚠️ 名札は人の絵と別の層にして、最後に重ねる。人の中に入れると、手前の人が奥の人の名札を隠す
  舞台.innerHTML = 背景 + 並び.map(s=>{
    const 席 = 部屋.席[s.番];
    if(!席) return "";
    const a = 状態.人々.get(s.uid)?.アバター || {};
    return `
    <div class="人 ${席.向き === "左" ? "左向き" : ""}" style="${置き(席, true)}">
      <div class="姿">
        <img class="座る" data-道="${逃(a.座る)}" alt="">
        <img class="めくる" data-道="${逃(a.めくる)}" alt="">
      </div>
    </div>`;
  }).join("") + 並び.map(s=>{
    const 席 = 部屋.席[s.番];
    if(!席) return "";
    return `<div class="名の札 ${s.uid === 状態.私.uid ? "自分" : ""}" style="${置き(席)}">
      <b>${逃(状態.人々.get(s.uid)?.名 || "…")}</b><span>『${逃(s.題)}』</span></div>`;
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
      <span class="題">『${逃(s.題)}』</span>
      <span class="時">${分に(Date.now() - s.入った)}</span></div>`;
  }).join("") : `<p class="注">まだ誰もいません。</p>`;
  絵を入れる(列);
  手もとを描く();
}

function 手もとを描く(){
  const el = document.getElementById("手もと");
  if(!el) return;
  const 席 = 土台.座っている();
  if(!席){
    el.innerHTML = `<div class="手もと">
      <div class="何を"><div class="時">いまは部屋をのぞいているだけです</div></div>
      <button class="釦" data-する="席に着く">席に着く</button></div>`;
    return;
  }
  const 題 = 状態.席ら.find(s=>s.uid === 状態.私.uid)?.題 || 前の題();
  el.innerHTML = `<div class="手もと">
    ${顔の絵(状態.自分, "中")}
    <div class="何を"><div class="書名">『${逃(題)}』</div>
      <div class="時">読みはじめて ${分に(Date.now() - 席.入った)}</div></div>
    <div class="釦たち">
      <button class="釦 枠だけ 小" data-する="本を替える">本を替える</button>
      <button class="釦 枠だけ 小" data-する="Xに投稿">X に投稿</button>
      <button class="釦 小" data-する="席を立つ">席を立つ</button>
    </div></div>`;
  絵を入れる(el);
}

const 前の題 = () =>{ try{ return localStorage.getItem("gemuの前の題") || ""; }catch{ return ""; } };

function 題の窓(やること){
  窓を出す(やること === "席に着く" ? "いま読む本" : "本を替える", `
    <label class="名札" for="題の欄">本の題</label>
    <input id="題の欄" class="欄" maxlength="120" placeholder="例：銀河鉄道の夜" value="${逃(前の題())}">
    <p class="注">カフェの名札に出ます。</p>
    <div class="釦たち" style="margin-top:22px">
      <button class="釦 全幅" data-する="題を決める" data-やること="${逃(やること)}">${やること === "席に着く" ? "席に着く" : "替える"}</button>
    </div>`);
  const 欄 = document.getElementById("題の欄");
  欄.select();
  欄.addEventListener("keydown", e=>{
    if(e.key === "Enter" && !e.isComposing) document.querySelector("[data-する=題を決める]").click();
  });
}

/* ── 記録 ─────────────────────────────── */
async function 記録の頁(){
  画面.innerHTML = `
  <section class="幕">
    <p class="英字の札">Reading log</p>
    <h1 class="中見出し">読んだ時間</h1>
    <p class="導き">カフェの席に着いていた時間です。</p>
    <div id="記録の中">${待ちの画面("読みこんでいます")}</div>
  </section>`;
  let 記録;
  try{ 記録 = await 土台.記録を読む(); }
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
    <section class="節">
      <div class="節の頭"><h2 class="節見出し">これまで</h2><p class="節の添え">${記録.length}回</p></div>
      <div class="記録の列">
        ${記録.length ? 記録.map(r=>`<div class="記録">
          <span class="日">${日付(r.始め)}</span>
          <span class="題">『${逃(r.題)}』</span>
          <span class="分">${分に(長さ(r))}</span></div>`).join("")
          : `<p class="注">まだありません。カフェで席に着くと、ここに残ります。</p>`}
      </div>
    </section>`;
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
    const 写真 = 選んだ写真;
    選んだ写真 = null;
    描く();
    await 土台.アバターを作る(写真);
  }catch(e){
    console.error(e);
    状態.作ったばかり = false;
    知らせる(e.message || "作れませんでした", true);
    描く();
  }
}

const 動き = {
  入る: ()=>土台.入る().catch(e=>知らせる("ログインできませんでした：" + (e.code || e.message), true)),
  出る: async ()=>{ await 土台.出る(); 状態.自分 = undefined; 行く("廊下"); },
  行く: el=>行く(el.dataset.頁),
  カフェへ: ()=>{ 状態.部屋 = "cafe"; 行く("部屋"); },
  覆いの外: (el, e)=>{ if(e.target === el) 窓を閉じる(); },
  窓を閉じる,
  はじめて作る: ()=>{ const 名 = 名を読む(); if(名) 作る(名); },
  作り直す: ()=>作る(null),
  名を直す: async ()=>{
    const 名 = 名を読む(); if(!名) return;
    try{ await 土台.名を決める(名); 知らせる("名前を直しました"); }
    catch(e){ 知らせる("直せませんでした", true); }
  },
  席に着く: ()=>題の窓("席に着く"),
  本を替える: ()=>題の窓("本を替える"),
  題を決める: async el=>{
    const 題 = document.getElementById("題の欄").value.trim();
    if(!題) return 知らせる("本の題を入れてください", true);
    try{ localStorage.setItem("gemuの前の題", 題); }catch{}
    el.disabled = true;
    try{
      if(el.dataset.やること === "席に着く") await 土台.座る(状態.部屋, 題, 部屋ら[状態.部屋].席.length);
      else await 土台.題を替える(題);
      窓を閉じる();
      手もとを描く();
    }catch(e){
      console.error(e);
      el.disabled = false;
      知らせる(e.message === "満席です" ? "満席です。少し待ってから入ってください" : "席に着けませんでした", true);
    }
  },
  席を立つ: async ()=>{ await 土台.立つ(); 行く("廊下"); },
  Xに投稿: ()=>{
    const 題 = 状態.席ら.find(s=>s.uid === 状態.私.uid)?.題 || 前の題();
    const 文 = `いま『${題}』を読んでいます。\nGEMu 読書会のカフェにて\n#GEMu読書会`;
    const url = "https://x.com/intent/post?text=" + encodeURIComponent(文)
      + (試しか ? "" : "&url=" + encodeURIComponent(location.origin));
    open(url, "_blank", "noopener");
  },
};

document.addEventListener("click", e=>{
  const el = e.target.closest("[data-する]");
  if(!el || el.tagName === "INPUT") return;
  動き[el.dataset.する]?.(el, e);
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
  const 頁 = 道の頁[location.pathname.slice(根.length).replace(/\/$/, "")];
  if(頁) 状態.頁 = 頁;
}
描く();
土台.起動(({ 私 })=>{
  自分の見張り?.(); 人々の見張り?.();
  自分の見張り = 人々の見張り = null;
  状態.起きた = true;
  状態.私 = 私;
  状態.自分 = undefined; 状態.人々 = new Map();
  if(私){
    自分の見張り = 土台.自分を見張る(自分=>{
      const 前 = 状態.自分;
      // 中身が同じなら描き直さない（入れかけの名前が消えるため。試しでは、ほかのタブの変化でも届く）
      if(前 !== undefined && JSON.stringify(前) === JSON.stringify(自分)) return;
      状態.自分 = 自分;
      // 部屋にいるあいだは、自分の記録が変わっても頁を描き直さない（席の窓が消えるため）
      if(状態.頁 === "部屋" && 前?.アバター?.座る && 自分?.アバター?.座る && !状態.作ったばかり) return;
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
