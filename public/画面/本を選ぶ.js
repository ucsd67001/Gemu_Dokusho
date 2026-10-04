/* ============================================================
   「いま読む本」の画面（座るとき・本を替えるとき）と、本の登録の申請
   ⚠️ 場所の絵の下の欄を描き直すのは 窓口.手もとを描く（場所.js が登録する。場所.js がこのファイルを読み込むので、逆向きには読み込まない）
   ============================================================ */
import { 部屋ら } from "../部屋.js";
import { AmazonのASIN, ISBN13にする, ISBNで確かめる } from "../書誌.js";
import { 土台, 状態, 動き, 窓が閉じたら, 逃, 知らせる, 窓を出す, 窓を閉じる, 待ちの画面 } from "./共通.js";
import { 表紙, 本の見出し } from "./本.js";

// 場所.js が登録する（このファイルからは場所.js を読み込まない）
export const 窓口 = { 手もとを描く:()=>{} };

/* ── 本の窓 ─────────────────────────────
   入室（と本を替える）のとき（2026-09-29 配信者）：
     1. 題を名札に出すか、出さないかを選ぶ
     2. 出すなら、登録済みの本から選ぶ（書名か著者名で絞り込む）
     3. 無ければ申請する。申請した本は**仮登録**。**申請した本人は、仮登録のままその題で座れる**。
        管理者が承認すると**本登録**になり、みんなが選べるようになる
   ⚠️ 前は題を自由に打ち込んでいた。同じ本が表記ゆれで別の本になるのを防ぐため、登録済みから選ぶ形にした */
export let 本窓 = null;   // { やること, 出す, 本ら, 選んだ, 探す, 申請, 送信中 }

const 前の本 = () =>{ try{ return localStorage.getItem("gemuの前の本") || ""; }catch{ return ""; } };

// 読了した本は、次の「いま読む本」の画面で選んだ状態にしない
export const 前の本を忘れる = () =>{ try{ localStorage.removeItem("gemuの前の本"); }catch{} };

export async function 題の窓(やること){
  const w = 本窓 = { やること, 出す:true, 本ら:null, 選んだ:null, 探す:"", 申請:false, 送信中:false };
  本の窓を描く();
  let 本ら;
  try{ 本ら = await 土台.本らを読む(); }
  catch(e){ console.error(e); 本ら = []; }
  // ⚠️ 読み終える前に窓が閉じられた（先に座った・✕を押した）なら、何もしない
  if(本窓 !== w) return;
  w.本ら = 本ら;
  /* 前回の本を選んだ状態で開く。ただし**読了した本は選ばない**
     （2026-10-03 配信者「前回読み終えた本が、読み始めるときに続きを読むように出てくる」） */
  const 読了した = new Set((await 土台.読了を読む().catch(()=>[])).map(r=>r.本).filter(Boolean));
  if(本窓 !== w) return;
  w.選んだ = 読了した.has(前の本()) ? null : (本ら.find(b=>b.id === 前の本()) || null);
  本の窓を描く();
}

function 絞った本ら(){
  const w = 本窓;
  const 語 = w.探す.trim().toLowerCase();
  return (w.本ら || []).filter(b=>!語 || (b.題 + " " + (b.副題 || "") + " " + b.著).toLowerCase().includes(語))
    .sort((a, b)=>a.題.localeCompare(b.題, "ja")).slice(0, 50);
}

function 本の候補(){
  const w = 本窓;
  if(w.本ら === null) return 待ちの画面("本棚を読んでいます");
  const 候補 = 絞った本ら();
  if(!候補.length) return `<p class="注">見つかりません。</p>`;
  // ⚠️ 表紙は Amazon へのリンクなので、選ぶ釦の中には入れられない（釦の中にリンクを置けない）。札を div にして横に並べる
  return 候補.map(b=>`<div class="本の候補の札 ${w.選んだ?.id === b.id ? "いま" : ""}" data-本="${逃(b.id)}">
    ${表紙(b)}
    <button class="本の候補の字" data-する="本を選ぶ" data-本="${逃(b.id)}" aria-pressed="${w.選んだ?.id === b.id}">
      <b>『${逃(b.題)}』</b><span>${逃(本の見出し(b))}</span></button></div>`).join("");
}

