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

  const COLS = 2;
  const IMG_W = 360;
  const IMG_H = 210;
  const PADDING = 12;
  const LABEL_H = 44;
  const RADIUS = 10;       // sudut rounded
  const HEADER_H = 48;     // header atas

  const ROWS = Math.ceil(items.length / COLS);
  const canvasW = COLS * IMG_W + (COLS + 1) * PADDING;
  const canvasH = HEADER_H + ROWS * (IMG_H + LABEL_H) + (ROWS + 1) * PADDING;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  // Background putih
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, HEADER_H);

  // Garis bawah header
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, HEADER_H - 1, canvasW, 1);

  // Judul header
  ctx.fillStyle = "#222222";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Avatar Chest — Banner Aktif", PADDING, HEADER_H - 14);

  // Helper: rounded rect clip
  const roundedClip = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const img = images[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const x = PADDING + col * (IMG_W + PADDING);
    const y = HEADER_H + PADDING + row * (IMG_H + LABEL_H + PADDING);

    // Card shadow
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    // Card background putih
    roundedClip(x, y, IMG_W, IMG_H + LABEL_H, RADIUS);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Gambar (clip rounded atas saja)
    if (img) {
      ctx.save();
      roundedClip(x, y, IMG_W, IMG_H, RADIUS);
      ctx.clip();

      const scale = Math.max(IMG_W / img.width, IMG_H / img.height);
      const srcW = IMG_W / scale;
      const srcH = IMG_H / scale;
      const srcX = (img.width - srcW) / 2;
      const srcY = (img.height - srcH) / 2;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, IMG_W, IMG_H);
      ctx.restore();
    } else {
      ctx.save();
      roundedClip(x, y, IMG_W, IMG_H, RADIUS);
      ctx.clip();
      ctx.fillStyle = "#eeeeee";
      ctx.fillRect(x, y, IMG_W, IMG_H);
      ctx.fillStyle = "#aaaaaa";
      ctx.font = "13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Gambar tidak tersedia", x + IMG_W / 2, y + IMG_H / 2);
      ctx.restore();
    }

    // Label area
    const labelY = y + IMG_H;

    // Tanggal (kanan)
    const date = item.date.replace(/［|］/g, "").trim();
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(date, x + IMG_W - 10, labelY + 16);

    // Nama
    ctx.fillStyle = "#222222";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "left";
    let name = item.name
      .replace(/\[Avatar Chest\] Limited Time Offer for /i, "")
      .replace(/"/g, "");
    while (ctx.measureText(name).width > IMG_W - 16) name = name.slice(0, -1);
    if (name !== item.name) name += "...";
    ctx.fillText(name, x + 10, labelY + 32);
  }

  return canvas.toBuffer("image/png");
}

// Entry point GitHub Actions
const buffer = await buildAvaGrid("https://neurapi.mochinime.cyou/api/toram/ava");
writeFileSync("ava_grid.png", buffer);
console.log("Selesai: ava_grid.png");
