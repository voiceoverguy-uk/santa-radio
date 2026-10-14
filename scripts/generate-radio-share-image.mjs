import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(root, "attached_assets/santa-radio-gold-logo_1791446660391.png");
const santaPath = resolve(root, "attached_assets/santa_1791805807949.png");
const outputPath = resolve(root, "public/images/santa-radio-share-green-v2.jpg");
const previewPath = resolve(root, "generated-artifacts/santa-radio-share-preview.html");
const svgPath = resolve(root, "generated-artifacts/santa-radio-share-source.svg");

const [logo, santa] = await Promise.all([
  readFile(logoPath).then((data) => data.toString("base64")),
  readFile(santaPath).then((data) => data.toString("base64")),
]);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#081e17"/>
      <stop offset=".57" stop-color="#123326"/>
      <stop offset="1" stop-color="#1B4332"/>
    </linearGradient>
    <clipPath id="santaCircle"><circle cx="934" cy="315" r="218"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#field)"/>
  <image x="716" y="97" width="436" height="436" preserveAspectRatio="xMidYMid slice" clip-path="url(#santaCircle)" href="data:image/png;base64,${santa}"/>
  <image x="60" y="52" width="610" height="205" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${logo}"/>
  <text x="65" y="330" fill="#FFF8E7" font-family="Arial, sans-serif" font-size="66" font-weight="700">Christmas Music</text>
  <text x="65" y="408" fill="#FFF8E7" font-family="Arial, sans-serif" font-size="66" font-weight="700">24 hours a day</text>
  <rect x="65" y="464" width="340" height="94" rx="47" fill="#D4AF37"/>
  <text x="235" y="526" text-anchor="middle" fill="#081e17" font-family="Arial, sans-serif" font-size="44" font-weight="700">Listen Live</text>
</svg>`;

await mkdir(dirname(outputPath), { recursive: true });
await mkdir(dirname(previewPath), { recursive: true });
await writeFile(svgPath, svg);
try {
  await execFileAsync("magick", [
    "-background", "#081e17", svgPath, "-strip", "-sampling-factor", "4:2:0",
    "-quality", "88", "-define", "jpeg:optimize-coding=true", outputPath,
  ]);
} finally {
  const { unlink } = await import("node:fs/promises");
  await unlink(svgPath).catch(() => {});
}

const jpeg = (await readFile(outputPath)).toString("base64");
await writeFile(previewPath, `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Santa Radio — link preview artwork</title>
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;padding:36px;background:#e9e4d5;color:#123326;font:15px/1.5 Georgia,serif;display:grid;place-items:center}
  main{width:min(100%,1200px)}p{margin:0 0 14px;letter-spacing:.08em;text-transform:uppercase;font:600 11px/1.4 system-ui,sans-serif;color:#52675a}
  img{display:block;width:100%;height:auto;box-shadow:0 20px 70px #12332630}
  .phone{width:350px;max-width:100%;margin:32px 0 0}
</style>
<main><p>Santa Radio · link preview · 1200 × 630</p><img alt="Santa Radio — Christmas Music 24 hours a day. Listen Live. Santa wearing headphones on the right." src="data:image/jpeg;base64,${jpeg}">
<section class="phone"><p>Phone preview · 350 pixels wide</p><img alt="The same Santa Radio artwork at phone-preview size" src="data:image/jpeg;base64,${jpeg}"></section></main></html>`);
console.log(`Created ${outputPath}`);
