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
    headless: true, // fix: "new" deprecated
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log("opening page...");

    // fix: domcontentloaded lebih stabil di CI daripada networkidle2
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await delay(5000);

    // Tunggu sampai tabel muncul
    try {
      await page.waitForSelector("table.color-wep-table", { timeout: 30000 });
    } catch {
      throw new Error("Timeout: tabel tidak ditemukan dalam 30 detik");
    }

    await autoScroll(page);
    await delay(1500);

    const data = await page.evaluate(() => {
      const result = [];

      // fix: target tabel spesifik pakai class, bukan semua <table>
      const tables = document.querySelectorAll("table.color-wep-table");

      tables.forEach((table) => {
        // Ambil judul bulan dari <h4> sebelum tabel (sibling)
        const h4 = table.previousElementSibling;
        const month = h4 ? h4.innerText.trim() : "unknown";

        const rows = table.querySelectorAll("tbody tr");

        rows.forEach((row) => {
          const cols = row.querySelectorAll("td");
          if (cols.length < 2) return;

          // fix: parse boss name lebih bersih (hapus whitespace berlebih)
          const bossRaw = cols[0].innerText.trim();
          const boss = bossRaw.replace(/\s+/g, " ");

          // fix: ambil hex color dari <font style="color: ...">
          const fontEl = cols[1].querySelector("font");
          const colorHex = fontEl
            ? (fontEl.getAttribute("style") || "")
                .replace("color:", "")
                .replace(";", "")
                .trim()
            : null;

          // fix: ambil kode warna teks (misal: A55, B12)
          const colorCode = cols[1].innerText.trim().replace("■", "").trim();

          if (boss && colorCode) {
            result.push({
              month,
              boss,
              colorCode,
              colorHex,
            });
          }
        });
      });

      return result;
    });

    if (data.length === 0) {
      throw new Error("Tidak ada data yang berhasil di-scrape");
    }

    fs.writeFileSync("boss_colors.json", JSON.stringify(data, null, 2));
    console.log(`saved boss_colors.json — ${data.length} entries`);
  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1); // fix: exit code 1 agar CI tahu gagal
  } finally {
    await browser.close();
  }
}

scrape();