function 本の窓を描く(){
  const w = 本窓;
  if(!w) return;
  const 座る = w.やること === "席に着く";
  if(w.申請) return 窓を出す("本の登録を申請する", `
    <p class="窓の文 小さく">一覧に無い本を教えてください。管理者が確かめてから<b>本登録</b>にします。
      それまでは<b>仮登録</b>ですが、申請したあなたは、この本ですぐに${座る ? "座れます" : "替えられます"}。</p>
    ${/* Amazon のリンク・ISBN から書誌を引く（Hongaeshi の申請の窓と同じ。2026-09-30 配信者） */ ""}
    <label class="名札" for="申amazon">Amazon の URL（任意・ここから書誌を引けます）</label>
    <div class="欄と釦">
      <input id="申amazon" class="欄" placeholder="https://www.amazon.co.jp/…/dp/4166612476">
      <button class="釦 枠だけ 小" data-する="Amazonから読む">読み取る</button>
    </div>
    <p class="注">紙の本の URL なら、書籍名・著者名・出版社名を自動で入れます。短縮リンク（amzn.asia/… など）も使えます。<b>リンク自体は保存しません。</b></p>
    <label class="名札" for="申isbn">ISBN（わかれば。あると確実です）</label>
    <div class="欄と釦">
      <input id="申isbn" class="欄" maxlength="20" inputmode="numeric" placeholder="9784166612475">
      <button class="釦 枠だけ 小" data-する="ISBNを確かめる">確かめる</button>
    </div>
    <div id="申請の確認"></div>
    <label class="名札" for="申題">書籍名（必須）</label>
    <input id="申題" class="欄" maxlength="120" value="${逃(w.探す)}">
    <label class="名札" for="申著">著者名（必須）</label>
    <input id="申著" class="欄" maxlength="80">
    <label class="名札" for="申版元">出版社名（必須）</label>
    <input id="申版元" class="欄" maxlength="80">
    <label class="名札" for="申ひとこと">ひとこと（任意）</label>
    <input id="申ひとこと" class="欄" maxlength="300" placeholder="例）文庫版です">
    <p class="注">書籍名だけでは別の本と取り違えるので、著者名と出版社名もお願いしています。</p>
    <div class="窓の釦">
      <button class="釦 全幅" data-する="申請して決める" ${w.送信中 ? "disabled" : ""}>${w.送信中 ? "送っています…" : 座る ? "申請して、この本で座る" : "申請して、この本に替える"}</button>
      <button class="釦 枠だけ 全幅" data-する="申請をとじる">一覧に戻る</button>
    </div>`);
  窓を出す(座る ? "いま読む本" : "本を替える", `
    <div class="出すか">
      <label><input type="radio" name="出すか" value="出す" ${w.出す ? "checked" : ""}> ユーザ名と書籍名を出す</label>
      <label><input type="radio" name="出すか" value="伏せる" ${w.出す ? "" : "checked"}> ユーザ名だけを出す（書籍名は出さない）</label>
    </div>
    ${w.出す ? `
      <label class="名札" for="本をさがす">本をさがす</label>
      <input id="本をさがす" class="欄" placeholder="書籍名か著者名" value="${逃(w.探す)}" autocomplete="off">
      <div class="本の候補" id="本の候補">${本の候補()}</div>
      <div class="申請への入口">
        <span>一覧に無いときは</span>
        <button class="釦 枠だけ 小" data-する="申請をひらく">＋ 本の登録を申請する</button>
      </div>
      <p class="注 近く">Amazon の URL から、書籍名・著者名・出版社名を自動で入れられます。</p>` : ""}
    <div class="窓の釦">
      ${w.出す ? `<p class="選んでいる本" id="選んでいる本">${選んでいる本の字(w)}</p>` : ""}
      <button class="釦 全幅 決める釦" id="決める釦" data-する="題を決める" ${w.出す && !w.選んだ ? "disabled" : ""}><span>${決める釦の字(w)}</span></button>
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
    <div class="釦たち 上の狭い間"><button class="釦 枠だけ 小" data-する="棚の本を選ぶ" data-本="${逃(棚の本.id)}">この本を選ぶ</button></div></div>`);
  const r = await ISBNで確かめる(isbn);
  if(!r) return 出す(`<p class="誤りの字">その ISBN の書誌は見つかりませんでした。下に手で書いてください。</p>`);
  const 入れる = (id, v)=>{ const e = document.getElementById(id); if(e && v) e.value = v; };
  入れる("申題", r.題); 入れる("申著", r.著); 入れる("申版元", r.版元); 入れる("申isbn", r.isbn);
  if(本窓) 本窓.申請のページ = r.ページ || 0;
  出す(`<div class="申請の知らせ">見つかりました。書籍名・著者名・出版社名を入れました。<br>
    <b>『${逃(r.題)}』</b> ${逃(r.著)}／${逃(r.版元)}${r.年 ? `・${逃(r.年)}` : ""}${r.ページ ? `・${r.ページ}ページ` : ""}</div>`);
}

