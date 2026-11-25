// The World Today — Wednesday 25 November 2026.
// Draws a 1024x1024 front page summing up the day's world news, with a
// deterministic PNG encoder and a hand-written 5x7 bitmap font.
// Standard library only, no network, no timestamps, no randomness:
// two runs write byte-identical files.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---- colours ----
const PAPER = [247, 243, 232];
const INK = [20, 33, 61];
const NAVY = [20, 33, 61];
const GOLD = [233, 196, 106];
const RED = [178, 34, 34];
const TEAL = [42, 122, 120];
const WHITE = [255, 255, 255];
const GREY = [90, 90, 88];
const LIGHT = [232, 226, 210];
const DARKRED = [122, 20, 20];

// ---- pixel buffer ----
const px = new Uint8Array(W * H * 3);
function fill(r: number, g: number, b: number): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = r; px[i * 3 + 1] = g; px[i * 3 + 2] = b;
  }
}
function rect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
    }
  }
}
function hline(x: number, y: number, w: number, c: number[]): void { rect(x, y, w, 2, c); }
function circle(cx: number, cy: number, r: number, c: number[]): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r && x >= 0 && x < W && y >= 0 && y < H) {
        const i = (y * W + x) * 3;
        px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
      }
    }
  }
}

// ---- 5x7 bitmap font: each glyph is 7 rows of 5 bits ----
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  a: [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0f],
  b: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x1e],
  c: [0x00, 0x00, 0x0e, 0x10, 0x10, 0x11, 0x0e],
  d: [0x01, 0x01, 0x0f, 0x11, 0x11, 0x11, 0x0f],
  e: [0x00, 0x00, 0x0e, 0x11, 0x1f, 0x10, 0x0e],
  f: [0x06, 0x09, 0x08, 0x0e, 0x08, 0x08, 0x08],
  g: [0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  h: [0x10, 0x10, 0x1e, 0x11, 0x11, 0x11, 0x11],
  i: [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  j: [0x02, 0x00, 0x06, 0x02, 0x02, 0x12, 0x0c],
  k: [0x10, 0x10, 0x12, 0x14, 0x18, 0x14, 0x12],
  l: [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  m: [0x00, 0x00, 0x1a, 0x15, 0x15, 0x15, 0x15],
  n: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x11, 0x11],
  o: [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  p: [0x00, 0x00, 0x1e, 0x11, 0x11, 0x1e, 0x10],
  q: [0x00, 0x00, 0x0f, 0x11, 0x11, 0x0f, 0x01],
  r: [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  s: [0x00, 0x00, 0x0f, 0x10, 0x0e, 0x01, 0x1e],
  t: [0x04, 0x04, 0x0e, 0x04, 0x04, 0x04, 0x02],
  u: [0x00, 0x00, 0x11, 0x11, 0x11, 0x13, 0x0d],
  v: [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  w: [0x00, 0x00, 0x11, 0x15, 0x15, 0x15, 0x0a],
  x: [0x00, 0x00, 0x11, 0x0a, 0x04, 0x0a, 0x11],
  y: [0x00, 0x00, 0x11, 0x11, 0x0f, 0x01, 0x0e],
  z: [0x00, 0x00, 0x1f, 0x02, 0x04, 0x08, 0x1f],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x06, 0x04, 0x00, 0x04],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "%": [0x19, 0x1a, 0x02, 0x04, 0x08, 0x16, 0x13],
  "$": [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "\u2022": [0, 0, 0x0c, 0x0c, 0x0c, 0, 0],
};

function textWidth(s: string, scale: number): number {
  let w = 0;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT["?"];
    void g;
    w += 6 * scale;
  }
  return w - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: number[]): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      const bits = g[row];
      for (let col = 0; col < 5; col++) {
        if (bits & (0x10 >> col)) {
          rect(cx + col * scale, y + row * scale, scale, scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}
function drawTextCentred(cx: number, y: number, s: string, scale: number, c: number[]): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}

// ---- text wrapping ----
function wrap(s: string, maxW: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur === "" ? w : cur + " " + w;
    if (textWidth(test, scale) <= maxW) {
      cur = test;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
function drawLines(x: number, y: number, lines: string[], scale: number, c: number[], gap: number): number {
  let yy = y;
  for (const ln of lines) {
    drawText(x, yy, ln, scale, c);
    yy += 7 * scale + gap;
  }
  return yy;
}
function kicker(x: number, y: number, tag: string, c: number[]): void {
  const w = textWidth(tag, 2) + 16;
  rect(x, y, w, 26, c);
  drawText(x + 8, y + 5, tag, 2, WHITE);
}

// ---- PNG encoding (deterministic) ----
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---- stories: all reported on Wednesday 25 November 2026 ----
type Story = { tag: string; tagColor: number[]; head: string; body: string };
const LEAD: Story = {
  tag: "CHINA",
  tagColor: RED,
  head: "BEIJING PROBES A TOP LEADER",
  body: "China opens a corruption investigation into Chen Jining, a member of the ruling Politburo and the party chief of Shanghai, in a shock move against one of the country's most senior officials.",
};
const STORIES: Story[] = [
  {
    tag: "UKRAINE WAR",
    tagColor: NAVY,
    head: "RUSSIA CALLS SHIP STRIKES 'TERRORISM'",
    body: "Moscow accuses Kyiv of terrorist acts after drone strikes hit a Russian cargo ship in the Baltic Sea and a warship off Libya, and warns of severe consequences.",
  },
  {
    tag: "COLOMBIA",
    tagColor: TEAL,
    head: "25 HELD HOSTAGE IN SUPERMARKET",
    body: "Gunmen seize 25 people at a supermarket in Colombia, in a hostage standoff that grips the country as police surround the store.",
  },
  {
    tag: "USA",
    tagColor: NAVY,
    head: "FLOODS THREATEN CALIFORNIA",
    body: "Extreme flooding threatens California as heavy rain swamps roads and homes, with emergency crews on alert across the state.",
  },
  {
    tag: "WORLD",
    tagColor: RED,
    head: "FIVE WOMEN AN HOUR KILLED BY FAMILY",
    body: "Five women were killed every hour by a relative in 2025, the United Nations says, as the world marks the day against violence towards women.",
  },
  {
    tag: "MIDDLE EAST",
    tagColor: TEAL,
    head: "HOUTHIS HIT RIYADH TOWER AGAIN",
    body: "A tower in Riyadh is hit again by Houthi fire, injuring 11 people in the King Abdullah Financial District, Arab News reports.",
  },
];
const TICKER = "ALSO TODAY: TRUMP PARDONS TURKEYS  \u2022  NVIDIA SLIDES  \u2022  GUKESH HOLDS SINDAROV";

// ---- story blocks ----
function drawStory(x: number, y: number, w: number, s: Story, headScale: number): number {
  kicker(x, y, s.tag, s.tagColor);
  let yy = y + 34;
  const headLines = wrap(s.head, w, headScale);
  yy = drawLines(x, yy, headLines, headScale, INK, 4);
  yy += 4;
  const bodyLines = wrap(s.body, w, 2);
  yy = drawLines(x, yy, bodyLines, 2, [40, 40, 40], 4);
  return yy;
}
function drawStoryInline(x: number, y: number, w: number, s: Story): number {
  const kw = textWidth(s.tag, 2) + 16;
  rect(x, y, kw, 26, s.tagColor);
  drawText(x + 8, y + 5, s.tag, 2, WHITE);
  drawText(x + kw + 12, y + 2, s.head, 3, INK);
  let yy = y + 34;
  const bodyLines = wrap(s.body, w, 2);
  yy = drawLines(x, yy, bodyLines, 2, [40, 40, 40], 4);
  return yy;
}
function drawSkyline(): void {
  // Illustration for the lead story: a Shanghai skyline under a red sun.
  rect(524, 130, 472, 240, LIGHT);
  rect(524, 130, 472, 4, RED);
  circle(760, 208, 62, RED);
  const bars: Array<[number, number]> = [
    [540, 300], [580, 268], [622, 312], [664, 250], [706, 296],
    [748, 240], [790, 306], [832, 272], [874, 318], [916, 262], [956, 308],
  ];
  for (const [bx, top] of bars) {
    rect(bx, top, 34, 370 - top, NAVY);
  }
  // gold windows
  for (let i = 0; i < 40; i++) {
    const wx = 544 + ((i * 53) % 440);
    const wy = 286 + ((i * 37) % 72);
    rect(wx, wy, 5, 5, GOLD);
  }
  rect(524, 366, 472, 4, NAVY);
  rect(532, 340, 116, 22, NAVY);
  drawText(540, 344, "SHANGHAI", 2, WHITE);
}

// ---- page composition ----
function compose(): void {
  fill(PAPER[0], PAPER[1], PAPER[2]);
  // masthead
  rect(0, 0, W, 116, NAVY);
  drawTextCentred(512, 22, "THE WORLD TODAY", 5, WHITE);
  drawTextCentred(512, 74, "WEDNESDAY, 25 NOVEMBER 2026", 2, GOLD);
  hline(28, 112, 968, GOLD);
  // lead story + illustration
  drawStory(28, 130, 472, LEAD, 4);
  drawSkyline();
  hline(28, 384, 968, INK);
  // row A: stories 2 and 3
  drawStory(28, 398, 472, STORIES[0], 3);
  drawStory(524, 398, 472, STORIES[1], 3);
  hline(28, 602, 968, INK);
  // row B: stories 4 and 5
  drawStory(28, 616, 472, STORIES[2], 3);
  drawStory(524, 616, 472, STORIES[3], 3);
  hline(28, 820, 968, INK);
  // story 6: full-width band
  drawStoryInline(28, 834, 968, STORIES[4]);
  // ticker
  rect(0, 926, W, 50, NAVY);
  drawTextCentred(512, 942, TICKER, 2, GOLD);
  // footer
  drawTextCentred(512, 988, "ALL STORIES REPORTED ON 25 NOVEMBER 2026", 1, GREY);
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  compose();
  writeFileSync(join(outDir, "entry.png"), encodePNG());
}

main();
