import { createCanvas, loadImage } from "@napi-rs/canvas";
import fetch from "node-fetch";
import { writeFileSync } from "fs";

export async function buildAvaGrid(apiUrl) {
  const res = await fetch(apiUrl);
  const json = await res.json();
  const items = json.result.data;

  const images = await Promise.all(
    items.map((item) => loadImage(item.image).catch(() => null))
  );

  const COLS = 2;          // 2 kolom biar compact
  const IMG_W = 360;       // lebih kecil per item
  const IMG_H = 200;
  const PADDING = 10;
  const LABEL_H = 40;

  const ROWS = Math.ceil(items.length / COLS);
  const canvasW = COLS * IMG_W + (COLS + 1) * PADDING;
  const canvasH = ROWS * (IMG_H + LABEL_H) + (ROWS + 1) * PADDING;
  // Total lebar: ~750px, tinggi: ~520px — pas untuk WA preview

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvasW, canvasH);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const img = images[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const x = PADDING + col * (IMG_W + PADDING);
    const y = PADDING + row * (IMG_H + LABEL_H + PADDING);

    if (img) {
      // Cover fit — crop tengah supaya tidak gepeng
      const scale = Math.max(IMG_W / img.width, IMG_H / img.height);
      const srcW = IMG_W / scale;
      const srcH = IMG_H / scale;
      const srcX = (img.width - srcW) / 2;
      const srcY = (img.height - srcH) / 2;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, IMG_W, IMG_H);
    } else {
      ctx.fillStyle = "#2a2a4e";
      ctx.fillRect(x, y, IMG_W, IMG_H);
    }

    // Label
    ctx.fillStyle = "#0f0f1e";
    ctx.fillRect(x, y + IMG_H, IMG_W, LABEL_H);

    // Tanggal
    const date = item.date.replace(/［|］/g, "").trim();
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(date, x + IMG_W - 6, y + IMG_H + 14);

    // Nama
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    let name = item.name;
    while (ctx.measureText(name).width > IMG_W - 12) name = name.slice(0, -1);
    if (name !== item.name) name += "...";
    ctx.fillText(name, x + 6, y + IMG_H + 30);
  }

  return canvas.toBuffer("image/png");
}

// Entry point GitHub Actions
const buffer = await buildAvaGrid("https://neurapi.mochinime.cyou/api/toram/ava");
writeFileSync("ava_grid.png", buffer);
console.log("Selesai: ava_grid.png");
