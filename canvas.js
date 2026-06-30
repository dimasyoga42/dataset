import puppeteer from "puppeteer";
import fs from "fs/promises";

const TARGET_URL = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";
const TABLE_SELECTOR = "table.color-wep-table";

async function scrapeTableData(page) {
  try {
    return await page.$$eval(TABLE_SELECTOR, (tableEls) =>
      tableEls.map((table) =>
        Array.from(table.querySelectorAll("tbody tr"))
          .map((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length < 2) return null;

            const boss = cells[0].textContent.replace(/\s+/g, " ").trim();
            const fontEl = cells[1].querySelector("font");
            const colorHex = fontEl?.style?.color ?? null;
            const colorCode = cells[1].textContent
              .replace(/■/g, "")
              .replace(/\s+/g, " ")
              .trim();

            return { boss, colorHex, colorCode };
          })
          .filter(Boolean)
      )
    );
  } catch (err) {
    throw new Error(`Gagal mengambil data tabel: ${err.message}`);
  }
}

async function screenshotTablesContainer(page) {
  try {
    const containerHandle = await page.evaluateHandle((selector) => {
      const tables = Array.from(document.querySelectorAll(selector));
      if (tables.length === 0) return null;

      let commonAncestor = tables[0].closest(".row") ?? tables[0].parentElement;
      if (!commonAncestor) return tables[0];

      while (
        commonAncestor.parentElement &&
        !tables.every((t) => commonAncestor.contains(t))
      ) {
        commonAncestor = commonAncestor.parentElement;
      }

      return commonAncestor;
    }, TABLE_SELECTOR);

    const element = containerHandle.asElement();
    if (!element) {
      throw new Error("Container tabel tidak ditemukan di halaman.");
    }

    await element.screenshot({ path: "colorweapon_tables_only.png" });
  } catch (err) {
    throw new Error(`Gagal mengambil screenshot tabel: ${err.message}`);
  }
}

async function dismissConsentIfPresent(page) {
  try {
    await page.waitForSelector(
      '[aria-label="Agree"], [aria-label="Consent"], .fc-cta-consent, .fc-button-label, #onetrust-accept-btn-handler',
      { timeout: 5000 }
    );

    const clicked = await page.evaluate(() => {
      const selectors = [
        '[aria-label="Agree"]',
        '[aria-label="Consent"]',
        ".fc-cta-consent",
        "#onetrust-accept-btn-handler",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (clicked) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } catch {
    // Tidak ada dialog consent yang muncul, lanjutkan tanpa error.
  }
}

async function main() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(TARGET_URL, { waitUntil: "load", timeout: 90000 });

    await dismissConsentIfPresent(page);

    try {
      await page.waitForSelector(TABLE_SELECTOR, { timeout: 60000 });
    } catch (err) {
      await page.screenshot({ path: "debug_failed_state.png", fullPage: true });
      const html = await page.content();
      await fs.writeFile("debug_failed_state.html", html, "utf-8");
      throw new Error(
        "Selector tabel tidak ditemukan dalam 60 detik. Cek debug_failed_state.png dan debug_failed_state.html untuk lihat tampilan halaman saat gagal."
      );
    }

    const tableData = await scrapeTableData(page);
    await fs.writeFile("colorweapon_data.json", JSON.stringify(tableData, null, 2), "utf-8");
    console.log("Data tabel disimpan ke: colorweapon_data.json");

    await page.screenshot({ path: "colorweapon_full.png", fullPage: true });
    console.log("Screenshot full page disimpan ke: colorweapon_full.png");

    await screenshotTablesContainer(page);
    console.log("Screenshot area tabel disimpan ke: colorweapon_tables_only.png");
  } catch (err) {
    console.error("Terjadi kesalahan saat scraping:", err.message);
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main();
