/* ============================================================
   場所のページ（場所の絵・場所の絵の下の欄・いま読んでいる人）と、画面を消して戻ったとき
   ============================================================ */
import { 部屋ら, 部屋の絵, 最初の部屋 } from "../部屋.js";
import { 土台, 画面, 状態, 頁ら, 動き, 開ける場所か, 逃, 知らせる, 窓を出す, 窓を閉じる, 絵を入れる, 顔の絵, 分に } from "./共通.js";
import { 置き, 人とベンチ } from "./ベンチ.js";
import { 表紙, 書籍名, 本の表, 本の表の今 } from "./本.js";
import { 本窓, 題の窓, 窓口 } from "./本を選ぶ.js";

/* ── 部屋 ─────────────────────────────── */
function 部屋の頁(){
  if(!開ける場所か(状態.部屋)) 状態.部屋 = 最初の部屋;
  const 部屋 = 部屋ら[状態.部屋];
  画面.innerHTML = `
  <section class="幕 詰めて">
    <p class="英字の札">${逃(部屋.英字)}</p>
    <h1 class="中見出し">${逃(部屋.名)}</h1>
    <p class="導き">${逃(部屋.添え)}</p>
  </section>
  <section class="節 詰めて">
    <p class="気配" id="気配"></p>
    <div class="舞台" id="舞台" style="aspect-ratio:${部屋.比}"><img class="背景" src="${部屋の絵(部屋)}" alt="${逃(部屋.名)}の景色"></div>
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
  状態.片づけ.push(土台.席を見張る(状態.部屋, (席ら, 出来事)=>{
    const 前は満席 = 満席か();
    状態.席ら = 席ら;
    部屋を描き直す();
    // 同じ人が別の端末でも開いているとき（土台.js の 席を合わせる）
    if(出来事 === "ほかで座っていた"){
      if(本窓?.やること === "席に着く") 窓を閉じる();
      知らせる("ほかの端末で座っている席で、続けて読めます");
    }
    if(出来事 === "ほかで立った"){
      窓を閉じる();
      知らせる("ほかの端末で読み終えたので、この端末でも席を立ちました");
    }
    if(出来事 === "長く離れて立った"){
      窓を閉じる();
      知らせる("画面を消してから12時間を過ぎたので、席を立ちました。この回は記録に残りません", true);
    }
    // 席を合わせたあと（開き直したときなど）も、長く離れていたかを確かめる
    if(土台.座っている()) 戻りを確かめる({ 聞くだけ:true });
    /* ⚠️ 「最初の様子」は、座っていてもいなくても、最初の1回で使い切る（2026-10-04）。
       前は座っているときに使い切らず、座ったまま開き直してから読み終えると、席が空いた瞬間に
       「はじめて入った人」と取り違えて「いま読む本」の画面を出し、移った先のページ（記録など）に残っていた */
    const 最初 = 初めて;
    初めて = false;
    if(土台.座っている()) return;
    if(最初){
      if(!満席か()) 題の窓("席に着く");
    }else if(前は満席 && !満席か()){
      知らせる("ベンチがひとつ空きました");
      if(document.hidden) document.title = "ベンチが空きました ― " + 元の題名;
    }else if(!前は満席 && 満席か() && 本窓?.やること === "席に着く"){
      // 題を入れているあいだに、最後のベンチが埋まった
      窓を閉じる();
      知らせる("ちょうど今、最後のベンチが埋まりました", true);
    }
  }, { 合わせる:true }));

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
  const 生きる = setInterval(()=>戻りを確かめる(), 60000);
  本の表().then(()=>{ if(状態.頁 === "部屋") 手もとを描く(); });   // 読んでいる本の表紙
  const 時計 = setInterval(手もとを描く, 30000);
  状態.片づけ.push(()=>{ clearInterval(めくり); clearInterval(生きる); clearInterval(時計); });

}

export const 満席か = () => 状態.席ら.length >= (部屋ら[状態.部屋]?.席.length || 0);

const 元の題名 = document.title;

addEventListener("visibilitychange", ()=>{
  if(document.hidden) return;
  document.title = 元の題名;
  if(状態.頁 === "部屋") 戻りを確かめる();
});

/* ⚠️⚠️ 画面を消して読む人（2026-10-04 配信者）。
   席は12時間保つ。**3時間以上**たってから（2026-10-04 配信者「30分以上 ⇒ 3時間以上」）戻ったら「読み続けていましたか？」と聞き、読んだ時間を **時間：分** で自己申告してもらう
   （配信者「ずっと読み続けていないと思うので、時間：分を手入力で」）。申告より後ろの時間は休みとして記録から引く（土台.js の 離席を記録）。
   答えるまでは「生きている」を送らない（送ると、離れていた時間が消える） */
function 戻りを確かめる({ 聞くだけ = false } = {}){
  if(!土台.座っている()) return;
  if(document.getElementById("戻りの時")) return;   // もう聞いている
  const 離れ = 土台.離れていた時間();
  // 12時間を過ぎていたら、席は空いている。ここで答えさせると席が生き返るので、記録せずに立つ
  if(離れ >= 土台.席を保つ){
    窓を閉じる();
    土台.立つ().catch(()=>{});
    知らせる("画面を消してから12時間を過ぎたので、席を立ちました。この回は記録に残りません", true);
    部屋を描き直す();
    return;
  }
  if(離れ >= 土台.聞く離れ) return 戻りの窓(離れ);
  if(!聞くだけ) 土台.生きている().catch(()=>{});   // 席の様子が届くたびに送ると、送る→届く→送る…と回り続ける
}

export function 戻りの窓(離れ){
  窓を出す("おかえりなさい", `
    <p class="窓の文">画面を消してから <b>${分に(離れ)}</b> たちました。<br>そのあいだ、読み続けていましたか？</p>
    <p class="注">読んでいた時間を入れてください。ここで入れた時間だけが、記録に残ります。</p>
    <div class="戻りの時" id="戻りの時" data-離れ="${離れ}">
      <input class="欄" id="戻りの時間" type="number" inputmode="numeric" min="0" max="12" placeholder="0" aria-label="時間"><span>時間</span>
      <input class="欄" id="戻りの分" type="number" inputmode="numeric" min="0" max="59" placeholder="0" aria-label="分"><span>分</span>
    </div>
    <div class="窓の釦">
      <button class="釦 全幅" data-する="戻りを記録">この時間、読んでいました</button>
      <button class="釦 枠だけ 全幅" data-する="戻りを記録しない">読んでいませんでした</button>
    </div>`, { 閉じられない:true });
}

function 戻りを記録(読んだ分){
  土台.離席を記録(読んだ分);
  窓を閉じる();
  土台.生きている().catch(()=>{});
  手もとを描く();
}

export function 部屋を描き直す(){
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
      <span class="題">${s.題 ? `『${逃(s.題)}』` : `<span class="注">（書籍名は出していません）</span>`}</span>
      <span class="時">${分に(Date.now() - s.入った)}</span></div>`;
  }).join("") : `<p class="注">いまは、だれもいません。</p>`;
  絵を入れる(列);
  手もとを描く();
}

