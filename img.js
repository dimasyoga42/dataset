import { createCanvas, loadImage } from "@napi-rs/canvas";
import fetch from "node-fetch";

export async function buildAvaGrid(apiUrl) {
  const res = await fetch(apiUrl);
  const json = await res.json();
  const items = json.result.data;

  const images = await Promise.all(
    items.map((item) => loadImage(item.image).catch(() => null)),
  );

  const IMG_W = 600;
  const IMG_H = 300;
  const PADDING = 20;
  const LABEL_H = 50;

  const canvasW = IMG_W + PADDING * 2;
  const canvasH =
    items.length * (IMG_H + LABEL_H) + (items.length + 1) * PADDING;

  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, canvasW, canvasH);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const img = images[i];
    const x = PADDING;
    const y = PADDING + i * (IMG_H + LABEL_H + PADDING);

    if (img) {
      ctx.drawImage(img, x, y, IMG_W, IMG_H);
    } else {
      ctx.fillStyle = "#2a2a4e";
      ctx.fillRect(x, y, IMG_W, IMG_H);
    }

    ctx.fillStyle = "#0f0f1e";
    ctx.fillRect(x, y + IMG_H, IMG_W, LABEL_H);

    const date = item.date.replace(/［|］/g, "").trim();
    ctx.fillStyle = "#aaaaaa";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(date, x + IMG_W - 8, y + IMG_H + 18);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "left";
    let name = item.name;
    while (ctx.measureText(name).width > IMG_W - 16) name = name.slice(0, -1);
    if (name !== item.name) name += "...";
    ctx.fillText(name, x + 8, y + IMG_H + 36);
  }
buildAvaGrid("https://neurapi.mochinime.cyou/api/toram/ava")
  return canvas.toBuffer("image/png");
}
