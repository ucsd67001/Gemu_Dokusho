/* ============================================================
   本の表紙と書籍名（Amazon のリンクと一緒に）・本を引く表
   ============================================================ */
import { 土台, 逃 } from "./共通.js";
import { Amazonの道 } from "../書誌.js";

export const 本の見出し = b => [b.著, b.版元].filter(Boolean).join("／") + (b.状態 === "仮登録" ? "（仮登録）" : "");

/* ⚠️⚠️ 本の表紙（2026-10-04 配信者「本も表紙を小さく出したい。Hongaeshi のように Amazon のリンクを活用して」）。
   出すのは4か所：ベンチでひらかれた本／いま読む本を選ぶところ／読んでいる本（場所の下）／記録のページ。
   **表紙は必ず Amazon のリンク（アフィリエイトのタグ付き）と一緒に出す**（規約上グレーな直リンクなので。書誌.js の注）。
   押すと Amazon の本のページが新しいタブで開く。ASIN の無い本は、無地の背表紙だけ（リンクも無し）。
   表紙が無い本（Amazon が 1×1 の絵を返す）は、絵を外して無地にする（下の load / error を見張るところ） */
export function 表紙(本, 大きさ = "小"){
  const 道 = 本 ? Amazonの道(本) : null;
  if(!道) return `<span class="表紙 ${大きさ}" aria-hidden="true"></span>`;
  return `<a class="表紙 ${大きさ}" href="${逃(道.リンク)}" target="_blank" rel="noopener sponsored" title="Amazon で見る">`
    + `<img class="表紙の絵" src="${逃(道.表紙)}" alt="" loading="lazy"></a>`;
}

/* 書籍名の文字にも、表紙と同じ Amazon のリンクを付ける（2026-10-04 配信者「表紙だけでなく、書籍名にも」）。
   ASIN の無い本は文字のまま。⚠️ いま読む本を選ぶところでは付けない（書籍名を押すと本を選ぶため。表紙からは開ける） */
export function 書籍名(本, 題){
  const 字 = `『${逃(題)}』`;
  const 道 = 本 ? Amazonの道(本) : null;
  return 道 ? `<a class="書籍名のリンク" href="${逃(道.リンク)}" target="_blank" rel="noopener sponsored" title="Amazon で見る">${字}</a>` : 字;
}

document.addEventListener("load", e=>{
  const el = e.target;
  if(el.classList?.contains("表紙の絵") && (el.naturalWidth <= 2 || el.naturalHeight <= 2)) el.remove();
}, true);

document.addEventListener("error", e=>{ if(e.target.classList?.contains("表紙の絵")) e.target.remove(); }, true);

/* 本の id（無ければ書籍名）から本を引く。記録・ランキング・場所の下で表紙を出すため。
   本棚と本登録の本を一度だけ読んで覚えておく */
let 本の表の約束 = null;

export function 本の表(){
  本の表の約束 ||= 土台.本らを読む().then(本ら=>{
    const id = new Map(本ら.map(b=>[b.id, b]));
    const 題 = new Map();
    for(const b of 本ら) if(!題.has(b.題)) 題.set(b.題, b);
    return 本の表の今 = { 引く:(本, 書籍名)=>id.get(本) || 題.get(書籍名) || null };
  }).catch(()=>({ 引く:()=>null }));
  return 本の表の約束;
}

// 読めたあとの表（場所の下は、待たずに描くので。部屋の頁で読み終えたら描き直す）
export let 本の表の今 = { 引く:()=>null };
