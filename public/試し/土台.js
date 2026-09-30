/* ============================================================
   GEMuの静かな読書会 ― 試しの土台（/demo）

   土台.js と**同じ名前の関数**を、Firebase を使わずにブラウザの中だけで動かす。
   画面（app.js）は本体とまったく同じものを使う。

   ・記録は localStorage。**タブごとに別の人**になる（sessionStorage に uid を持つ）。
     タブを2つ開くと、2人で同じ場所に座れる
   ・架空の仲間「しおり」が、はじめから席に1人いる
   ・アバターは OpenAI を呼ばずに、ブロックの仮の絵を描く

   ⚠️ 土台.js に関数を足したら、ここにも足す。足さないと試しだけが止まる。
   ============================================================ */

export const 試し = true;
export let 私 = null;

const 鍵 = "gemu試し2";   // ⚠️ 中身の形を変えたら数字を上げる（古い試しの記録を捨てる）
const 古いとみなす = 3 * 60 * 1000;
const 仲間 = "試し-しおり";

function 初め(){
  return {
    人: { [仲間]: { 名:"しおり", アバター:{ 状態:"ready", 座る:`試し:${仲間}:座る`, めくる:`試し:${仲間}:めくる`, 顔:`試し:${仲間}:顔` } } },
    席: { rothenburg: { 1: { uid:仲間, 題:"銀河鉄道の夜", 入った:Date.now() - 23 * 60000, 見た:Date.now() } } },
    記録: [],
    // 試しの本棚（本登録）。架空の仲間の申請中の本も1冊
    本: {
      b1:{ 題:"銀河鉄道の夜", 著:"宮沢賢治", 版元:"新潮社", 状態:"本登録" },
      b2:{ 題:"モモ", 著:"ミヒャエル・エンデ", 版元:"岩波書店", 状態:"本登録" },
      b3:{ 題:"はじめての哲学史", 著:"竹田青嗣、西研", 版元:"有斐閣", 状態:"本登録" },
      b4:{ 題:"こころ", 著:"夏目漱石", 版元:"新潮社", 状態:"本登録" },
      b5:{ 題:"草枕", 著:"夏目漱石", 版元:"新潮社", 状態:"本登録" },
      b6:{ 題:"星の王子さま", 著:"サン＝テグジュペリ", 版元:"岩波書店", 状態:"仮登録", 申請者:仲間 },
    },
  };
}
function 読む(){
  try{ return JSON.parse(localStorage.getItem(鍵)) || 初め(); }catch{ return 初め(); }
}
function 書く(s){
  try{ localStorage.setItem(鍵, JSON.stringify(s)); }catch{}
  鳴らす();
  try{ 通い?.postMessage(1); }catch{}
}

// ほかのタブの変化も拾う
const 聞き手 = new Set();
function 鳴らす(){ for(const f of 聞き手) f(); }
let 通い = null;
try{ 通い = new BroadcastChannel(鍵); 通い.onmessage = 鳴らす; }catch{}
addEventListener("storage", e=>{ if(e.key === 鍵) 鳴らす(); });
function 見張る(f){ 聞き手.add(f); f(); return ()=>聞き手.delete(f); }

/* ── 立ち上げ ───────────────────────────── */
let 変わったらを = ()=>{};
export async function 起動(変わったら){
  変わったらを = 変わったら;
  let uid = null;
  try{ uid = sessionStorage.getItem("gemu試しの私"); }catch{}
  私 = uid ? { uid, 名:"試しの読者", メール:"demo@example.com" } : null;
  変わったら({ 私 });
}
export async function 入る(){
  const uid = "試し-" + Math.random().toString(36).slice(2, 8);
  try{ sessionStorage.setItem("gemu試しの私", uid); }catch{}
  私 = { uid, 名:"試しの読者", メール:"demo@example.com" };
  変わったらを({ 私 });
}
export async function 出る(){
  await 立つ();
  try{ sessionStorage.removeItem("gemu試しの私"); }catch{}
  私 = null;
  変わったらを({ 私 });
}

