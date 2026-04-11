/**
 * Iruna Wiki Monster Scraper
 * ==========================
 * irunawiki.com adalah website Next.js (React) yang merender data via JavaScript.
 * Karena itu, fetch biasa TIDAK BISA mengambil data monster.
 *
 * Solusi: gunakan Puppeteer (headless Chrome) untuk merender halaman,
 * scroll hingga bawah untuk load semua monster, lalu parse datanya.
 *
 * Install dependencies:
 *     npm install puppeteer
 *
 * Cara pakai:
 *     node iruna_scraper.js
 *
 * Catatan: file ini menggunakan ESM (ES Modules).
 * Pastikan package.json punya "type": "module",
 * ATAU rename file ini menjadi iruna_scraper.mjs
 */

import puppeteer from "puppeteer";
import { writeFileSync } from "fs";

const BASE_URL = "https://irunawiki.com";
const MONSTER_LIST_URL = `${BASE_URL}/monsters`;

// ──────────────────────────────────────────────
// 1. Scroll halaman /monsters sampai bawah
//    untuk memastikan semua monster ter-load
// ──────────────────────────────────────────────

async function scrollToBottom(page) {
  console.log("[*] Scroll ke bawah untuk load semua monster ...");

  let prevHeight = 0;
  let attempts = 0;
  const MAX_ATTEMPTS = 30; // batas scroll agar tidak infinite

  while (attempts < MAX_ATTEMPTS) {
    const currHeight = await page.evaluate(() => document.body.scrollHeight);

    // Kalau tinggi halaman tidak bertambah lagi, berarti semua sudah ter-load
    if (currHeight === prevHeight) break;

    prevHeight = currHeight;
    attempts++;

    // Scroll ke paling bawah
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Tunggu konten baru muncul
    await new Promise((r) => setTimeout(r, 1500));

    process.stdout.write(`\r  Scroll ke-${attempts}, tinggi halaman: ${currHeight}px`);
  }

  console.log(`\n[*] Scroll selesai (${attempts}x)`);
}

// ──────────────────────────────────────────────
// 2. Ambil daftar semua monster dari halaman /monsters
// ──────────────────────────────────────────────

async function getMonsterLinks(page) {
  console.log(`[*] Membuka ${MONSTER_LIST_URL} ...`);
  await page.goto(MONSTER_LIST_URL, { waitUntil: "networkidle2" });

  // Tunggu sampai link monster pertama muncul
  await page.waitForSelector("a[href*='/monster/']", { timeout: 15000 });

  // Scroll sampai bawah agar semua monster ter-load
  await scrollToBottom(page);

  const monsters = await page.evaluate((baseUrl) => {
    const seen = new Set();
    const results = [];

    for (const a of document.querySelectorAll("a[href*='/monster/']")) {
      const href = a.getAttribute("href");
      if (!href.startsWith("/monster/") || seen.has(href)) continue;
      seen.add(href);

      const name =
        a.innerText.trim() ||
        decodeURIComponent(href.split("/").pop().replace(/_\d+$/, ""));

      results.push({ name, url: baseUrl + href });
    }

    return results;
  }, BASE_URL);

  console.log(`[*] Total monster ditemukan: ${monsters.length}`);
  return monsters;
}

// ──────────────────────────────────────────────
// 3. Parse satu halaman monster
// ──────────────────────────────────────────────

