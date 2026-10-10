/* ============================================================
   書誌を引く（本の申請の入力補助。2026-09-30 配信者「Hongaeshi と同様に、Amazon のリンクから自動入力」）

   Hongaeshi の 共通.js の AmazonのASIN・ISBN13にする・ISBNで確かめる と同じ考え方：
   ・**紙の本の ASIN は、たいてい ISBN-10 と同じ。**だから Amazon のリンクだけで書誌が引ける
   ・Kindle版などの ASIN は B0… で始まり、ISBN ではない → 引けない（紙の本のリンクをもらう）
   ・短縮リンク（link.amazon/…、amzn.to/…）はブラウザから辿れない（CORS で弾かれる）
   ・**リンク自体は保存しない。**ISBN を取り出すためだけに使う
   ・書誌は openBD から引く（速い。見つからなければ null。入力の補助なので、失敗しても止めない）
   ・著者欄は 名寄せ.js（Hongaeshi の写し）の規則で「山形浩生」の形にし、著でない人は「（訳）」のように役を添える
   ============================================================ */
import { 著者をばらす, 読める名に } from "./名寄せ.js";

export function AmazonのASIN(url){
  const m = String(url || "").match(/\/(?:dp|gp\/product|ASIN)\/([0-9A-Za-z]{10})/);
  return m ? m[1] : null;
}

export function ISBN13にする(isbn){
  const d = String(isbn || "").replace(/[^0-9Xx]/g, "");
  if(/^97[89][0-9]{10}$/.test(d)) return d;
  if(!/^[0-9]{9}[0-9Xx]$/.test(d)) return null;
  const 体 = "978" + d.slice(0, 9);
  let 和 = 0;
  for(let i = 0; i < 12; i++) 和 += Number(体[i]) * (i % 2 ? 3 : 1);
  return 体 + String((10 - (和 % 10)) % 10);
}

/* ============================================================
   Amazon のリンクと表紙（2026-10-04 配信者「本も表紙を小さく出したい。Hongaeshi のように Amazon のリンクを活用して」）

   Hongaeshi の 共通.js の Amazonの表紙・Amazonのリンク と同じ作り。タグも同じ（配信者が「タグ付きで」を選んだ）。
   ⚠️⚠️ **表紙の直リンク（images/P/{ASIN}）は、Amazon アソシエイトの規約上グレー。承知のうえで使っている。**
      規約は商品画像を PA-API から取ることを求めている。Hongaeshi と同じく、
      **表紙は必ずアフィリエイトのリンクと一緒に出す**（画面/本.js の 表紙）。リンクの無いところに表紙だけを出さない。
   ⚠️ サイトの下に「Amazon アソシエイト・プログラムの参加者です」の表示が要る（index.html・demo.html の裾）
   ・ASIN は、Hongaeshi で設定したリンクのもの（本棚.json の asin）を先に使い、無ければ ISBN-10（紙の本は ASIN と同じ）
   ・Kindle だけの本など、ISBN の無い本には出さない
   ・**Amazon は、表紙が無くても 1×1 の透明な絵を返す**（読めたかどうかでは分からない）→ 出たところの大きさで見る
   ============================================================ */
const アソシエイトタグ = "ucsd67001-22";

function ISBN10にする(isbn){
  const d = String(isbn || "").replace(/[^0-9Xx]/g, "");
  if(/^[0-9]{9}[0-9Xx]$/.test(d)) return d.toUpperCase();
  if(!/^978[0-9]{10}$/.test(d)) return null;   // 979 は ISBN-10 に直せない
  const 体 = d.slice(3, 12);
  let 和 = 0;
  for(let i = 0; i < 9; i++) 和 += Number(体[i]) * (10 - i);
  const 余 = 11 - (和 % 11);
  return 体 + (余 === 11 ? "0" : 余 === 10 ? "X" : String(余));
}

// 本 → { リンク, 表紙 } か null
export function Amazonの道(本){
  const a = (/^[0-9A-Z]{10}$/.test(本?.asin || "") ? 本.asin : null) || ISBN10にする(本?.isbn);
  if(!a) return null;
  return { リンク:`https://www.amazon.co.jp/dp/${a}?tag=${アソシエイトタグ}`,
    表紙:`https://m.media-amazon.com/images/P/${a}.01._SCLZZZZZZZ_.jpg` };
}

function 著者を読めるように(文字列){
  const 人ら = 著者をばらす(文字列 || "");
  if(!人ら.length) return 文字列 || "";
  return 人ら.map(a=>読める名に(a.名) + (a.役 && a.役 !== "著" ? `（${a.役}）` : "")).join("、");
}

// ISBN から書誌を引く。{ 題, 著, 版元, 年, isbn, ページ } か null
export async function ISBNで確かめる(isbn){
  const d = String(isbn || "").replace(/[^0-9Xx]/g, "");
  if(d.length < 10) return null;
  try{
    const [x] = await fetch(`https://api.openbd.jp/v1/get?isbn=${d}`).then(r=>r.json());
    if(!x?.summary?.title) return null;
    const v = x.summary;
    // ページ数は ONIX の Extent（種類 11＝本文のページ数）にあれば使う
    const 広さ = x.onix?.DescriptiveDetail?.Extent || [];
    const ページ = Number((広さ.find(e=>e.ExtentType === "11") || 広さ[0])?.ExtentValue) || 0;
    return { 題:v.title, 著:著者を読めるように(v.author), 版元:v.publisher || "",
      年:(v.pubdate || "").slice(0, 4), isbn:ISBN13にする(v.isbn || d) || d, ページ };
  }catch(e){ return null; }
}
