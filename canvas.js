const puppeteer = require("puppeteer");
const fs = require("fs/promises");

const TARGET_URL = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";

// Class "color-wep-table" sudah dikonfirmasi masih ada di HTML asli (cek
// debug_failed_state.html), jadi kita pakai selector spesifik ini sebagai
// jalur utama (paling cepat & akurat). Sebagai jaring pengaman kalau suatu
// saat class-nya berubah lagi, kita fallback ke "table" generik yang
// difilter berdasarkan ISI baris (kolom ke-2 berupa kode warna seperti
// "A1", "B23", "C9", "Hidden", atau "Unknown").
const TABLE_SELECTOR = "table.color-wep-table, table";

// Predikat ini dikirim ke dalam browser context lewat $$eval, jadi harus
// berupa fungsi murni (tidak boleh memakai variabel dari luar).
function isColorWeaponTablePredicate(table) {
  const rows = table.querySelectorAll("tbody tr, tr");
  if (rows.length === 0) return false;

  let matchCount = 0;
  let consideredRows = 0;
  for (const row of rows) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue;
    consideredRows++;
    const text = cells[1].textContent.replace(/\s+/g, " ").trim();
    if (/^(■\s*)?(Hidden|Unknown|[ABC]\s*\d{1,3})$/i.test(text)) {
      matchCount++;
    }
  }
  if (consideredRows === 0) return false;
  // Anggap valid kalau mayoritas barisnya cocok pola kode warna.
  return matchCount > 0 && matchCount >= consideredRows * 0.5;
}

async function scrapeTableData(page) {
  try {
    const predicateSrc = isColorWeaponTablePredicate.toString();

    const allTablesData = await page.$$eval(
      TABLE_SELECTOR,
      (tableEls, predicateSrc) => {
        // Re-create predicate function inside browser context.
        // eslint-disable-next-line no-new-func
        const isColorWeaponTable = new Function(
          "table",
          `const fn = ${predicateSrc}; return fn(table);`
        );

        return tableEls
          .filter((table) => isColorWeaponTable(table))
          .map((table) =>
            Array.from(table.querySelectorAll("tbody tr, tr"))
              .map((row) => {
                const cells = row.querySelectorAll("td");
                if (cells.length < 2) return null;

                const boss = cells[0].textContent.replace(/\s+/g, " ").trim();
                if (!boss) return null;

                const fontEl = cells[1].querySelector("font");
                const colorHex = fontEl?.style?.color ?? null;
                const colorCode = cells[1].textContent
                  .replace(/■/g, "")
                  .replace(/\s+/g, " ")
                  .trim();

                return { boss, colorHex, colorCode };
              })
              .filter(Boolean)
          );
      },
      predicateSrc
    );

    const filtered = allTablesData.filter((t) => t.length > 0);

    if (filtered.length === 0) {
      throw new Error(
        "Tidak ada tabel dengan pola data warna (Boss Name + Color) yang ditemukan di halaman."
      );
    }

    return filtered;
  } catch (err) {
    throw new Error(`Gagal mengambil data tabel: ${err.message}`);
  }
}

async function screenshotTablesContainer(page) {
  try {
    const predicateSrc = isColorWeaponTablePredicate.toString();

    const containerHandle = await page.evaluateHandle(
      (selector, predicateSrc) => {
        // eslint-disable-next-line no-new-func
        const isColorWeaponTable = new Function(
          "table",
          `const fn = ${predicateSrc}; return fn(table);`
        );

        const tables = Array.from(document.querySelectorAll(selector)).filter(
          (t) => isColorWeaponTable(t)
        );
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
      },
      TABLE_SELECTOR,
      predicateSrc
    );

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

async function waitForColorWeaponTables(page, timeout = 60000) {
  const predicateSrc = isColorWeaponTablePredicate.toString();

  await page.waitForFunction(
    (selector, predicateSrc) => {
      // eslint-disable-next-line no-new-func
      const isColorWeaponTable = new Function(
        "table",
        `const fn = ${predicateSrc}; return fn(table);`
      );
      const tables = Array.from(document.querySelectorAll(selector));
      return tables.some((t) => isColorWeaponTable(t));
    },
    { timeout },
    TABLE_SELECTOR,
    predicateSrc
  );
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

    // Halaman ini memuat iframe Google Ads + script analytics pihak ketiga
    // (accaii.com, googlesyndication.com) yang bisa membuat event "load"
    // atau "networkidle" tidak pernah terpenuhi dalam batas waktu, padahal
    // tabel datanya sendiri sudah ter-render sejak DOMContentLoaded (server
    // side rendered, bukan via JS). Jadi cukup tunggu "domcontentloaded".
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 90000 });

    await dismissConsentIfPresent(page);

    try {
      await waitForColorWeaponTables(page, 60000);
    } catch (err) {
      await page.screenshot({ path: "debug_failed_state.png", fullPage: true });
      const html = await page.content();
      await fs.writeFile("debug_failed_state.html", html, "utf-8");
      throw new Error(
        "Tabel data warna tidak ditemukan dalam 60 detik. Cek debug_failed_state.png dan debug_failed_state.html untuk lihat tampilan halaman saat gagal."
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
