import puppeteer from "puppeteer";
import fs from "fs";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function scrapeDye() {
  const url = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";
  const output = "dye_data.json";

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu"
    ]
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    console.log("opening page...");

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await page.waitForSelector("table");

    await delay(3000);

    const data = await page.evaluate(() => {
      const result = [];

      const tables = document.querySelectorAll("table");

      tables.forEach((table) => {
        const rows = table.querySelectorAll("tr");

        rows.forEach((row) => {
          const cols = row.querySelectorAll("td");

          if (cols.length >= 2) {
            const boss = cols[0].innerText.trim();
            const color = cols[1].innerText.trim();

            if (boss && color) {
              result.push({
                boss,
                color
              });
            }
          }
        });
      });

      return result;
    });

    fs.writeFileSync(output, JSON.stringify(data, null, 2));

    console.log("total data:", data.length);
    console.log("saved:", output);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

scrapeDye();
