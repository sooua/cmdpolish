// Generates a simple 1024x1024 source PNG for the app icon (no external deps).
// Draws the CmdPolish mark: a dark rounded square with a blue ">_" prompt motif.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const S = 1024;
const buf = Buffer.alloc(S * S * 4);

const BG = [13, 17, 23, 255]; // #0d1117
const ACCENT = [47, 129, 247, 255]; // #2f81f7
const DIM = [22, 27, 34, 255]; // panel

function set(x, y, c) {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = c[3];
}

// Rounded-square background.
const r = 180;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const inCorner =
      (x < r && y < r && (x - r) ** 2 + (y - r) ** 2 > r * r) ||
      (x > S - r && y < r && (x - (S - r)) ** 2 + (y - r) ** 2 > r * r) ||
      (x < r && y > S - r && (x - r) ** 2 + (y - (S - r)) ** 2 > r * r) ||
      (x > S - r && y > S - r && (x - (S - r)) ** 2 + (y - (S - r)) ** 2 > r * r);
    set(x, y, inCorner ? [0, 0, 0, 0] : BG);
  }
}

// Helper: filled rect.
function rect(x0, y0, w, h, c) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) set(x, y, c);
}

// ">" chevron made of two strokes.
const t = 60; // stroke thickness
function line(x0, y0, x1, y1, c) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    rect(x - t / 2, y - t / 2, t, t, c);
  }
}
line(300, 340, 520, 512, ACCENT);
line(520, 512, 300, 684, ACCENT);

// Underscore prompt cursor.
rect(560, 640, 200, t, ACCENT);
// subtle panel block behind for depth (drawn under accent? keep simple)
rect(560, 360, 40, 200, DIM);

// PNG encode (filter 0 per scanline).
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  buf.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}

function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c;
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  sig,
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(new URL("../app-icon.png", import.meta.url), png);
console.log("wrote app-icon.png", png.length, "bytes");
