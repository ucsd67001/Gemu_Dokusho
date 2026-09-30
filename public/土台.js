/* ============================================================
   GEMuの静かな読書会 ― 土台（Firebase との境目）

   ⚠️⚠️ **Firestore の中だけ、名前が ASCII。**（Hongaeshi と同じ理由。ルールの言語が日本語を受け付けない）
      読み書きの境目にあたる**このファイルだけが両方の名前を知っている。**
      外へ出すものは、必ず日本語のかたちに直してから返す。

        users/{uid}                 → 人   { 名, 反転, アバター{ 状態, 段階, 座る, めくる, 顔, 背中, 向き, 背中の向き, 誤り } }
        rooms/{room}/seats/{番}     → 席   { 番, uid, 題, 入った, 見た }
        logs/{id}                   → 記録 { 部屋, 題, 始め, 終わり }
        finishes/{id}               → 読了 { 題, ページ, いつ }
        books/{id}                  → 本   { id, 題, 著, 版元, isbn, ひとこと, 状態, 申請者 }  状態＝仮登録／本登録／見送り
        admins/{uid}                → 管理者か

   ⚠️ **試し（/demo）では、このファイルの代わりに 試し/土台.js を読む。**
      ここで外へ出す関数を足したら、**試し/土台.js にも同じ名前で足すこと。**
      足さないと、試しだけが読み込みで止まる。

   ⚠️ Firebase の設定値は書かない。Hosting が /__/firebase/init.json を配る（Hongaeshi と同じ）。
   ============================================================ */

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection,
  query, where, orderBy, limit, onSnapshot, runTransaction, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref as 置き場, getDownloadURL, uploadBytes }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getFunctions, httpsCallable }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";

export const 試し = false;

let app, auth, db, 倉, 呼ぶ;
export let 私 = null;        // { uid, 名, メール }

const 古いとみなす = 3 * 60 * 1000;   // firestore.rules の stale() と同じ3分

/* ── 立ち上げ ───────────────────────────────
   変わったら({ 私 }) を、ログインの状態が変わるたびに呼ぶ。
   ⚠️ 招待の一覧は無い。Google で入った人は、名前と写真を決めればそのまま登録になる */
export async function 起動(変わったら){
  const 設定 = await fetch("/__/firebase/init.json").then(r=>{
    if(!r.ok) throw new Error("init.json が読めません（firebase serve か Hosting で開いてください）");
    return r.json();
  });
  app  = initializeApp(設定);
  auth = getAuth(app);
  db   = getFirestore(app);
  倉   = getStorage(app);
  呼ぶ = getFunctions(app, "asia-northeast1");

  onAuthStateChanged(auth, u=>{
    私 = u ? { uid:u.uid, 名:u.displayName || "", メール:u.email } : null;
    変わったら({ 私 });
  });
}

export function 入る(){
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt:"select_account" });
  return signInWithPopup(auth, p).catch(e=>{
    if(e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") throw e;
  });
}
export async function 出る(){
  await 立つ().catch(()=>{});
  return signOut(auth);
}

/* ── 人 ─────────────────────────────── */
function 人に(d){
  const x = d.data() || {}, a = x.avatar || {};
  return {
    uid: d.id,
    名: x.name || "",
    反転: !!x.flip,          // 本人が「向きを反対にする」を押したか
    アバター: {
      状態: a.status || "none",   // none / making / ready / failed
      段階: a.step || "",
      座る: a.sit || "", めくる: a.turn || "", 顔: a.face || "",
      向き: a.facing || "",    // 座る姿の向き "left" / "right"。まだ見ていなければ ""
      背中: a.back || "",      // 後ろから見た姿（手前の席）。背中を足す前に作ったアバターには無い
      背中の向き: a.backFacing || "",
      誤り: a.error || "",
    }
  };
}

// 自分の記録。まだ名前を決めていなければ null
export function 自分を見張る(届いたら){
  return onSnapshot(doc(db, "users", 私.uid), s=>届いたら(s.exists() ? 人に(s) : null),
    e=>{ console.error(e); 届いたら(null); });
}

// 部屋にいる人の名前と絵を引くため。人数が少ないうちは全員ぶんを見張る（増えたら、席にいる人だけに絞る）
export function 人々を見張る(届いたら){
  return onSnapshot(collection(db, "users"),
    s=>届いたら(new Map(s.docs.map(d=>[d.id, 人に(d)]))),
    e=>console.error(e));
}

