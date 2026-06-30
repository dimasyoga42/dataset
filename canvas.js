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

async function main() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 2 });

    await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForSelector(TABLE_SELECTOR, { timeout: 30000 });

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
