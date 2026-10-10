/* ============================================================
   X に載る絵（読み終えるときに作る、場所の絵と書籍名・時間の1枚）
   ============================================================ */
import { 部屋ら } from "../部屋.js";
import { 土台, 状態, 時間に } from "./共通.js";
import { 描くもの, 奥から, 下げるか } from "./ベンチ.js";

const 絵を読む = src => new Promise((ok, ng)=>{
  const 絵 = new Image();
  絵.onload = ()=>ok(絵);
  絵.onerror = ng;
  絵.src = src;
});

// 長い題は … で切る（『』は残す）
function 詰める(g, 文, 幅, 終わり = "…』"){
  if(g.measureText(文).width <= 幅) return 文;
  let t = 文;
  while(t.length > 2 && g.measureText(t + 終わり).width > 幅) t = t.slice(0, -1);
  return t + 終わり;
}

/* X に載る絵（1200×630。X の大きな画像の形）。場所の絵に、いま座っている人と空のベンチを描き、
   上に紙の帯を敷いて、書名・場所・時間を書く。
   ⚠️ 場所の絵と空のベンチは同じ場所（Hosting）なので、そのまま canvas に描ける。
      アバターは Storage にあるので、裏の処理から data URL で借りる（土台.絵を借りる） */
export async function 共有の絵を描く(題, 分, 場所){
  const 部屋 = 部屋ら[状態.部屋];
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  await Promise.all([
    document.fonts.load('600 42px "Zen Old Mincho"'),
    document.fonts.load('400 24px "Zen Old Mincho"'),
  ]).catch(()=>{});

  const 背景 = await 絵を読む(部屋.絵);
  const 高さ = W * 背景.naturalHeight / 背景.naturalWidth;
  const ずらし = -(高さ - H) * 0.6;   // 上を少し切る（帯の下に、ベンチが来るように）
  g.fillStyle = "#f3e7d3";
  g.fillRect(0, 0, W, H);
  g.drawImage(背景, 0, ずらし, W, 高さ);

  // 何をどちら向きに描くかは、場所の絵と同じ（ベンチ.js の 描くもの）
  const 並び = 描くもの(部屋, 状態.席ら);
  const 借りた = await 土台.絵を借りる(並び.map(x=>x.座る).filter(Boolean)).catch(()=>({}));
  for(const x of 並び){
    const src = x.空き || 借りた[x.座る];
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

  /* 名札（名前と『題』）を、座っている全員の足もとに（2026-09-30 配信者「他のユーザのユーザ名と書籍名も表示してOK」）。
     場所の画面と同じ形：自分だけ紫の縁／同じベンチに2人いれば2人目の名札を1段下げる／長い題は … で切る。
     ⚠️ 8人でも重ならないよう、幅は場所の画面と同じくらい（絵の幅の 12%）に詰める
     （前は自分の名札だけを大きく描いていた。ほかの人の名前と本は入れていなかった） */
  const 座られた番 = new Set(状態.席ら.map(s=>s.番));
  const 名札の幅 = W * 0.12, 字 = 14;
  for(const s of 奥から(部屋, 状態.席ら)){
    const 席 = 部屋.席[s.番];
    if(!席) continue;
    const 自分 = s.uid === 状態.私.uid;
    const 名 = (自分 ? 状態.自分?.名 : 状態.人々.get(s.uid)?.名) || "";
    const 本の題 = 自分 ? 題 : s.題;
    g.font = `600 ${字}px "Hiragino Sans","Yu Gothic UI","Yu Gothic",sans-serif`;
    const 名の文 = 詰める(g, 名, 名札の幅 - 12, "…");
    const 名の幅 = g.measureText(名の文).width;
    g.font = `400 ${字}px "Zen Old Mincho", serif`;
    const 題の文 = 本の題 ? 詰める(g, `『${本の題}』`, 名札の幅 - 12) : "";
    const 幅 = Math.max(名の幅, 題の文 ? g.measureText(題の文).width : 0) + 14, 丈 = 題の文 ? 44 : 26;
    const 下段 = 下げるか(席, 座られた番);
    const 中 = W * 席.x / 100;
    const 上 = ずらし + 高さ * 席.y / 100 + 4 + (下段 ? 丈 + 6 : 0);
    const 左 = Math.max(4, Math.min(W - 幅 - 4, 中 - 幅 / 2));
    g.fillStyle = "rgba(255,253,255,.94)";
    g.fillRect(左, 上, 幅, 丈);
    g.strokeStyle = 自分 ? "#6b4bc4" : "rgba(38,28,66,.3)";
    g.lineWidth = 自分 ? 1.5 : 1;
    g.strokeRect(左 + .75, 上 + .75, 幅 - 1.5, 丈 - 1.5);
    g.textAlign = "center";
    g.fillStyle = "#17141f";
    g.font = `600 ${字}px "Hiragino Sans","Yu Gothic UI","Yu Gothic",sans-serif`;
    g.fillText(名の文, 左 + 幅 / 2, 上 + 18);
    if(題の文){
      g.fillStyle = "#59526b";
      g.font = `400 ${字}px "Zen Old Mincho", serif`;
      g.fillText(題の文, 左 + 幅 / 2, 上 + 36);
    }
  }

  // 上の紙の帯
  g.fillStyle = "rgba(255,253,255,.92)";
  g.fillRect(0, 0, W, 132);
  g.fillStyle = "rgba(38,28,66,.13)";
  g.fillRect(0, 132, W, 1);
  g.textAlign = "left";
  g.fillStyle = "#17141f";
  g.font = '600 42px "Zen Old Mincho", serif';
  g.fillText(題 ? 詰める(g, `『${題}』`, W - 80) : `${時間に(分)}、読みました`, 40, 66);
  g.fillStyle = "#59526b";
  g.font = '400 24px "Zen Old Mincho", serif';
  g.fillText(題 ? `${場所}のベンチで、${時間に(分)}読みました` : `${場所}のベンチで`, 40, 110);
  g.textAlign = "right";
  g.fillStyle = "#6b4bc4";
  g.font = '600 18px "Hiragino Sans","Yu Gothic UI","Yu Gothic",sans-serif';
  g.fillText("GEMuの静かな読書会", W - 40, 110);

  return new Promise((ok, ng)=>c.toBlob(b=>b ? ok(b) : ng(new Error("書き出せませんでした")), "image/jpeg", .9));
}
