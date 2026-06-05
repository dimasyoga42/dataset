import puppeteer from "puppeteer";
import fs from "fs";
import { createCanvas } from "@napi-rs/canvas";

const URL = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";
const JSON_OUTPUT = "dye_data.json";
const PNG_OUTPUT = "dye_table.png";

const ITEMS_PER_COLUMN = 30;
const COLUMN_WIDTH = 400;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 55;
const PADDING = 16;

async function fetchData() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    await page.goto(URL, { waitUntil: "networkidle0", timeout: 60000 });

    try {
      await page.waitForSelector("table.color-wep-table tbody tr", { timeout: 15000 });
    } catch {
      console.error("Selector not found after wait, dumping page excerpt...");
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? "");
      console.error("Page text:", bodyText);
    }

    const result = await page.evaluate(() => {
      const tables = document.querySelectorAll("table.color-wep-table");
      if (!tables.length) return { data: [], monthLabel: "" };

      let monthLabel = "";
      const thEl = tables[0].querySelector("th");
      if (thEl) {
        const match = thEl.textContent.match(/(\d{6})/);
        if (match) monthLabel = match[1];
      }

      const seen = new Set();
      const data = [];

      tables.forEach((table) => {
        const rows = table.querySelectorAll("tbody tr");
        rows.forEach((row) => {
          const tds = row.querySelectorAll("td");
          if (tds.length < 2) return;

          const bossRaw = tds[0].textContent
            .replace(/\(Lv\.\s*\d+\s*\)/g, "")
            .replace(/\s+/g, " ")
            .trim();

          if (!bossRaw || bossRaw === "Boss Name") return;

          const key = bossRaw.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);

          const fontEl = tds[1].querySelector("font");
          let hex = "#cccccc";
          if (fontEl) {
            const style = fontEl.getAttribute("style") || "";
            const m = style.match(/color:\s*(#[0-9a-fA-F]{3,6})/);
            if (m) hex = m[1];
          }

          const tdText = tds[1].textContent.trim();
          const dyeMatch = tdText.match(/([A-Z]\d+|Hidden|Unknown)/);
          const dye = dyeMatch ? dyeMatch[1] : tdText;

          data.push({ boss: bossRaw, dye, hex });
        });
      });

      return { data, monthLabel };
    });

    if (!result.data.length) {
      const html = await page.content();
      const tableCount = (html.match(/color-wep-table/g) || []).length;
      console.error(`Tables with class 'color-wep-table' found in HTML: ${tableCount}`);
      const excerpt = html.slice(0, 2000);
      console.error("HTML excerpt:", excerpt);
    }

    return result;
  } finally {
    await browser.close();
  }
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
      ctx.fillText(item.boss ?? "-", startX, yCenter);

      const boxW = 72;
      const boxH = 30;
      const boxX = startX + COLUMN_WIDTH - boxW - PADDING * 2;
      const boxY = yCenter - boxH / 2;

      const rgb = hexToRgb(item.hex ?? "#cccccc");
      ctx.fillStyle = item.hex ?? "#cccccc";
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 1;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = brightness(rgb) > 140 ? "#000000" : "#ffffff";
      ctx.font = "17px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item.dye ?? "-", boxX + boxW / 2, yCenter);
    });
  }

  fs.writeFileSync(outputPath, canvas.toBuffer("image/png"));
  console.log(`Image saved: ${outputPath}`);
}

async function main() {
  console.log(`Fetching ${URL} ...`);
  const { data, monthLabel } = await fetchData();

  console.log(`Month: ${monthLabel}`);
  console.log(`Total entries found: ${data.length}`);

  if (!data.length) {
    console.error("Error: no data found in HTML tables");
    process.exit(1);
  }

  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(data, null, 2));
  console.log(`JSON saved: ${JSON_OUTPUT}`);

  const label = monthLabel || new Date().toISOString().slice(0, 7).replace("-", "");
  drawTable(data, label, PNG_OUTPUT);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
