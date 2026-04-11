/**
 * Iruna Wiki Monster Scraper
 * ==========================
 * irunawiki.com adalah website Next.js (React) yang merender data via JavaScript.
 * Karena itu, fetch biasa TIDAK BISA mengambil data monster.
 *
 * Solusi: gunakan Puppeteer (headless Chrome) untuk merender halaman,
 * lalu parse HTML-nya.
 *
 * Install dependencies:
 *     npm install puppeteer
 *
 * Cara pakai:
 *     node iruna_scraper.js
 */

const puppeteer = require("puppeteer");
const fs = require("fs");

const BASE_URL = "https://irunawiki.com";
const MONSTER_LIST_URL = `${BASE_URL}/monsters`;

// ──────────────────────────────────────────────
// 1. Ambil daftar semua monster dari halaman /monsters
// ──────────────────────────────────────────────

async function getMonsterLinks(page) {
  console.log(`[*] Membuka ${MONSTER_LIST_URL} ...`);
  await page.goto(MONSTER_LIST_URL, { waitUntil: "networkidle2" });

  // Tunggu sampai link monster muncul (JS selesai render)
  await page.waitForSelector("a[href*='/monster/']", { timeout: 15000 });

  const monsters = await page.evaluate((baseUrl) => {
    const seen = new Set();
    const results = [];

    document.querySelectorAll("a[href*='/monster/']").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href.startsWith("/monster/") || seen.has(href)) return;
      seen.add(href);

      const name =
        a.innerText.trim() ||
        decodeURIComponent(href.split("/").pop().replace(/_\d+$/, ""));

      results.push({ name, url: baseUrl + href });
    });

    return results;
  }, BASE_URL);

  console.log(`[*] Ditemukan ${monsters.length} monster`);
  return monsters;
}

// ──────────────────────────────────────────────
// 2. Parse satu halaman monster
// ──────────────────────────────────────────────

async function parseMonsterPage(page, url) {
  // Jalankan di dalam konteks browser — DOM sudah dirender JS
  const data = await page.evaluate(() => {
    // ── Nama & lokasi dari <title>
    // Contoh: "Iruna Leedle Colon【Lv 18, Rokoko Plains】 | Iruna Wiki"
    const titleText = document.title || "";
    const titleMatch = titleText.match(/Iruna (.+?)【.+?,\s*(.+?)】/);
    const name = titleMatch ? titleMatch[1].trim() : "";
    const location = titleMatch ? titleMatch[2].trim() : "";

    // ── Stats dari stat-box (title + value pairs)
    const stats = {};
    document.querySelectorAll(".stat-box").forEach((box) => {
      const t = box.querySelector(".stat-title");
      const v = box.querySelector(".stat-value");
      if (t && v) stats[t.innerText.trim()] = v.innerText.trim();
    });

    // ── Drop items
    const drops = [];
    document.querySelectorAll(".drop-container").forEach((d) => {
      const text = d.innerText.trim();
      if (text) drops.push(text);
    });

    return { name, location, stats, drops };
  });

  return {
    Name:           data.name,
    Location:       data.location,
    URL:            url,
    // Core stats
    Lv:             data.stats["Lv"]             ?? "",
    MaxHP:          data.stats["MaxHP"]           ?? "",
    EXP:            data.stats["EXP"]             ?? "",
    ATK:            data.stats["ATK"]             ?? "",
    MATK:           data.stats["MATK"]            ?? "",
    DEF:            data.stats["DEF"]             ?? "",
    MDEF:           data.stats["MDEF"]            ?? "",
    STR:            data.stats["STR"]             ?? "",
    AGI:            data.stats["AGI"]             ?? "",
    VIT:            data.stats["VIT"]             ?? "",
    INT:            data.stats["INT"]             ?? "",
    DEX:            data.stats["DEX"]             ?? "",
    CRT:            data.stats["CRT"]             ?? "",
    HIT:            data.stats["HIT"]             ?? "",
    EVA:            data.stats["EVA"]             ?? "",
    "Movement Speed": data.stats["Movement Speed"] ?? "",
    // Resistances
    "Poison R%":    data.stats["Poison R%"]       ?? "",
    "Paralyze R%":  data.stats["Paralyze R%"]     ?? "",
    "Blind R%":     data.stats["Blind R%"]        ?? "",
    "Stun R%":      data.stats["Stun R%"]         ?? "",
    "Burn R%":      data.stats["Burn R%"]         ?? "",
    "Freeze R%":    data.stats["Freeze R%"]       ?? "",
    "Lethargy R%":  data.stats["Lethargy R%"]     ?? "",
    "Dizzy R%":     data.stats["Dizzy R%"]        ?? "",
    "Bleed R%":     data.stats["Bleed R%"]        ?? "",
    "Fear R%":      data.stats["Fear R%"]         ?? "",
    "Melee R%":     data.stats["Melee R%"]        ?? "",
    "Magic R%":     data.stats["Magic R%"]        ?? "",
    // Drops (gabung jadi 1 kolom, pisah |)
    Drops:          data.drops.join(" | "),
  };
}

// ──────────────────────────────────────────────
// 3. Simpan ke CSV
// ──────────────────────────────────────────────

function saveToCsv(data, filename = "iruna_monsters.csv") {
  if (!data.length) {
    console.log("[!] Tidak ada data untuk disimpan.");
    return;
  }

  const headers = Object.keys(data[0]);

  const escape = (val) => {
    const s = String(val ?? "");
    // Wrap dengan quote jika ada koma, newline, atau quote
    return s.includes(",") || s.includes("\n") || s.includes('"')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = [
    headers.join(","),
    ...data.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  fs.writeFileSync(filename, rows.join("\n"), "utf-8");
  console.log(`\n[✓] Tersimpan: ${filename} (${data.length} monster)`);
}

// ──────────────────────────────────────────────
// 4. Main
// ──────────────────────────────────────────────

async function main() {
  // Ubah angka ini untuk test (misal 10 monster pertama).
  // Set 0 untuk ambil semua monster.
  const MAX_MONSTERS = 10;

  const browser = await puppeteer.launch({
    headless: "new",   // headless modern (tanpa jendela browser)
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
    let monsterLinks = await getMonsterLinks(page);
    if (MAX_MONSTERS > 0) monsterLinks = monsterLinks.slice(0, MAX_MONSTERS);

    for (let i = 0; i < monsterLinks.length; i++) {
      const m = monsterLinks[i];
      console.log(`[${i + 1}/${monsterLinks.length}] Scraping: ${m.url}`);

      try {
        await page.goto(m.url, { waitUntil: "networkidle2", timeout: 20000 });

        // Tunggu stats muncul
        await page.waitForSelector(".stat-box", { timeout: 10000 });

        const data = await parseMonsterPage(page, m.url);
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
}

main().catch(console.error);
