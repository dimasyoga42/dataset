import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

async function screenshot() {
  const url = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";

  // Output ke folder yang bisa diakses user
  const outputDir = "/mnt/user-data/outputs";
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const output = path.join(outputDir, "dye_weapon.png");

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    );
    await page.setViewport({ width: 1920, height: 1080 });

    console.log("Opening page...");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await delay(5000);

    const tables = await page.$$("table");
    if (tables.length === 0) {
      throw new Error("Table not found");
    }
    console.log("Tables found:", tables.length);

    await autoScroll(page);
    await delay(2000);

    const box = await page.evaluate(() => {
      const tables = document.querySelectorAll("table");
      const first = tables[0].getBoundingClientRect();
      const last = tables[tables.length - 1].getBoundingClientRect();
      return {
        x: Math.min(first.x, last.x),
        y: first.top + window.scrollY,
        width: Math.max(first.width, last.width),
        height: last.bottom + window.scrollY - (first.top + window.scrollY),
      };
    });

    console.log("Capture size:", box);

    await page.setViewport({
      width: Math.ceil(box.width) + 200,
      height: Math.ceil(box.height) + 200,
    });
    await delay(1500);

    await page.screenshot({
      path: output, // <-- path lengkap ke /mnt/user-data/outputs/dye_weapon.png
      type: "png",
      clip: {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: Math.ceil(box.width) + 40,
        height: Math.ceil(box.height) + 40,
      },
    });

    console.log("Screenshot saved to:", output);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

screenshot();