/* ── 人 ─────────────────────────────── */
function 人に(uid, x){
  const a = x.アバター || {};
  return { uid, 名:x.名 || "", 反転:!!x.反転, アバター:{ 状態:a.状態 || "none", 段階:a.段階 || "",
    座る:a.座る || "", めくる:a.めくる || "", 顔:a.顔 || "",
    背中:a.座る ? `試し:${uid}:背中` : "", 背中の向き:a.座る ? "right" : "",
    向き:a.座る ? "right" : "", 誤り:a.誤り || "" } };   // 仮の絵は正面向きなので、右とみなす
}
export function 自分を見張る(届いたら){
  return 見張る(()=>{ const x = 読む().人[私?.uid]; 届いたら(x ? 人に(私.uid, x) : null); });
}
export function 人々を見張る(届いたら){
  return 見張る(()=>{
    const 人 = 読む().人;
    届いたら(new Map(Object.entries(人).map(([uid, x])=>[uid, 人に(uid, x)])));
  });
}
export async function 名を決める(名){
  const s = 読む();
  s.人[私.uid] = { ...(s.人[私.uid] || {}), 名 };
  書く(s);
}

export async function 向きを確かめる(){}
// 試しの絵はもともと data URL なので、そのまま返す。記録ページは作らず、試しの入口を返す
export async function 絵を借りる(道ら){
  const 返す = {};
  for(const 道 of 道ら.filter(Boolean)) 返す[道] = await 絵のURL(道);
  return 返す;
}
export async function 共有を作る(){ return location.origin + "/demo"; }
export async function 背中を足す(){}
export async function 向きを反対にする(反転){
  const s = 読む();
  s.人[私.uid] = { ...(s.人[私.uid] || {}), 反転 };
  書く(s);
}

const 待つ = ms => new Promise(r=>setTimeout(r, ms));
export async function アバターを作る(写真){
  const uid = 私.uid;
  const 段 = async (状態, 段階) => {
    const s = 読む();
    s.人[uid].アバター = { ...(s.人[uid].アバター || {}), 状態, 段階 };
    書く(s);
  };
  await 段("making", "座っている姿を描いています（1/3）"); await 待つ(1400);
  await 段("making", "ページをめくる姿・背中・顔を描いています（2/3）"); await 待つ(1400);
  await 段("making", "仕上げています（3/3）"); await 待つ(800);
  const s = 読む();
  s.人[uid].アバター = { 状態:"ready", 座る:`試し:${uid}:座る`, めくる:`試し:${uid}:めくる`, 顔:`試し:${uid}:顔` };
  書く(s);
}

export async function 絵のURL(道){
  const m = String(道 || "").match(/^試し:(.+):(座る|めくる|顔|背中)$/);
  return m ? ブロックの絵(m[1], m[2]) : "";
}

/* ── 席 ─────────────────────────────── */
function 生きた席(席){ return 席.uid === 仲間 || Date.now() - 席.見た < 古いとみなす; }

export function 席を見張る(部屋, 届いたら, { 合わせる = false } = {}){
  return 見張る(()=>{
    const 席ら = Object.entries(読む().席[部屋] || {}).map(([番, x])=>({ 番:Number(番), ...x,
      見た: x.uid === 仲間 ? Date.now() : x.見た })).filter(生きた席);
    届いたら(席ら, 合わせる ? 席を合わせる(部屋, 席ら) : null);
  });
}