async function parseMonsterPage(page, url) {
  const data = await page.evaluate(() => {
    // ── Nama & lokasi dari <title>
    // Contoh: "Iruna Leedle Colon【Lv 18, Rokoko Plains】 | Iruna Wiki"
    const titleMatch = document.title.match(/Iruna (.+?)【.+?,\s*(.+?)】/);
    const name     = titleMatch?.[1].trim() ?? "";
    const location = titleMatch?.[2].trim() ?? "";

    // ── Stats dari stat-box
    const stats = {};
    for (const box of document.querySelectorAll(".stat-box")) {
      const t = box.querySelector(".stat-title");
      const v = box.querySelector(".stat-value");
      if (t && v) stats[t.innerText.trim()] = v.innerText.trim();
    }

    // ── Drop items
    const drops = [...document.querySelectorAll(".drop-container")]
      .map((d) => d.innerText.trim())
      .filter(Boolean);

    return { name, location, stats, drops };
  });

  return {
    Name:             data.name,
    Location:         data.location,
    URL:              url,
    Lv:               data.stats["Lv"]              ?? "",
    MaxHP:            data.stats["MaxHP"]            ?? "",
    EXP:              data.stats["EXP"]              ?? "",
    ATK:              data.stats["ATK"]              ?? "",
    MATK:             data.stats["MATK"]             ?? "",
    DEF:              data.stats["DEF"]              ?? "",
    MDEF:             data.stats["MDEF"]             ?? "",
    STR:              data.stats["STR"]              ?? "",
    AGI:              data.stats["AGI"]              ?? "",
    VIT:              data.stats["VIT"]              ?? "",
    INT:              data.stats["INT"]              ?? "",
    DEX:              data.stats["DEX"]              ?? "",
    CRT:              data.stats["CRT"]              ?? "",
    HIT:              data.stats["HIT"]              ?? "",
    EVA:              data.stats["EVA"]              ?? "",
    "Movement Speed": data.stats["Movement Speed"]   ?? "",
    "Poison R%":      data.stats["Poison R%"]        ?? "",
    "Paralyze R%":    data.stats["Paralyze R%"]      ?? "",
    "Blind R%":       data.stats["Blind R%"]         ?? "",
    "Stun R%":        data.stats["Stun R%"]          ?? "",
    "Burn R%":        data.stats["Burn R%"]          ?? "",
    "Freeze R%":      data.stats["Freeze R%"]        ?? "",
    "Lethargy R%":    data.stats["Lethargy R%"]      ?? "",
    "Dizzy R%":       data.stats["Dizzy R%"]         ?? "",
    "Bleed R%":       data.stats["Bleed R%"]         ?? "",
    "Fear R%":        data.stats["Fear R%"]          ?? "",
    "Melee R%":       data.stats["Melee R%"]         ?? "",
    "Magic R%":       data.stats["Magic R%"]         ?? "",
    Drops:            data.drops.join(" | "),
  };
}

// ──────────────────────────────────────────────
// 4. Simpan ke CSV
// ──────────────────────────────────────────────

function saveToCsv(data, filename = "iruna_monsters.csv") {
  if (!data.length) {
    console.log("[!] Tidak ada data untuk disimpan.");
    return;
  }

  const headers = Object.keys(data[0]);
  const escape  = (val) => {
    const s = String(val ?? "");
    return s.includes(",") || s.includes("\n") || s.includes('"')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const csv = [
    headers.join(","),
    ...data.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ].join("\n");

  writeFileSync(filename, csv, "utf-8");
  console.log(`\n[✓] Tersimpan: ${filename} (${data.length} monster)`);
}

// ──────────────────────────────────────────────
// 5. Main
// ──────────────────────────────────────────────

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36"
);

const results = [];

try {
  const links = await getMonsterLinks(page);

  for (let i = 0; i < links.length; i++) {
    const { url } = links[i];
    console.log(`[${i + 1}/${links.length}] Scraping: ${url}`);

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
      await page.waitForSelector(".stat-box", { timeout: 10000 });

      const data = await parseMonsterPage(page, url);
      results.push(data);
      console.log(`  -> ${data.Name} Lv${data.Lv} @ ${data.Location}`);

      // Jeda kecil agar tidak kena rate-limit
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.log(`  [!] Gagal: ${err.message}`);
    }
  }
} finally {
  await browser.close();
}

saveToCsv(results, "iruna_monsters.csv");
