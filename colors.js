import puppeteer from "puppeteer";
import fs from "fs";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;

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

async function scrape() {
  const url = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";

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

    await page.setViewport({
      width: 1920,
      height: 1080,
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await delay(4000);

    await autoScroll(page);

    const data = await page.evaluate(() => {
      const result = [];

      const tables = document.querySelectorAll("table");

      tables.forEach((table) => {
        const rows = table.querySelectorAll("tr");

        rows.forEach((row) => {
          const cols = row.querySelectorAll("td");

          if (cols.length >= 2) {
            const boss = cols[0].innerText.trim();

            const colors = [];

            cols.forEach((c, i) => {
              if (i > 0) {
                const text = c.innerText.trim();
                if (text) colors.push(text);
              }
            });

            if (boss && colors.length > 0) {
              result.push({
                boss,
                colors,
              });
            }
          }
        });
      });

      return result;
    });

    fs.writeFileSync("boss_colors.json", JSON.stringify(data, null, 2));

    console.log("saved boss_colors.json");
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

scrape();
