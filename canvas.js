import fs from "fs";
import { createCanvas } from "canvas";

const input = "dye_data.json";
const output = "dye_table.png";

const data = JSON.parse(fs.readFileSync(input, "utf8"));

const rowHeight = 40;
const width = 900;
const height = rowHeight * data.length + 80;

const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

ctx.fillStyle = "#0f172a";
ctx.fillRect(0, 0, width, height);

ctx.fillStyle = "#ffffff";
ctx.font = "bold 28px Sans";
ctx.fillText("Toram Weapon Dye List", 30, 40);

ctx.font = "20px Sans";

function colorFromCode(code) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h},70%,55%)`;
}

data.forEach((item, i) => {
  const y = 70 + i * rowHeight;

  ctx.fillStyle = i % 2 ? "#1e293b" : "#111827";
  ctx.fillRect(20, y - 25, width - 40, rowHeight);

  const color = colorFromCode(item.color);

  ctx.fillStyle = color;
  ctx.fillRect(30, y - 18, 24, 24);

  ctx.strokeStyle = "#000";
  ctx.strokeRect(30, y - 18, 24, 24);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(item.boss, 70, y);

  ctx.fillStyle = "#94a3b8";
  ctx.fillText(item.color, width - 120, y);
});

const buffer = canvas.toBuffer("image/png");
fs.writeFileSync(output, buffer);

console.log("image saved:", output);
