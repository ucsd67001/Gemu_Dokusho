/* ============================================================
   ファビコンを作る（2026-09-29 配信者の絵から）

   使い方（リポジトリの一番上で）：
     node 04_tools/ファビコンを作る.mjs 04_tools/下書き/favicon.png
   → public/ に favicon.ico・favicon-32.png・favicon-180.png・favicon-192.png・favicon-512.png を書く

   ・角の丸い枠の**外側の白**を透明にする。**絵の端から続いている白だけ**を塗りつぶしで抜く
     （髪など、枠の内側の白には手を付けない）
   ・iPhone のホーム画面用（180）は透明が黒く出るので、外側をサイトの地の色で埋める
   ・.ico は、32px の PNG をそのまま包む（いまのブラウザは PNG 入りの .ico を読める）
   ============================================================ */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ここ = dirname(fileURLToPath(import.meta.url));
const sharp = createRequire(join(ここ, "../functions/package.json"))("sharp");
const 元 = process.argv[2];
if(!元){ console.error("絵のファイルを渡してください"); process.exit(1); }
const 置き場 = join(ここ, "../public");

// 1. 外側の白を抜く（端から塗りつぶし）
const { data, info } = await sharp(元).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;
const 白い = i => data[i] > 232 && data[i + 1] > 232 && data[i + 2] > 232;
const 見た = new Uint8Array(W * H);
const 列 = [];
for(let x = 0; x < W; x++){ 列.push(x, (H - 1) * W + x); }
for(let y = 0; y < H; y++){ 列.push(y * W, y * W + W - 1); }
while(列.length){
  const p = 列.pop();
  if(見た[p]) continue;
  見た[p] = 1;
  if(!白い(p * 4)) continue;
  data[p * 4 + 3] = 0;
  const x = p % W, y = (p / W) | 0;
  if(x > 0) 列.push(p - 1);
  if(x < W - 1) 列.push(p + 1);
  if(y > 0) 列.push(p - W);
  if(y < H - 1) 列.push(p + W);
}
// 抜いた所のすぐ隣の、白っぽいふち（にじみ）を半透明にして、縁のギザギザを和らげる
for(let p = 0; p < W * H; p++){
  if(data[p * 4 + 3] === 0) continue;
  const x = p % W, y = (p / W) | 0;
  const 隣が抜け = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy])=>{
    const nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < W && ny < H && data[(ny * W + nx) * 4 + 3] === 0;
  });
  if(隣が抜け){
    const 明るさ = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
    if(明るさ > 170) data[p * 4 + 3] = Math.round(255 * (255 - 明るさ) / 85);
  }
}
const 抜いた = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
// 余白を詰めて正方形にする
const 詰めた = await sharp(抜いた).trim().toBuffer();
const 正方形 = await sharp(詰めた).resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

// 2. 大きさごとに書く
const 書く = async (名, 大きさ, 地 = null) => {
  let s = sharp(正方形).resize(大きさ, 大きさ);
  if(地) s = s.flatten({ background: 地 });
  const buf = await s.png().toBuffer();
  writeFileSync(join(置き場, 名), buf);
  return buf;
};
const p32 = await 書く("favicon-32.png", 32);
await 書く("favicon-192.png", 192);
await 書く("favicon-512.png", 512);
await 書く("favicon-180.png", 180, "#f8f6fc");   // iPhone のホーム画面用。透明は黒く出るので地の色で埋める

// 3. .ico（32px の PNG をそのまま包む）
const 頭 = Buffer.alloc(6); 頭.writeUInt16LE(0, 0); 頭.writeUInt16LE(1, 2); 頭.writeUInt16LE(1, 4);
const 目次 = Buffer.alloc(16);
目次.writeUInt8(32, 0); 目次.writeUInt8(32, 1); 目次.writeUInt8(0, 2); 目次.writeUInt8(0, 3);
目次.writeUInt16LE(1, 4); 目次.writeUInt16LE(32, 6); 目次.writeUInt32LE(p32.length, 8); 目次.writeUInt32LE(22, 12);
writeFileSync(join(置き場, "favicon.ico"), Buffer.concat([頭, 目次, p32]));

console.log("public/ に favicon.ico・favicon-32/180/192/512.png を書きました");
