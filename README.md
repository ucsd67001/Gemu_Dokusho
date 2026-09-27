# GEMu 読書会（GEMu Dokusho）

## コンセプト（2026-09-27 配信者）

**神保町のカフェのように、みんなが静かに読書していて、読書好きによる不思議な一体感がある場所。**
話さない。見せ合わない。それでも、同じ時間に本をひらいている人がいる、ということだけが伝わる。
→ 画面の言葉も静かにする。**数を誇らない、急かさない、競わせない**（記録は自分のためだけ。順位は作らない）。

自分の写真から**ブロック風（マインクラフトのような）アバター**を作り、
**明るい中世ヨーロッパの、古本に囲まれたカフェ**の席に座って、それぞれの本を読む。
mekuru（https://www.mekuru.app/ja）に近いが、**当面は配信者と仲間1人の2人で使い、使いながら育てる。**

| | |
|---|---|
| 公開先 | `gemu-dokusho.web.app`（Firebase Hosting。独自ドメイン `gemu-dokusho` は将来） |
| Firebase | プロジェクト `gemu-dokusho`（Blaze） |
| GitHub | `github.com/ucsd67001/Gemu_Dokusho`（非公開） |
| 作り | Firebase（Hosting・Auth・Firestore・Storage・Functions）＋素の JavaScript（ビルドなし） |
| 見た目 | **本返し（Hongaeshi）を受け継ぐ**（罫1px・明朝とゴシックの使い分け・角丸2px・左揃え） |
| 絵 | OpenAI の画像モデル（既定 `gpt-image-1`。`functions/.env` の `IMAGE_MODEL` で差し替え） |

---

## いまできること（2026-09-27 に作った最初の形）

1. **Google で入る。**はじめて入った人は、その場で名前と写真を決めて登録する（Hongaeshi と同じ。招待制はやめた）
2. **初回：名前と写真（または絵）を決める → アバターを4枚作る**
   ①椅子ごと座って本を読む姿 ②ページをめくる姿 ③顔のアイコン ④後ろから見た姿（どれも背景は透明）
   **人の写真でなくてよい。**キャラクターの絵なら、そのキャラクターをブロックにする
3. **廊下**：部屋の一覧（いまは「カフェ」だけ）。誰が中にいるか顔で見える
4. **カフェ**：読む本の題を入れて席に着く（4席）。部屋の絵に、自分と仲間のアバター・名前・書名が出る。
   ときどきページをめくる（①と②が入れかわる）
5. **X に投稿**：「いま『〈書名〉』を読んでいます」の入った X の投稿画面を開く（押すのは本人）
6. **記録**：席に着いていた時間（今日・7日・これまで、1回ごと）
7. **自分**：名前を直す・アバターを作り直す（1人1日5回まで）・ログアウト
8. **試し（/demo）**：Firebase を使わずに、ブラウザの中だけで全部動く。タブを2つ開くと2人になる

## 作りの要点（ここだけは先に読んでほしい）

### Firestore の中だけ、名前が ASCII
ルールの言語が日本語の識別子を受け付けない（Hongaeshi で踏んだ）。
**翻訳しているのは `public/土台.js` だけ。**画面（`app.js`）は日本語の名前しか知らない。

| コレクション | 中身 | 書くのは |
|---|---|---|
| `meta/usage` | アバターを作った回数（全員ぶん・今日） | **functions だけ** |
| `users/{uid}` | `name`, `created`, `avatar{status, step, sit, turn, face, error, at, day, count}` | `name` は本人、`avatar` は **functions だけ** |
| `rooms/{room}/seats/{番}` | `uid`, `title`, `since`, `seen` | 本人 |
| `logs/{id}` | `uid`, `room`, `title`, `from`, `to` | 本人 |

### 試し（/demo）は、土台をまるごと差し替える
`app.js` は、URL が `/demo` なら `試し/土台.js`、それ以外は `土台.js` を読む。
⚠️ **`土台.js` に関数を足したら、`試し/土台.js` にも同じ名前で足す。**足さないと試しだけが止まる。

### 写真は残さない
写真は画面で 1024px の JPEG に縮め、**functions に渡して OpenAI へ送るだけ。**Storage にも Firestore にも置かない。
残るのは、できあがった絵（`avatars/{uid}/{版}/sit.webp` など）だけ。作り直すと古い版は消す。

### アバターの作り方（`functions/index.js`）
- ①は**写真から**、②③④は**①から**作る。写真から何回も作ると別人になる
- ⚠️ **上げるのは人の写真とは限らない**（2026-09-27、二人ともキャラクターの絵だった）。
  「写真の人」を前提にした指示だと、**キャラクターが人間に描き替えられた。**→ 写っているものをそのままブロックにする。
  **猫耳・しっぽなどは名指しで残させる**（落ちやすい）
- **席は4つ（テーブルの左右×奥と手前）。**テーブルに向くと、奥の席は顔が、手前の席は背中がこちらを向く。
  左右は反転で作れるので、要るのは①（顔）と④（背中）の2つ。`部屋.js` の席の `姿` が "顔"／"背中"
