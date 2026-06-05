import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('icons', { recursive: true });

const BLUE = [10, 42, 107];     // #0A2A6B
const YELLOW = [255, 201, 60];  // #FFC93C

function crc32(buf){
  let c = ~0;
  for (let i=0;i<buf.length;i++){
    c ^= buf[i];
    for (let k=0;k<8;k++) c = (c>>>1) ^ (0xEDB88320 & -(c&1));
  }
  return ~c >>> 0;
}
function chunk(type, data){
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Draw a blocky "M" on a blue rounded field
function pixel(x, y, S){
  const r = S * 0.18;                       // corner radius -> rounded square via corner test
  const inCorner = (cx, cy) => (x-cx)**2 + (y-cy)**2 > r*r;
  if (x < r && y < r && inCorner(r, r)) return null;
  if (x > S-r && y < r && inCorner(S-r, r)) return null;
  if (x < r && y > S-r && inCorner(r, S-r)) return null;
  if (x > S-r && y > S-r && inCorner(S-r, S-r)) return null;

  // "M" geometry
  const m0 = S*0.26, m1 = S*0.74, top = S*0.30, bot = S*0.72, stroke = S*0.10;
  const onLeft  = x >= m0 && x <= m0+stroke && y >= top && y <= bot;
  const onRight = x >= m1-stroke && x <= m1 && y >= top && y <= bot;
  // diagonals meeting at center
  const midX = (m0+m1)/2, apexY = S*0.52;
  const t1 = (x - m0) / (midX - m0); // 0..1 left diagonal
  const t2 = (m1 - x) / (m1 - midX); // 0..1 right diagonal
  const diagL = x>=m0 && x<=midX && Math.abs(y - (top + t1*(apexY-top))) < stroke*0.7;
  const diagR = x>=midX && x<=m1 && Math.abs(y - (top + t2*(apexY-top))) < stroke*0.7;

  return (onLeft||onRight||diagL||diagR) ? YELLOW : BLUE;
}

function makePNG(S){
  const transparent = [0,0,0,0];
  const raw = Buffer.alloc((S*4+1)*S);
  let p = 0;
  for (let y=0;y<S;y++){
    raw[p++] = 0; // filter: none
    for (let x=0;x<S;x++){
      const c = pixel(x, y, S);
      if (c){ raw[p++]=c[0]; raw[p++]=c[1]; raw[p++]=c[2]; raw[p++]=255; }
      else  { raw[p++]=0; raw[p++]=0; raw[p++]=0; raw[p++]=0; }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S,0); ihdr.writeUInt32BE(S,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level:9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return png;
}

for (const S of [192, 512]){
  writeFileSync(`icons/icon-${S}.png`, makePNG(S));
  console.log('wrote icons/icon-'+S+'.png');
}