/* どの席に座るか（2026-09-30 配信者「いつも同じ場所に座っている気がする。ランダムにしてほしい」）。
   前は空いている席の番号の若い順で、いつも同じベンチの同じ側だった。
   ⚠️ 「まず別々のベンチに1人ずつ、埋まったら隣に」は残す：
      誰も座っていないベンチの席から**ランダム**に → どのベンチにも人がいれば、隣の席から**ランダム**に。
      最後に、埋まって見える席も並べておく（12時間動きの無い席は、土台が空きとして座らせる） */
function 座る順(部屋){
  const 座られた = new Set(状態.席ら.map(s=>s.番));
  const 混ぜる = a => a.map(v=>[Math.random(), v]).sort((x, y)=>x[0] - y[0]).map(x=>x[1]);
  const 全部 = 部屋.席.map((_, i)=>i);
  const 空き = 全部.filter(i=>!座られた.has(i));
  const ひとり = 空き.filter(i=>部屋.席[i].相方 == null || !座られた.has(部屋.席[i].相方));
  const となり = 空き.filter(i=>!ひとり.includes(i));
  return [...混ぜる(ひとり), ...混ぜる(となり), ...全部.filter(i=>座られた.has(i))];
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
    if(w.やること === "席に着く") await 土台.座る(状態.部屋, 題, 座る順(部屋ら[状態.部屋]), 本);
    else await 土台.題を替える(題, 本);
    本窓 = null;
    窓を閉じる();
    窓口.手もとを描く();
  }catch(e){
    console.error(e);
    if(el) el.disabled = false;
    if(e.message === "満席です"){
      本窓 = null;
      窓を閉じる();
      窓口.手もとを描く();
      知らせる("ちょうど今、最後のベンチが埋まりました。空いたら、お知らせします", true);
    }else 知らせる(w.やること === "席に着く" ? "ベンチに座れませんでした" : "本を替えられませんでした", true);
  }
}

/* ⚠️⚠️ 選んだ本の取り違え（2026-10-01 配信者「『推し、燃ゆ』を選んだのに『「知」のソフトウェア』が出た」）。
   前に選んだ本を、はじめから選んだ状態にしている。絞り込むとその本は一覧から見えなくなるのに、**裏では選ばれたまま**で、
   「ベンチに座る」も押せた。しかも iPhone では、日本語を確定するひと押しで候補が描き直され、押した候補が選ばれなかった。
   → ①いま選んでいる本を、釦のすぐ上と釦の字にいつも出す ②絞り込んで見えなくなった本は、選んでいない状態に戻す
     ③候補の中身が変わらないときは描き直さない（確定のひと押しで、押した候補を入れ替えない） */
const 選んでいる本の字 = w => w.選んだ
  ? `選んでいる本：<b>『${逃(w.選んだ.題)}』</b> ${逃(w.選んだ.著)}` : "本を選んでください";