- ④が無いアバター（④を足す前に作ったもの）は、手前の席でも①のまま座る。「自分」の「背中の姿を足す」で④だけ作れる（`addBack`。1回に数える）
- **椅子ごと描かせる。**背景の椅子に重ねると、向きと高さが合わずに浮く
- 人は「右前を向く」で頼むが、**左を向いて描かれることがある**（2026-09-27、配信者の一枚目）。
  → 描いたあとに gpt-4.1-mini で左右どちらを向いているかを見て `avatar.facing` に残す（`detectFacing` は、それより前に作ったアバター用）。
  部屋では、**席の `向き`（テーブルの方）と絵の向きが違えば左右を反転**する。見分けを間違えたら「自分」の「向きを反対にする」（`users.flip`）
- 部屋の人数は4人まで（`部屋.js` の席の数と、`firestore.rules` の席番号 '0'〜'3'）
- **1人1日5回、全員あわせて1日30回まで**（日本の日付。`functions/index.js` の `一日の上限` と `全員の一日の上限`）。
  だれでも登録できるので、全員ぶんの上限が料金の歯止め。1回で3枚描くので、料金はその3倍

### 席は「生きている」を1分ごとに送る
タブを閉じると「立つ」が届かないことがある。**`seen` が3分延びていない席は空き**とみなす
（`firestore.rules` の `stale()` と、`土台.js` の `古いとみなす` をそろえる）。
読んだ時間の記録も1分ごとに `to` を延ばす（立つときだけ書くと、閉じた回が残らない）。

### 名札は、人の絵と別の層
人の中に名札を入れると、手前の人が奥の人の名札を隠す。舞台の最後に名札だけを重ねている。

### 押せるものは data-する
onclick の文字列に値を埋めない（題や名前に `'` が入るとスクリプトが動く。Hongaeshi で実際に穴だった）。
`data-する="…"` と `data-*` で渡し、`app.js` の `動き` で受ける。

## ファイル

```
public/
  index.html / demo.html   器（demo は題と noindex だけ違う）
  app.js                   画面のすべて
  土台.js                  Firebase との境目（ASCII の名前を知っているのはここだけ）
  試し/土台.js             /demo 用の偽の土台（localStorage と BroadcastChannel）
  部屋.js                  部屋の定義（絵・席の座標・向き）と、仮のカフェの下絵
  style.css                見た目（Hongaeshi の決まりを受け継ぐ）
functions/index.js         makeAvatar（写真 → 3枚の絵）
04_tools/部屋を作る.mjs    カフェの背景の絵を OpenAI で作る（一度だけ）
firestore.rules / storage.rules / firestore.indexes.json
```

## 動かす

```bash
firebase serve --only hosting --project gemu-dokusho --port 5050
```
- 試し：`http://localhost:5050/demo`
- 本体：`http://localhost:5050/`（本物の Firebase につながる）

## デプロイ

```bash
firebase deploy --project gemu-dokusho --only hosting
firebase deploy --project gemu-dokusho --only firestore:rules,firestore:indexes,storage
FUNCTIONS_DISCOVERY_TIMEOUT=60000 firebase deploy --project gemu-dokusho --only functions
```
⚠️ **Functions と hosting を一緒に出さない**（Hongaeshi で、Functions の後片づけのエラーで hosting が公開されないまま終わった）。
古いイメージを1日で消す設定は 2026-09-27 に入れた（`firebase functions:artifacts:setpolicy`）。

## 鍵

- **OpenAI の鍵は Secret Manager の `OPENAI_API_KEY`。****Hongaeshi と同じ鍵**（2026-09-27 配信者の指示。hongaeshi の Secret Manager から、画面に出さずに写した）
  - 鍵を替えるとき：`firebase functions:secrets:set OPENAI_API_KEY --project gemu-dokusho`（配信者が打つ）→ functions を上げ直す
  - ⚠️ **GEMu_AITuber の `.env` の鍵は使わない**
- 部屋の絵を作る道具も、同じ Secret Manager から firebase コマンドで読む。**鍵をファイルに書き出さない**
- `functions/.env` には `IMAGE_MODEL=gpt-image-1` だけを置く（鍵ではない。**これが無いと、非対話のデプロイが止まる**）

## 部屋の絵を差し替える

1. `node 04_tools/部屋を作る.mjs` で `04_tools/下書き/` に何枚か作る
2. 気に入った1枚を `public/部屋/cafe.webp` に置く
3. `public/部屋.js` の `絵:` にその道を書き、**席の座標を絵を見て測り直す**（仮の絵と椅子の場所が違う）

## 決めたこと・保留していること

- **X は投稿画面を開くだけ**（2026-09-27 決定）。X の API は有料で開発者登録が要る。投稿画面には画像を付けられない
- **招待制はやめ、ログインしたらその場で登録**（2026-09-27 配信者の決定。Hongaeshi と同じ）。料金の歯止めは回数の上限
- **部屋の絵は「添付の部屋のような、やわらかい立体の絵」、人はブロック風**（2026-09-27 配信者の選択）。
  カフェは**中世ヨーロッパで、明るい雰囲気**
- 環境音・読書仲間・部屋を増やす・独自ドメインは、使いながら決める
