import fetch from "node-fetch";
import fs from "fs";
import { createCanvas } from "@napi-rs/canvas";

const JSON_URL = "https://raw.githubusercontent.com/dayoyui/dbs/refs/heads/main/toram/dye.json";
const PNG_OUTPUT = "dye_table.png";

const ITEMS_PER_COLUMN = 30;
const COLUMN_WIDTH = 400;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 55;
const PADDING = 16;

const DYE_HEX = {
  A1:"#fe0000",A2:"#fe6500",A3:"#fecb00",A4:"#cbfe00",A5:"#65fe00",
  A6:"#00fe00",A7:"#00fe65",A8:"#00fecb",A9:"#00cbfe",A10:"#0065fe",
  A11:"#0000fe",A12:"#6500fe",A13:"#cb00fe",A14:"#fe00cb",A15:"#fe0065",
  A16:"#fe6565",A17:"#fecb65",A18:"#fefe65",A19:"#cbfe65",A20:"#65fe65",
  A21:"#65fecb",A22:"#65cbfe",A23:"#6565fe",A24:"#cb65fe",A25:"#fe65cb",
  A26:"#fe6598",A27:"#cb9865",A28:"#98cb65",A29:"#65cb98",A30:"#6598cb",
  A31:"#9865cb",A32:"#cb6598",A33:"#983200",A34:"#649800",A35:"#009832",
  A36:"#009864",A37:"#006498",A38:"#320098",A39:"#640098",A40:"#980064",
  A41:"#fe9832",A42:"#cafe32",A43:"#32fe98",A44:"#32cafe",A45:"#3232fe",
  A46:"#ca32fe",A47:"#fe32ca",A48:"#fe3232",A49:"#b46500",A50:"#65b400",
  A51:"#00b465",A52:"#0065b4",A53:"#6500b4",A54:"#b40065",A55:"#fefecc",
  A56:"#cccccc",A57:"#999999",A58:"#666666",A59:"#333333",A60:"#000000",
  A61:"#fe9865",A62:"#cafe65",A63:"#65fe98",A64:"#65cafe",A65:"#6598fe",
  A66:"#9865fe",A67:"#fe65ca",A68:"#fe6565",A69:"#fe9898",A70:"#fecafe",
  A71:"#cafefe",A72:"#cafeca",A73:"#fecaca",A74:"#98feca",A75:"#98cafe",
  A76:"#ca98fe",A77:"#feca98",A78:"#fe9832",A79:"#32fe98",A80:"#3298fe",
  A81:"#9832fe",A82:"#fe3298",A83:"#98fe32",A84:"#ffffff",
  B1:"#fe0000",B2:"#fe4900",B3:"#fe9800",B4:"#fecb00",B5:"#fefe00",
  B6:"#cbfe00",B7:"#98fe00",B8:"#49fe00",B9:"#00fe00",B10:"#00fe49",
  B11:"#00fe98",B12:"#00fecb",B13:"#00fefe",B14:"#00cbfe",B15:"#0098fe",
  B16:"#0049fe",B17:"#0000fe",B18:"#4900fe",B19:"#9800fe",B20:"#cb00fe",
  B21:"#fe00fe",B22:"#fe00cb",B23:"#fe0098",B24:"#fe0049",B25:"#983200",
  B26:"#986500",B27:"#989800",B28:"#659800",B29:"#329800",B30:"#009832",
  B31:"#009865",B32:"#009898",B33:"#006598",B34:"#003298",B35:"#320098",
  B36:"#650098",B37:"#980098",B38:"#980065",B39:"#980032",B40:"#fe9865",
  B41:"#fecb65",B42:"#fefe65",B43:"#cbfe65",B44:"#98fe65",B45:"#65fe65",
  B46:"#65fe98",B47:"#65fecb",B48:"#65fefe",B49:"#65cbfe",B50:"#6598fe",
  B51:"#6565fe",B52:"#9865fe",B53:"#cb65fe",B54:"#fe65fe",B55:"#fe65cb",
  B56:"#fe6598",B57:"#fe6565",B58:"#cb9832",B59:"#98cb32",B60:"#32cb98",
  B61:"#3298cb",B62:"#3232cb",B63:"#9832cb",B64:"#cb3298",B65:"#cb3232",
  B66:"#4c4d00",B67:"#4b0097",B68:"#004c4d",B69:"#00004c",B70:"#4c004c",
  B71:"#974e00",B72:"#009845",B73:"#004997",B74:"#4a3a00",B75:"#3a004a",
  B76:"#004c00",B77:"#000049",B78:"#490000",B79:"#4a4a4a",B80:"#000000",
  B81:"#ffffff",B82:"#adc5f5",B83:"#f9eca8",B84:"#d9feb0",
  C1:"#fe3232",C2:"#fe6532",C3:"#fe9832",C4:"#fecb32",C5:"#fefe32",
  C6:"#cbfe32",C7:"#98fe32",C8:"#65fe32",C9:"#32fe32",C10:"#32fe65",
  C11:"#32fe98",C12:"#32fecb",C13:"#32fefe",C14:"#32cbfe",C15:"#3298fe",
  C16:"#3265fe",C17:"#3232fe",C18:"#6532fe",C19:"#9832fe",C20:"#cb32fe",
  C21:"#fe32fe",C22:"#fe32cb",C23:"#fe3298",C24:"#fe3265",C25:"#cb6532",
  C26:"#98cb32",C27:"#32cb98",C28:"#3298cb",C29:"#3232cb",C30:"#9832cb",
  C31:"#cb3298",C32:"#cb3232",C33:"#648cfd",C34:"#6665fe",C35:"#adc5f5",
  C36:"#f7b2ad",C37:"#f67f00",C38:"#979b00",C39:"#4b9a00",C40:"#f67f00",
  C41:"#009900",C42:"#00984a",C43:"#009899",C44:"#004999",C45:"#4a0098",
  C46:"#990049",C47:"#99004a",C48:"#984a00",C49:"#fe9898",C50:"#fecb98",
  C51:"#fefe98",C52:"#cbfe98",C53:"#98fe98",C54:"#98fecb",C55:"#98fefe",
  C56:"#98cbfe",C57:"#9898fe",C58:"#979b00",C59:"#cb98fe",C60:"#fe98fe",
  C61:"#fe98cb",C62:"#fe9898",C63:"#cb6565",C64:"#98cb65",C65:"#65cb98",
  C66:"#6598cb",C67:"#6565cb",C68:"#9865cb",C69:"#98004d",C70:"#4b9a00",
  C71:"#004b9a",C72:"#4b004a",C73:"#9a4b00",C74:"#4c4d00",C75:"#00004b",
  C76:"#004c00",C77:"#4c0000",C78:"#004d4d",C79:"#4b0097",C80:"#970048",
  C81:"#974e00",C82:"#007a00",C83:"#007a7a",C84:"#00007a",
};