/* ⚠️⚠️ 同じ人が PC とスマホの両方で開いたとき（2026-09-30 配信者「本を替えるが効かない」「PC とスマホで整合が取れない」）。
   前は、あとから座った端末が前の端末の席を消すのに、**前の端末は座っているつもりのまま**だった
   （「本を替える」は消えた席を書き換えようとして失敗し、「生きている」も空振りしていた）。
   → 席の様子が届くたびに、この端末の いま と、データベースの自分の席を突き合わせる：
     ・ほかの端末で座っている → この端末も、その席に座っている扱いにする（どちらからでも替えられ、読み終えられる）
     ・ほかの端末で本を替えた → この端末の区切りにも足す（記録が本ごとに正しく分かれる）
     ・ほかの端末で席を立った → この端末も立った扱いにする（届いたらに "ほかで立った" を渡す） */
function 席を合わせる(部屋, 席ら){
  const 自分の席 = 席ら.find(s=>s.uid === 私?.uid);
  if(いま && いま.部屋 === 部屋){
    if(!自分の席 || 自分の席.番 !== いま.番){ いま = null; return "ほかで立った"; }
    const 前 = いま.区切り.at(-1);
    if(自分の席.題 !== 前.題 || (自分の席.本 || "") !== (前.本 || ""))
      いま.区切り.push({ 題:自分の席.題, 本:自分の席.本 || "", 始め:Date.now() });
    return null;
  }
  if(!いま && 自分の席){
    いま = { 部屋, 番:自分の席.番, 入った:自分の席.入った,
      区切り:[{ 題:自分の席.題, 本:自分の席.本 || "", 始め:自分の席.入った }] };
    return "ほかで座っていた";
  }
  return null;
}


let いま = null;   // { 部屋, 番, 入った, 区切り }。記録は「読み終える」のときだけ（土台.js と同じ）
// 順：座ってみる席の番号の並び（画面の 座る順 が、空いたベンチを優先してランダムに決める）。数なら 0,1,2… の順
export async function 座る(部屋, 題, 順, 本 = ""){
  const 番ら = typeof 順 === "number" ? [...Array(順).keys()] : 順;
  await 立つ();
  const s = 読む();
  const 席ら = s.席[部屋] ||= {};
  for(const [番, x] of Object.entries(席ら)) if(x.uid === 私.uid) delete 席ら[番];
  for(const 番 of 番ら){
    const x = 席ら[番];
    if(x && x.uid !== 私.uid && 生きた席(x)) continue;
    席ら[番] = { uid:私.uid, 題, 本, 入った:Date.now(), 見た:Date.now() };
    書く(s);
    いま = { 部屋, 番, 入った:Date.now(), 区切り:[{ 題, 本, 始め:Date.now() }] };
    return 番;
  }
  throw new Error("満席です");
}
export async function 題を替える(題, 本 = ""){
  if(!いま) throw new Error("座っていません");
  const s = 読む();
  const 席 = s.席[いま.部屋]?.[いま.番];
  いま.区切り.push({ 題, 本, 始め:Date.now() });   // 書く前に足す（土台.js と同じ）
  if(席){ 席.題 = 題; 席.本 = 本; 席.見た = Date.now(); }
  書く(s);
}
export async function 生きている(){
  if(!いま) return;
  const s = 読む();
  const 席 = s.席[いま.部屋]?.[いま.番];
  if(席) 席.見た = Date.now();
  書く(s);
}
export async function 立つ({ 記録する = false, 読了 = null } = {}){
  if(!いま) return;
  if(!記録する){ いま = null; return; }   // 席を消すのは「読み終える」のときだけ（土台.js と同じ）
  const s = 読む();
  if(記録する && 読了) (s.読了 ||= []).push({ uid:私.uid, 題:読了.題, ページ:読了.ページ, いつ:Date.now() });
  if(記録する){
    const 終わり = Date.now();
    いま.区切り.forEach((k, i)=>{
      s.記録.push({ id:Math.random().toString(36).slice(2), uid:私.uid, 部屋:いま.部屋, 題:k.題 || 題を出さない印,
        始め:k.始め, 終わり:いま.区切り[i + 1]?.始め ?? 終わり });
    });
  }
  if(s.席[いま.部屋]?.[いま.番]?.uid === 私?.uid) delete s.席[いま.部屋][いま.番];
  いま = null;
  書く(s);
}
export const 座っている = () => いま ? { ...いま } : null;

