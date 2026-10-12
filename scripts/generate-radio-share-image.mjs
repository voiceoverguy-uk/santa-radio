import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logoPath = resolve(root, "attached_assets/santa-radio-gold-logo_1791446660391.png");
const santaPath = resolve(root, "attached_assets/santa_1791805807949.png");
const outputPath = resolve(root, "public/images/santa-radio-share-green.jpg");
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
    <linearGradient id="goldline" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#f2d879"/><stop offset="1" stop-color="#D4AF37"/>
    </linearGradient>
    <radialGradient id="halo">
      <stop stop-color="#315743" stop-opacity=".65"/><stop offset="1" stop-color="#123326" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="santaCircle"><circle cx="934" cy="315" r="218"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#field)"/>
  <path d="M0 0h1200v12H0z" fill="#D4AF37" opacity=".9"/>
  <circle cx="934" cy="315" r="286" fill="url(#halo)"/>
  <path d="M724 58h425M724 572h425" stroke="#D4AF37" stroke-opacity=".42" stroke-width="1"/>
  <circle cx="934" cy="315" r="229" fill="#081e17" stroke="url(#goldline)" stroke-width="2"/>
  <circle cx="934" cy="315" r="221" fill="none" stroke="#D4AF37" stroke-opacity=".36" stroke-width="1"/>
  <image x="716" y="97" width="436" height="436" preserveAspectRatio="xMidYMid slice" clip-path="url(#santaCircle)" href="data:image/png;base64,${santa}"/>
  <image x="61" y="66" width="597" height="204" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${logo}"/>
  <path d="M66 299h548" stroke="url(#goldline)" stroke-width="2"/>
  <circle cx="66" cy="299" r="3" fill="#D4AF37"/>
  <text x="65" y="365" fill="#FFF8E7" font-family="Georgia, 'Times New Roman', serif" font-size="43" letter-spacing=".5">Christmas music</text>
  <text x="65" y="422" fill="#FFF8E7" font-family="Georgia, 'Times New Roman', serif" font-size="43" letter-spacing=".5">24 hours a day</text>
  <rect x="65" y="461" width="222" height="43" rx="21.5" fill="#D4AF37"/>
  <text x="176" y="489" text-anchor="middle" fill="#081e17" font-family="Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="1.1">LISTEN TO CHRISTMAS</text>
  <text x="65" y="555" fill="#FFF8E7" font-family="Arial, sans-serif" font-size="20" letter-spacing="1.5">santaradio.co.uk</text>
  <path d="M65 576h210" stroke="#FFF8E7" stroke-opacity=".36" stroke-width="1"/>
  <text x="65" y="603" fill="#d9d4c2" font-family="Arial, sans-serif" font-size="12" letter-spacing="2.2">YOUR CHRISTMAS SOUNDTRACK</text>
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
</style>
<main><p>Santa Radio · link preview · 1200 × 630</p><img alt="Santa Radio: Christmas music 24 hours a day. Listen to Christmas at santaradio.co.uk." src="data:image/jpeg;base64,${jpeg}"></main></html>`);
console.log(`Created ${outputPath}`);
