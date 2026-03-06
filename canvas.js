import fs from "fs";
import { createCanvas } from "canvas";

const input = "dye_data.json";
const output = "dye_table.png";

const data = JSON.parse(fs.readFileSync(input, "utf8"));

const rowHeight = 42;
const padding = 30;
const width = 900;
const height = data.length * rowHeight + 100;

const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

/* background */
ctx.fillStyle = "#0f172a";
ctx.fillRect(0, 0, width, height);

/* title */
ctx.fillStyle = "#ffffff";
ctx.font = "bold 30px Sans-serif";
ctx.fillText("Toram Weapon Dye List", padding, 45);

/* start table */
const startY = 80;

ctx.font = "20px Sans-serif";

data.forEach((item, index) => {

  const y = startY + index * rowHeight;

  /* row background */
  ctx.fillStyle = index % 2 === 0 ? "#111827" : "#1e293b";
  ctx.fillRect(padding - 10, y - 25, width - padding * 2 + 20, rowHeight);

  /* color box gunakan HEX dari json */
  const color = item.hex || "#ffffff";

  ctx.fillStyle = color;
  ctx.fillRect(padding, y - 17, 24, 24);

  ctx.strokeStyle = "#000000";
  ctx.strokeRect(padding, y - 17, 24, 24);

  /* boss name */
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(item.boss, padding + 45, y);

  /* dye code */
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "right";
  ctx.fillText(item.dye, width - padding, y);

});

const buffer = canvas.toBuffer("image/png");
fs.writeFileSync(output, buffer);

console.log("image saved:", output);