export const 題を出さない印 = "（題を出さずに読んだ本）";
// 本（土台.js と同じ形）。試しの人は管理者でもある（管理の頁を試すため）
const 本ら = s => Object.entries(s.本 ||= {}).map(([id, x])=>({ id, 題:x.題, 著:x.著, 版元:x.版元 || "",
  isbn:x.isbn || "", ひとこと:x.ひとこと || "", ページ:x.ページ || 0, 状態:x.状態, 申請者:x.申請者 || "" }));

/* Hongaeshi から写した本棚（public/本棚.json。04_tools/Hongaeshiから写す.mjs で作る）。
   **本登録の本**として一覧に混ぜる（2026-09-29 配信者「Hongaeshi の図書データをコピーして」）。
   ⚠️ Firestore には入っていない（こちらの管理用の鍵が無いため）。id は "h-…" */
let 本棚の約束 = null;
function 本棚を読む(){
  本棚の約束 ||= fetch("/本棚.json").then(r=>r.ok ? r.json() : { 本:[] })
    .then(j=>(j.本 || []).map(b=>({ ...b, ひとこと:"", 状態:"本登録", 申請者:"" })))
    .catch(()=>[]);
  return 本棚の約束;
}
export async function 本らを読む(){
  const 棚 = await 本棚を読む();
  return [...棚, ...本ら(読む()).filter(b=>b.状態 === "本登録" || (b.状態 === "仮登録" && b.申請者 === 私.uid))];
}
export async function 本を申請する({ 題, 著, 版元, isbn, ひとこと, ページ = 0 }){
  const s = 読む();
  const id = "b" + Math.random().toString(36).slice(2, 8);
  (s.本 ||= {})[id] = { 題, 著, 版元, isbn, ひとこと, ページ, 状態:"仮登録", 申請者:私.uid };
  書く(s);
  return { id, 題, 著, 版元, isbn, ひとこと, ページ, 状態:"仮登録", 申請者:私.uid };
}
export async function 管理者か(){ return true; }
export async function 申請らを読む(){ return 本ら(読む()).filter(b=>b.状態 === "仮登録"); }
export async function 申請を決める(id, 承認, 直し = {}){
  const s = 読む();
  const b = s.本?.[id];
  if(!b) return;
  b.状態 = 承認 ? "本登録" : "見送り";
  if(直し.題) b.題 = 直し.題;
  if(直し.著) b.著 = 直し.著;
  if(直し.版元) b.版元 = 直し.版元;
  書く(s);
}
export async function 読了を読む(){
  return (読む().読了 || []).filter(x=>x.uid === 私.uid).map(({ 題, ページ, いつ })=>({ 題, ページ, いつ }));
}
// 試しでは、この端末の中の記録から数える（架空の仲間にも少し数を持たせる）
export async function 読み方を読む(){
  const s = 読む();
  const 計 = new Map([[仲間, { 冊:3, ページ:820, 分:340 }]]);
  const 足す = (uid, k, v)=>{ const x = 計.get(uid) || { 冊:0, ページ:0, 分:0 }; x[k] += v; 計.set(uid, x); };
  for(const r of s.記録) 足す(r.uid, "分", Math.max(0, r.終わり - r.始め) / 60000);
  for(const r of (s.読了 || [])){ 足す(r.uid, "冊", 1); 足す(r.uid, "ページ", r.ページ || 0); }
  const 上位 = k => [...計].filter(([uid, v])=>Math.round(v[k]) > 0 && s.人[uid])
    .sort((a, b)=>b[1][k] - a[1][k]).slice(0, 3)
    .map(([uid, v])=>({ uid, 名:s.人[uid].名, 顔:s.人[uid].アバター?.顔 || "", 数:Math.round(v[k]) }));
  return { 冊:上位("冊"), ページ:上位("ページ"), 分:上位("分") };
}
export async function 記録を読む(){
  return 読む().記録.filter(x=>x.uid === 私.uid)
    .sort((a, b)=>b.始め - a.始め)
    .map(({ 部屋, 題, 始め, 終わり })=>({ 部屋, 題, 始め, 終わり }));
}