export async function 名を決める(名){
  const r = doc(db, "users", 私.uid);
  const s = await getDoc(r);
  if(s.exists()) await updateDoc(r, { name:名 });
  else await setDoc(r, { name:名, created:serverTimestamp() });
}

// 写真（data URL）を裏の処理へ渡す。できあがりは 自分を見張る に届く
export async function アバターを作る(写真){
  const f = httpsCallable(呼ぶ, "makeAvatar", { timeout: 540000 });
  await f({ photo:写真 });
}

// 向きを記録する前に作ったアバターのため。記録されていなければ、裏の処理が一度だけ見る
export async function 向きを確かめる(){
  await httpsCallable(呼ぶ, "detectFacing", { timeout: 60000 })({});
}
// 背中の姿が無いアバターに、背中だけを足す（1回に数える）
export async function 背中を足す(){
  await httpsCallable(呼ぶ, "addBack", { timeout: 300000 })({});
}
export async function 向きを反対にする(反転){
  await updateDoc(doc(db, "users", 私.uid), { flip:反転 });
}

const URLの控え = new Map();
export async function 絵のURL(道){
  if(!道) return "";
  if(!URLの控え.has(道)) URLの控え.set(道, getDownloadURL(置き場(倉, 道)).catch(e=>{
    URLの控え.delete(道); throw e;
  }));
  return URLの控え.get(道);
}

/* ── 席 ─────────────────────────────────
   ⚠️ 席の文書の id が席の番号。1人1席。
   ⚠️ 1分ごとに seen を延ばす。3分延びていない席は空きとみなす（タブを閉じた人の席）。 */
function 席に(d){
  const x = d.data() || {};
  return { 番:Number(d.id), uid:x.uid, 題:x.title || "", 本:x.book || "",
    入った:x.since?.toMillis?.() || Date.now(), 見た:x.seen?.toMillis?.() || Date.now() };
}
const 生きた席 = 席 => Date.now() - 席.見た < 古いとみなす;