const 決める釦の字 = w => {
  const 座る = w.やること === "席に着く";
  if(!w.出す) return 座る ? "ユーザ名だけで座る" : "ユーザ名だけにする";
  if(!w.選んだ) return 座る ? "ベンチに座る" : "替える";
  return `『${逃(w.選んだ.題)}』${座る ? "で座る" : "に替える"}`;
};

function 選んでいる本を描く(){
  const w = 本窓;
  if(!w) return;
  const 字 = document.getElementById("選んでいる本"), 釦 = document.getElementById("決める釦");
  if(字) 字.innerHTML = 選んでいる本の字(w);
  if(釦){ 釦.innerHTML = `<span>${決める釦の字(w)}</span>`; 釦.disabled = w.出す && !w.選んだ; }
}

// 本をさがす欄は、打つたびに候補だけを描き直す（窓ごと描き直すと、打っている字の位置が飛ぶ）
document.addEventListener("input", e=>{
  if(e.target.id !== "本をさがす" || !本窓) return;
  本窓.探す = e.target.value;
  // 絞り込んで見えなくなった本は、選んでいない状態に戻す
  if(本窓.選んだ && !絞った本ら().some(b=>b.id === 本窓.選んだ.id)) 本窓.選んだ = null;
  const 候補 = document.getElementById("本の候補");
  const 新しい = 本の候補();
  if(候補 && 本窓.候補の控え !== 新しい){ 候補.innerHTML = 新しい; 本窓.候補の控え = 新しい; }
  選んでいる本を描く();
});

document.addEventListener("change", e=>{
  if(e.target.name !== "出すか" || !本窓) return;
  本窓.出す = e.target.value === "出す";
  本の窓を描く();
});

窓が閉じたら.add(()=>{ 本窓 = null; });   // 閉じたら本の画面の状態も消す（読み込みのあとで開き直らないように）
Object.assign(動き, {
  題を決める: el=>本で決める(el),
  本を選ぶ: el=>{
    本窓.選んだ = 本窓.本ら.find(b=>b.id === el.dataset.本) || null;
    // 窓ごと描き直さない（欄の文字も、一覧の位置もそのまま）。印と「選んでいる本」だけを直す
    document.querySelectorAll(".本の候補の札").forEach(b=>{
      const いま = b.dataset.本 === 本窓.選んだ?.id;
      b.classList.toggle("いま", いま);
      b.querySelector(".本の候補の字")?.setAttribute("aria-pressed", String(いま));
    });
    本窓.候補の控え = null;
    選んでいる本を描く();
  },
  申請をひらく: ()=>{ 本窓.申請 = true; 本の窓を描く(); document.getElementById("申題")?.focus(); },
  申請をとじる: ()=>{ 本窓.申請 = false; 本の窓を描く(); },
  申請して決める: async ()=>{
    const 値 = id => document.getElementById(id)?.value.trim() || "";
    const 申 = { 題:値("申題"), 著:値("申著"), 版元:値("申版元"), isbn:値("申isbn").replace(/[^0-9Xx]/g, ""), ひとこと:値("申ひとこと"),
      ページ:本窓.申請のページ || 0 };
    if(!申.題 || !申.著 || !申.版元) return 知らせる("書籍名・著者名・出版社名を入れてください", true);
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
    let u = document.getElementById("申amazon")?.value.trim() || "";
    // 短縮リンク（amzn.asia など）は、画面からは辿れないので裏の処理に辿ってもらう（2026-10-03 配信者）
    if(/^https?:\/\/(amzn\.asia|amzn\.to|a\.co|amzn\.com|link\.amazon)/i.test(u)){
      const 確認 = document.getElementById("申請の確認");
      if(確認) 確認.innerHTML = `<p class="注">短縮リンクを辿っています…</p>`;
      const 先 = await 土台.短縮リンクを辿る(u);
      if(!先){
        if(確認) 確認.innerHTML = "";
        return 知らせる("短縮リンクを辿れませんでした。一度開いて、出てきた URL を貼ってください", true);
      }
      u = 先;
    }
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
});
