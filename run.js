import puppeteer from "puppeteer";
import fs from "fs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function screenshot() {
  const url = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";
  const output = "dye_weapon.png";

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-features=site-per-process",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    );

    await page.setViewport({
      width: 1920,
      height: 1080,
    });

    console.log("opening page...");

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await delay(5000);

    const tables = await page.$$("table");

    if (tables.length === 0) {
      throw new Error("table not found");
    }

    console.log("table found:", tables.length);

    const box = await page.evaluate(() => {
      const tables = document.querySelectorAll("table");

      const first = tables[0].getBoundingClientRect();
      const last = tables[tables.length - 1].getBoundingClientRect();

      return {
        x: first.x,
        y: first.y,
        width: Math.max(first.width, last.width),
        height: last.bottom - first.top,
      };
    });

    await page.setViewport({
      width: Math.ceil(box.width) + 200,
      height: Math.ceil(box.height) + 200,
    });

    await delay(2000);

    await page.screenshot({
      path: output,
      type: "png",
      clip: {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: Math.ceil(box.width) + 40,
        height: Math.ceil(box.height) + 40,
      },
    });

    console.log("screenshot saved:", output);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

screenshot();