/* ── ブロックの仮の絵 ───────────────────────────
   32×32 の升目で、椅子に座って本を読む人を描く。色は uid から決める。
   本物（OpenAI で作る絵）と同じく「椅子ごと」「背景は透明」。 */
function ブロックの絵(uid, 種){
  let h = 0;
  for(const c of uid) h = (h * 31 + c.codePointAt(0)) % 360;
  const 服 = `hsl(${h} 45% 52%)`, 服の影 = `hsl(${h} 45% 40%)`;
  const 髪 = ["#3b2a20", "#6b4428", "#1f1f24", "#a0703a"][h % 4];
  const 肌 = ["#f1c9a5", "#e0b089", "#c98f64"][h % 3];
  const 升 = (x, y, w, hh, c) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${c}"/>`;

  const 頭 =
    升(11, 3, 10, 10, 肌) + 升(11, 3, 10, 3, 髪) + 升(11, 6, 1, 4, 髪) + 升(20, 6, 1, 4, 髪) +
    升(13, 8, 2, 2, "#2b2233") + 升(17, 8, 2, 2, "#2b2233") + 升(15, 11, 2, 1, "#b8715a");

  if(種 === "顔"){
    return 絵に(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="9 2 14 14" shape-rendering="crispEdges">
      ${頭}${升(10, 13, 12, 3, 服)}</svg>`);
  }
  const 椅子 =
    升(8, 9, 16, 14, "#8a5a3b") + 升(9, 10, 14, 12, "#a06c47") +
    升(7, 22, 18, 3, "#7a4e33") + 升(8, 25, 2, 6, "#6e4630") + 升(22, 25, 2, 6, "#6e4630");
  const 体 =
    升(11, 14, 10, 8, 服) + 升(11, 21, 10, 3, "#3d3f5c") +
    升(11, 24, 3, 6, "#3d3f5c") + 升(18, 24, 3, 6, "#3d3f5c") +
    升(10, 30, 5, 1, "#2a2230") + 升(17, 30, 5, 1, "#2a2230") +
    升(9, 15, 2, 5, 服の影) + 升(21, 15, 2, 5, 服の影);
  const 本 =
    升(9, 17, 14, 5, "#7b2f2f") + 升(10, 17, 5, 4, "#fbf6ea") + 升(17, 17, 5, 4, "#fbf6ea") +
    升(15, 17, 2, 5, "#5d2323") + 升(9, 19, 2, 2, 肌) + 升(21, 19, 2, 2, 肌);
  if(種 === "背中"){
    // 後ろから：頭は髪だけ、椅子の背もたれが体の手前にくる
    return 絵に(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
      ${升(11, 14, 10, 8, 服)}${升(9, 15, 2, 5, 服の影)}${升(21, 15, 2, 5, 服の影)}
      ${升(11, 3, 10, 10, 髪)}${升(11, 12, 10, 1, 肌)}
      ${升(8, 15, 16, 10, "#8a5a3b")}${升(9, 16, 14, 8, "#a06c47")}
      ${升(7, 24, 18, 2, "#7a4e33")}${升(8, 26, 2, 5, "#6e4630")}${升(22, 26, 2, 5, "#6e4630")}</svg>`);
  }
  const めくり = 種 === "めくる" ? 升(17, 13, 4, 4, "#fffaf0") + 升(20, 15, 2, 2, 肌) : "";
  return 絵に(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
    ${椅子}${体}${頭}${本}${めくり}</svg>`);
}
const 絵に = svg => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