export function 手もとを描く(){
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
  // 書籍名を出しているときだけ、表紙も出す
  const 本 = 題 ? 本の表の今.引く(状態.席ら.find(s=>s.uid === 状態.私.uid)?.本 || 席.区切り?.at(-1)?.本, 題) : null;
  el.innerHTML = `<div class="手もと">
    ${顔の絵(状態.自分, "中")}
    ${題 ? 表紙(本, "中") : ""}
    <div class="何を"><div class="書名">${題 ? 書籍名(本, 題) : "書籍名は出していません"}</div>
      <div class="時">読んだ時間 ${分に(土台.読んだ時間())}</div></div>
    <div class="釦たち">
      <button class="釦 枠だけ 小" data-する="本を替える">本を替える</button>
      <button class="釦 小" data-する="読み終える">読み終える</button>
    </div></div>`;
  絵を入れる(el);
}

頁ら.部屋 = 部屋の頁;
窓口.手もとを描く = 手もとを描く;
Object.assign(動き, {
  席に着く: ()=>満席か() ? 知らせる("いまは満席です。空いたら、お知らせします", true) : 題の窓("席に着く"),
  本を替える: ()=>題の窓("本を替える"),
  戻りを記録: ()=>{
    const 時 = Number(document.getElementById("戻りの時間")?.value || 0);
    const 分 = Number(document.getElementById("戻りの分")?.value || 0);
    if(!Number.isFinite(時) || !Number.isFinite(分) || 時 < 0 || 分 < 0) return 知らせる("時間と分を、0以上の数で入れてください", true);
    if(時 === 0 && 分 === 0) return 知らせる("読んでいた時間を入れてください（読んでいなければ「読んでいませんでした」）", true);
    const 離れ = Number(document.getElementById("戻りの時")?.dataset.離れ || 0);
    // 離れていた時間より長くは読めない
    戻りを記録(Math.min(時 * 60 + 分, Math.ceil(離れ / 60000)));
  },
  戻りを記録しない: ()=>戻りを記録(0),
});