// 届いたら(席ら, 出来事)。出来事は "ほかで立った"／"ほかで座っていた"／null
// ⚠️ 突き合わせる（合わせる：true）のは、場所の中にいるときだけ。一覧を見ているだけの端末を、座っている扱いに戻さない
export function 席を見張る(部屋, 届いたら, { 合わせる = false } = {}){
  return onSnapshot(collection(db, "rooms", 部屋, "seats"),
    s=>{ const 席ら = s.docs.map(席に).filter(生きた席); 届いたら(席ら, 合わせる ? 席を合わせる(部屋, 席ら) : null); },
    e=>console.error(e));
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

/* ⚠️⚠️ 読んだ時間の記録は、**「読み終える」で終えたときだけ**書く（2026-09-29 配信者）。
      座っているあいだは書かない。本を替えた区切り（題と始めの時刻）は、ここで覚えておくだけ。
      ほかの頁へ移る・タブを閉じる・ログアウトは、席を立つだけで記録しない。
      （前は座った瞬間に記録を作り、1分ごとに延ばしていた。閉じただけの回も残っていた） */
let いま = null;   // { 部屋, 番, 入った, 区切り:[{ 題, 本, 始め }] }　題が空＝名札に出さない

export async function 座る(部屋, 題, 席の数, 本 = ""){
  await 立つ();
  // ほかのタブで座ったままの自分の席を片づける
  const 今の席ら = await getDocs(collection(db, "rooms", 部屋, "seats"));
  await Promise.all(今の席ら.docs.filter(d=>d.data().uid === 私.uid).map(d=>deleteDoc(d.ref)));

  for(let 番 = 0; 番 < 席の数; 番++){
    const r = doc(db, "rooms", 部屋, "seats", String(番));
    try{
      await runTransaction(db, async tx=>{
        const s = await tx.get(r);
        if(s.exists()){
          const 席 = 席に(s);
          if(席.uid !== 私.uid && 生きた席(席)) throw new Error("塞がっている");
        }
        tx.set(r, { uid:私.uid, title:題, since:serverTimestamp(), seen:serverTimestamp(), ...(本 ? { book:本 } : {}) });
      });
    }catch(e){ continue; }
    const 今 = Date.now();
    いま = { 部屋, 番, 入った:今, 区切り:[{ 題, 本, 始め:今 }] };
    return 番;
  }
  throw new Error("満席です");
}

export async function 題を替える(題, 本 = ""){
  if(!いま) throw new Error("座っていません");
  // ⚠️ 区切りは書く前に足す（書いた瞬間に届く席の様子で、同じ区切りが二重に足されないように）
  const 区切り = { 題, 本, 始め:Date.now() };
  いま.区切り.push(区切り);
  try{
    await updateDoc(doc(db, "rooms", いま.部屋, "seats", String(いま.番)), { title:題, book:本 || "", seen:serverTimestamp() });
  }catch(e){
    if(いま) いま.区切り = いま.区切り.filter(k=>k !== 区切り);
    throw e;
  }
}

export async function 生きている(){
  if(!いま) return;
  await updateDoc(doc(db, "rooms", いま.部屋, "seats", String(いま.番)), { seen:serverTimestamp() });
}

export const 題を出さない印 = "（題を出さずに読んだ本）";

/* 席を立つ。記録する＝true は「読み終える」のときだけ。本を替えた区切りごとに1件ずつ書く。
   読了＝{ 題, ページ } を渡すと、読了も1件書く（「この本を最後まで読んだ」に印を付けたとき） */
export async function 立つ({ 記録する = false, 読了 = null } = {}){
  if(!いま) return;
  const 席 = いま; いま = null;
  /* ⚠️ 席を消すのは「読み終える」（記録する）のときだけ（2026-09-30）。
        頁を離れた・タブを閉じた・ログアウトは、**この端末が座っているつもりをやめるだけ。**
        ほかの端末で読み続けていれば、その端末が「生きている」を送って席を保つ。どこも読んでいなければ3分で空く。
        （前は離れるたびに席を消していて、スマホのタブを閉じると PC で読んでいる席まで消えた） */
  if(!記録する) return;
  const 書く = [];
  if(記録する){
    const 終わり = Date.now();
    席.区切り.forEach((k, i)=>{
      const 次 = 席.区切り[i + 1]?.始め ?? 終わり;
      // ⚠️ 題を出さなかった区切りも、時間は残す（自分の記録にだけ「題を出さずに読んだ本」として）
      書く.push(addDoc(collection(db, "logs"), { uid:私.uid, room:席.部屋, title:k.題 || 題を出さない印,
        from:Timestamp.fromMillis(k.始め), to:Timestamp.fromMillis(次), ...(k.本 ? { book:k.本 } : {}) }));
    });
  }
  if(記録する && 読了) 書く.push(addDoc(collection(db, "finishes"),
    { uid:私.uid, title:読了.題, pages:読了.ページ, at:serverTimestamp(), ...(読了.本 ? { book:読了.本 } : {}) }));
  await Promise.all([
    ...書く,
    deleteDoc(doc(db, "rooms", 席.部屋, "seats", String(席.番))).catch(()=>{}),
  ]);
}

export const 座っている = () => いま ? { ...いま } : null;

/* ── X に投稿する ─────────────────────────────
   読み終えたときの絵は、画面の canvas で描く（字は画面のフォントで描けるため）。
   ⚠️ Storage の絵をそのまま canvas に描くと書き出せなくなる（別の場所の絵なので）。裏の処理から data URL で借りる */
export async function 絵を借りる(道ら){
  const r = await httpsCallable(呼ぶ, "borrowImages", { timeout: 30000 })({ paths:道ら.filter(Boolean) });
  return r.data?.images || {};
}

// 絵（Blob）を置き、記録を作って、記録ページの URL を返す。X はこのページから絵を読み取る
export async function 共有を作る(絵, { 題, 分, 場所 }){
  const 記録 = doc(collection(db, "shares"));
  const 道 = 置き場(倉, `shares/${私.uid}/${記録.id}.jpg`);
  await uploadBytes(道, 絵, { contentType:"image/jpeg", cacheControl:"public, max-age=31536000" });
  const image = await getDownloadURL(道);
  await setDoc(記録, { uid:私.uid, title:題, minutes:分, place:場所, image, created:serverTimestamp() });
  return `${location.origin}/s/${記録.id}`;
}

/* ── 本 ──────────────────────────────────
   入室のときに選ぶ。無ければ申請して仮登録。管理者が承認して本登録（2026-09-29 配信者）。
   ⚠️ 読めるのは、本登録の本と、自分が申請した本（仮登録も）。管理者は全部 */
const 状態の名 = { pending:"仮登録", approved:"本登録", rejected:"見送り" };
function 本に(d){
  const x = d.data() || {};
  return { id:d.id, 題:x.title || "", 著:x.author || "", 版元:x.publisher || "", isbn:x.isbn || "",
    ひとこと:x.note || "", ページ:x.pages || 0, 状態:状態の名[x.status] || x.status, 申請者:x.requestedBy || "" };
}

/* Hongaeshi から写した本棚（public/本棚.json。04_tools/Hongaeshiから写す.mjs で作る）。
   **本登録の本**として一覧に混ぜる（2026-09-29 配信者「Hongaeshi の図書データをコピーして」）。
   ⚠️ Firestore には入っていない（こちらの管理用の鍵が無いため）。id は "h-…" */
let 本棚の約束 = null;
export function 本棚を読む(){
  本棚の約束 ||= fetch("/本棚.json").then(r=>r.ok ? r.json() : { 本:[] })
    .then(j=>(j.本 || []).map(b=>({ ...b, ひとこと:"", 状態:"本登録", 申請者:"" })))
    .catch(()=>[]);
  return 本棚の約束;
}
export async function 本らを読む(){
  const [本登録, 自分の, 棚] = await Promise.all([
    getDocs(query(collection(db, "books"), where("status", "==", "approved"))),
    getDocs(query(collection(db, "books"), where("requestedBy", "==", 私.uid))),
    本棚を読む(),
  ]);
  const 表 = new Map(棚.map(b=>[b.id, b]));
  for(const d of [...本登録.docs, ...自分の.docs]) 表.set(d.id, 本に(d));
  return [...表.values()].filter(b=>b.状態 !== "見送り");
}
export async function 本を申請する({ 題, 著, 版元, isbn, ひとこと, ページ = 0 }){
  const r = await addDoc(collection(db, "books"), { title:題, author:著, publisher:版元, isbn:isbn || "",
    note:ひとこと || "", pages:ページ || 0, status:"pending", requestedBy:私.uid, created:serverTimestamp() });
  return { id:r.id, 題, 著, 版元, isbn, ひとこと, ページ, 状態:"仮登録", 申請者:私.uid };
}
export async function 管理者か(){
  try{ return (await getDoc(doc(db, "admins", 私.uid))).exists(); }catch{ return false; }
}
export async function 申請らを読む(){
  const s = await getDocs(query(collection(db, "books"), where("status", "==", "pending")));
  return s.docs.map(本に);
}
// 承認（本登録）か見送り。承認のときは、題・著者・出版社を直してから本登録にできる
export async function 申請を決める(id, 承認, 直し = {}){
  await updateDoc(doc(db, "books", id), {
    status:承認 ? "approved" : "rejected", decided:serverTimestamp(),
    ...(直し.題 ? { title:直し.題 } : {}), ...(直し.著 ? { author:直し.著 } : {}), ...(直し.版元 ? { publisher:直し.版元 } : {}),
  });
}

/* ── 記録 ─────────────────────────────── */


export async function 読了を読む(){
  const s = await getDocs(query(collection(db, "finishes"), where("uid", "==", 私.uid)));
  return s.docs.map(d=>{ const x = d.data(); return { 題:x.title, ページ:x.pages || 0, いつ:x.at?.toMillis?.() || 0 }; });
}

// 読み方は、人それぞれ：冊数・ページ数・時間の、それぞれ上位3人（functions の readerStats が数える）
export async function 読み方を読む(){
  const r = (await httpsCallable(呼ぶ, "readerStats", { timeout: 30000 })({})).data || {};
  const 直す = xs => (xs || []).map(x=>({ uid:x.uid, 名:x.name, 顔:x.face, 数:x.value }));
  return { 冊:直す(r.books), ページ:直す(r.pages), 分:直す(r.minutes) };
}

export async function 記録を読む(){
  const s = await getDocs(query(collection(db, "logs"),
    where("uid", "==", 私.uid), orderBy("from", "desc"), limit(200)));
  return s.docs.map(d=>{
    const x = d.data();
    return { 部屋:x.room, 題:x.title,
      始め:x.from?.toMillis?.() || 0, 終わり:x.to?.toMillis?.() || 0 };
  });
}
