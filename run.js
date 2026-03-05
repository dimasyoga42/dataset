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

    // Set viewport awal yang lebar agar tabel tidak wrap
    await page.setViewport({ width: 1920, height: 1080 });

    console.log("opening page...");
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await delay(3000);

    const tables = await page.$$("table");
    if (tables.length === 0) {
      throw new Error("table not found");
    }
    console.log("table found:", tables.length);

    // Scroll ke bawah agar semua elemen lazy-load ter-render
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });

    await delay(1000);

    // Ambil bounding box semua tabel (pakai scrollWidth/scrollHeight untuk akurasi penuh)
    const box = await page.evaluate(() => {
      const tables = document.querySelectorAll("table");
      if (tables.length === 0) return null;

      let minLeft = Infinity;
      let minTop = Infinity;
      let maxRight = -Infinity;
      let maxBottom = -Infinity;

      tables.forEach((table) => {
        const rect = table.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        const absLeft = rect.left + scrollX;
        const absTop = rect.top + scrollY;
        const absRight = rect.right + scrollX;
        const absBottom = rect.bottom + scrollY;

        if (absLeft < minLeft) minLeft = absLeft;
        if (absTop < minTop) minTop = absTop;
        if (absRight > maxRight) maxRight = absRight;
        if (absBottom > maxBottom) maxBottom = absBottom;
      });

      return {
        x: minLeft,
        y: minTop,
        width: maxRight - minLeft,
        height: maxBottom - minTop,
      };
    });

    if (!box) throw new Error("Failed to get bounding box");

    console.log("bounding box:", box);

    const padding = 30;
    const clipX = Math.max(0, Math.floor(box.x) - padding);
    const clipY = Math.max(0, Math.floor(box.y) - padding);
    const clipWidth = Math.ceil(box.width) + padding * 2;
    const clipHeight = Math.ceil(box.height) + padding * 2;

    // Resize viewport agar muat semua konten (penting untuk scroll content)
    await page.setViewport({
      width: Math.max(1920, clipX + clipWidth + 50),
      height: Math.max(1080, clipY + clipHeight + 50),
    });

    await delay(1000);

    await page.screenshot({
      path: output,
      type: "png",
      clip: {
        x: clipX,
        y: clipY,
        width: clipWidth,
        height: clipHeight,
      },
    });

    console.log(`screenshot saved: ${output} (${clipWidth}x${clipHeight})`);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

screenshot();
