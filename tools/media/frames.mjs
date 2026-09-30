// Turns approved Veo clips into scroll frames and the four stills into served images.
// Usage: node tools/media/frames.mjs   (needs a full ffmpeg build with libwebp; set FFMPEG=path)
// Output: public/film/<clip>/<nnn>.webp (desktop, every other frame) and public/film/stills/<name>-<w>.webp
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../..");
const ff = process.env.FFMPEG || "ffmpeg";
const src = (p) => path.join(root, "assets-src/film", p);
const pub = (p) => path.join(root, "public/film", p);

// Approved clips only, in film order. Add a clip here after it passes review.
const CLIPS = ["v1"];
const WIDTH = 1600;

const segments = [];
for (const id of CLIPS) {
  if (!existsSync(src(`${id}.mp4`))) { console.log(`skip ${id}: no clip`); continue; }
  rmSync(pub(id), { recursive: true, force: true });
  mkdirSync(pub(id), { recursive: true });
  execFileSync(ff, ["-loglevel", "error", "-i", src(`${id}.mp4`), "-vf", `select=not(mod(n\\,2)),scale=${WIDTH}:-2`, "-vsync", "vfr",
    "-c:v", "libwebp", "-quality", "72", "-compression_level", "5", pub(`${id}/%03d.webp`)]);
  const count = readdirSync(pub(id)).length;
  segments.push({ id, count, width: WIDTH, height: Math.round((WIDTH * 9) / 16) });
  console.log(`${id}: ${count} frames`);
}

mkdirSync(pub("stills"), { recursive: true });
for (const s of ["s1", "s2", "s3", "s4"]) {
  for (const w of [960, 1920]) await sharp(src(`${s}.jpg`)).resize({ width: w }).webp({ quality: 74 }).toFile(pub(`stills/${s}-${w}.webp`));
  // Phones: a 3:4 crop centred on the subject.
  const meta = await sharp(src(`${s}.jpg`)).metadata();
  const cw = Math.round((meta.height * 3) / 4);
  await sharp(src(`${s}.jpg`)).extract({ left: Math.round((meta.width - cw) / 2), top: 0, width: cw, height: meta.height }).resize({ width: 900 }).webp({ quality: 74 }).toFile(pub(`stills/${s}-tall.webp`));
}

writeFileSync(path.join(root, "src/film/manifest.ts"),
  `/** Written by \`npm run frames\` from approved Veo clips. Empty until a clip passes review:\n *  the film then runs on the four stills alone. */\nexport type Segment = { id: string; count: number; width: number; height: number };\nexport const SEGMENTS: Segment[] = ${JSON.stringify(segments)};\n`);
console.log("done");