function getDyeHex(code) {
  if (!code || code === "Hidden" || code === "Unknown") return "#cccccc";
  return DYE_HEX[code] ?? "#cccccc";
}

async function fetchData() {
  const res = await fetch(JSON_URL, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const raw = await res.json();
  return raw.map((item) => ({
    boss: item["Boss Name"] ?? "-",
    dye: item["Color"] ?? "-",
    hex: getDyeHex(item["Color"]),
  }));
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function brightness({ r, g, b }) {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function getMonthLabel() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

function drawTable(data, monthLabel, outputPath) {
  const columns = Math.ceil(data.length / ITEMS_PER_COLUMN);
  const width = columns * COLUMN_WIDTH + PADDING * 2;
  const height = HEADER_HEIGHT + ITEMS_PER_COLUMN * ROW_HEIGHT + PADDING * 2;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "middle";

  for (let col = 0; col < columns; col++) {
    const startX = PADDING + col * COLUMN_WIDTH;

    if (col > 0) {
      ctx.strokeStyle = "#d0d0d0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX - PADDING, 0);
      ctx.lineTo(startX - PADDING, height);
      ctx.stroke();
    }

    ctx.fillStyle = "#333";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Boss Name (${monthLabel})`, startX, HEADER_HEIGHT / 2);
    ctx.fillText("Color", startX + COLUMN_WIDTH - 90, HEADER_HEIGHT / 2);

    ctx.strokeStyle = "#b4b4b4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, HEADER_HEIGHT - 4);
    ctx.lineTo(startX + COLUMN_WIDTH - PADDING, HEADER_HEIGHT - 4);
    ctx.stroke();

    const rows = data.slice(col * ITEMS_PER_COLUMN, (col + 1) * ITEMS_PER_COLUMN);
    rows.forEach((item, rowIdx) => {
      const yTop = HEADER_HEIGHT + rowIdx * ROW_HEIGHT;
      const yCenter = yTop + ROW_HEIGHT / 2;

      if (rowIdx % 2 === 0) {
        ctx.fillStyle = "#ebebeb";
        ctx.fillRect(startX - 4, yTop, COLUMN_WIDTH - PADDING, ROW_HEIGHT);
      }

      ctx.fillStyle = "#333";
      ctx.font = "17px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(item.boss, startX, yCenter);

      const boxW = 72;
      const boxH = 30;
      const boxX = startX + COLUMN_WIDTH - boxW - PADDING * 2;
      const boxY = yCenter - boxH / 2;

      const rgb = hexToRgb(item.hex);
      ctx.fillStyle = item.hex;
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = brightness(rgb) > 140 ? "#000000" : "#ffffff";
      ctx.font = "17px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item.dye, boxX + boxW / 2, yCenter);
    });
  }

  fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
  console.log(`Image saved: ${outputPath}`);
}

async function main() {
  console.log(`Fetching ${JSON_URL} ...`);
  const data = await fetchData();

  console.log(`Total entries found: ${data.length}`);

  if (!data.length) {
    console.error("Error: no data found");
    process.exit(1);
  }

  const monthLabel = getMonthLabel();
  console.log(`Month: ${monthLabel}`);

  drawTable(data, monthLabel, PNG_OUTPUT);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
