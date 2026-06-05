import fs from "fs";
import { createCanvas } from "canvas";

const input = "dye_data.json";
const output = "dye_table.png";

const data = JSON.parse(fs.readFileSync(input, "utf8"));

const ITEMS_PER_COLUMN = 30;
const COLUMN_WIDTH = 380;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 50;
const PADDING = 10;

const columns = Math.ceil(data.length / ITEMS_PER_COLUMN);

const width = columns * COLUMN_WIDTH + PADDING * 2;
const height =
  HEADER_HEIGHT +
  ITEMS_PER_COLUMN * ROW_HEIGHT +
  PADDING * 2;

const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

/* background */
ctx.fillStyle = "#f2f2f2";
ctx.fillRect(0, 0, width, height);

ctx.textBaseline = "middle";

for (let col = 0; col < columns; col++) {
  const startX = PADDING + col * COLUMN_WIDTH;

  /* header */
  ctx.fillStyle = "#333";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "left";

  ctx.fillText(
    "Boss Name ( 202606 )",
    startX,
    HEADER_HEIGHT / 2
  );

  ctx.fillText(
    "Color",
    startX + COLUMN_WIDTH - 90,
    HEADER_HEIGHT / 2
  );

  /* vertical separator */
  if (col > 0) {
    ctx.strokeStyle = "#d0d0d0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX - 15, 0);
    ctx.lineTo(startX - 15, height);
    ctx.stroke();
  }

  const rows = data.slice(
    col * ITEMS_PER_COLUMN,
    (col + 1) * ITEMS_PER_COLUMN
  );

  rows.forEach((item, row) => {
    const y =
      HEADER_HEIGHT +
      row * ROW_HEIGHT +
      ROW_HEIGHT / 2;

    /* boss name */
    ctx.fillStyle = "#333";
    ctx.font = "18px Arial";
    ctx.textAlign = "left";

    const boss =
      item.boss ||
      item.name ||
      item.monster ||
      "-";

    ctx.fillText(
      boss,
      startX,
      y
    );

    /* color box */
    const boxWidth = 70;
    const boxHeight = 34;

    const boxX =
      startX + COLUMN_WIDTH - boxWidth - 20;
    const boxY = y - boxHeight / 2;

    const color = item.hex || "#ffffff";

    ctx.fillStyle = color;
    ctx.fillRect(
      boxX,
      boxY,
      boxWidth,
      boxHeight
    );

    ctx.strokeStyle = "#999";
    ctx.strokeRect(
      boxX,
      boxY,
      boxWidth,
      boxHeight
    );

    /* dye text */
    const dye =
      item.dye ||
      item.code ||
      "-";

    const rgb = hexToRgb(color);

    const brightness =
      (rgb.r * 299 +
        rgb.g * 587 +
        rgb.b * 114) /
      1000;

    ctx.fillStyle =
      brightness > 140
        ? "#000000"
        : "#ffffff";

    ctx.textAlign = "center";
    ctx.font = "18px Arial";

    ctx.fillText(
      dye,
      boxX + boxWidth / 2,
      y
    );
  });
}

fs.writeFileSync(
  output,
  canvas.toBuffer("image/png")
);

console.log(`Image saved: ${output}`);

function hexToRgb(hex) {
  hex = hex.replace("#", "");

  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }

  const num = parseInt(hex, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}
