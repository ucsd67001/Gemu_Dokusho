/* ============================================================
   GEMu 読書会 ― 土台（Firebase との境目）

   ⚠️⚠️ **Firestore の中だけ、名前が ASCII。**（Hongaeshi と同じ理由。ルールの言語が日本語を受け付けない）
      読み書きの境目にあたる**このファイルだけが両方の名前を知っている。**
      外へ出すものは、必ず日本語のかたちに直してから返す。

        users/{uid}                 → 人   { 名, アバター{ 状態, 段階, 座る, めくる, 顔, 誤り } }
        rooms/{room}/seats/{番}     → 席   { 番, uid, 題, 入った, 見た }
        logs/{id}                   → 記録 { 部屋, 題, 始め, 終わり }

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
  query, where, orderBy, limit, onSnapshot, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref as 置き場, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { getFunctions, httpsCallable }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-functions.js";

export const 試し = false;

let app, auth, db, 倉, 呼ぶ;
export let 私 = null;        // { uid, 名, メール }

const 古いとみなす = 3 * 60 * 1000;   // firestore.rules の stale() と同じ3分

/* ── 立ち上げ ───────────────────────────────
   変わったら({ 私, 招待 }) を、ログインの状態が変わるたびに呼ぶ */
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

  onAuthStateChanged(auth, async u=>{
    私 = u ? { uid:u.uid, 名:u.displayName || "", メール:u.email } : null;
    let 招待 = false;
    if(u){
      try{ 招待 = (await getDoc(doc(db, "allow", u.email))).exists(); }
      catch(e){ 招待 = false; }
    }
    変わったら({ 私, 招待 });
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
    アバター: {
      状態: a.status || "none",   // none / making / ready / failed
      段階: a.step || "",
      座る: a.sit || "", めくる: a.turn || "", 顔: a.face || "",
      誤り: a.error || "",
    }
  };
}

// 自分の記録。まだ名前を決めていなければ null
export function 自分を見張る(届いたら){
  return onSnapshot(doc(db, "users", 私.uid), s=>届いたら(s.exists() ? 人に(s) : null),
    e=>{ console.error(e); 届いたら(null); });
}

// 部屋にいる人の名前と絵を引くため。招待制で人数が少ないので、全員ぶんを見張る
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
  return { 番:Number(d.id), uid:x.uid, 題:x.title || "",
    入った:x.since?.toMillis?.() || Date.now(), 見た:x.seen?.toMillis?.() || Date.now() };
}
const 生きた席 = 席 => Date.now() - 席.見た < 古いとみなす;

export function 席を見張る(部屋, 届いたら){
  return onSnapshot(collection(db, "rooms", 部屋, "seats"),
    s=>届いたら(s.docs.map(席に).filter(生きた席)),
    e=>console.error(e));
}

let いま = null;   // { 部屋, 番, 記録, 入った }

export async function 座る(部屋, 題, 席の数){
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
        tx.set(r, { uid:私.uid, title:題, since:serverTimestamp(), seen:serverTimestamp() });
      });
    }catch(e){ continue; }
    const 記録 = await 記録を始める(部屋, 題);
    いま = { 部屋, 番, 記録, 入った:Date.now() };
    return 番;
  }
  throw new Error("満席です");
}

async function 記録を始める(部屋, 題){
  const r = await addDoc(collection(db, "logs"),
    { uid:私.uid, room:部屋, title:題, from:serverTimestamp(), to:serverTimestamp() });
  return r.id;
}

export async function 題を替える(題){
  if(!いま) return;
  await updateDoc(doc(db, "logs", いま.記録), { to:serverTimestamp() }).catch(()=>{});
  await updateDoc(doc(db, "rooms", いま.部屋, "seats", String(いま.番)), { title:題, seen:serverTimestamp() });
  いま.記録 = await 記録を始める(いま.部屋, 題);
}

export async function 生きている(){
  if(!いま) return;
  await Promise.all([
    updateDoc(doc(db, "rooms", いま.部屋, "seats", String(いま.番)), { seen:serverTimestamp() }),
    updateDoc(doc(db, "logs", いま.記録), { to:serverTimestamp() }),
  ]);
}

export async function 立つ(){
  if(!いま) return;
  const 席 = いま; いま = null;
  await Promise.all([
    updateDoc(doc(db, "logs", 席.記録), { to:serverTimestamp() }).catch(()=>{}),
    deleteDoc(doc(db, "rooms", 席.部屋, "seats", String(席.番))).catch(()=>{}),
  ]);
}

export const 座っている = () => いま ? { ...いま } : null;

/* ── 記録 ─────────────────────────────── */
export async function 記録を読む(){
  const s = await getDocs(query(collection(db, "logs"),
    where("uid", "==", 私.uid), orderBy("from", "desc"), limit(200)));
  return s.docs.map(d=>{
    const x = d.data();
    return { 部屋:x.room, 題:x.title,
      始め:x.from?.toMillis?.() || 0, 終わり:x.to?.toMillis?.() || 0 };
  });
}
