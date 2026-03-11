import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

/**
 * Bersihkan nama xtal dari PHP debug noise di HTML coryn.club
 * Contoh noise: "[phpBB Debug] PHP Notice ... Undefined variable: lang\nNama Xtal"
 */
function cleanXtalName(rawText) {
  if (!rawText) return "";
  return rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith("[phpBB") &&
        !l.startsWith("in file") &&
        !l.startsWith("on line") &&
        !l.startsWith(":") &&
        !l.startsWith("Undefined"),
    )
    .join(" ")
    .trim();
}

/** Normalisasi untuk perbandingan nama (case-insensitive, trim) */
function norm(name) {
  return name?.trim().toLowerCase() ?? "";
}

async function scrapeToramXtal() {
  const baseUrl = "https://coryn.club/item.php?special=xtal&p=";

  // Header browser agar tidak kena 403
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    Referer: "https://coryn.club/",
  };

  let allXtalRaw = [];
  let page = 0;
  let hasMoreData = true;

  try {
    console.log("Memulai ekstraksi data...");

    while (hasMoreData) {
      console.log(`Halaman ${page}...`);
      const { data } = await axios.get(`${baseUrl}${page}`, { headers });
      const $ = cheerio.load(data);
      const cards = $(".card-container > div");

      if (cards.length === 0) {
        console.log("Tidak ada data lagi. Berhenti.");
        hasMoreData = false;
        break;
      }

      cards.each((_, el) => {
        // ── Nama & Tipe ──────────────────────────────────────────────────
        const cardTitleEl = $(el).find(".card-title").first();
        const name = cleanXtalName(cardTitleEl.find("a").first().text());
        if (!name) return; // skip card kosong/rusak

        const typeRaw = cardTitleEl.find(".item-card-type").text().trim();
        const typeMatch = typeRaw.match(/\[(.*?)\]/);
        const type = typeMatch ? typeMatch[1] : "Unknown";

        // ── Stats & upgradeFor ───────────────────────────────────────────
        // "Upgrade for: X" artinya xtal INI adalah versi upgrade DARI X
        // → X = pendahulu/root, xtal ini = lebih tinggi
        const stats = {};
        let upgradeFor = null;

        $(el)
          .find(".table-grid.item-basestat > div")
          .each((idx, statEl) => {
            if (idx === 0) return; // skip header row
            const key = $(statEl).find("div:first-child").text().trim();
            const valEl = $(statEl).find("div:last-child");
            const val =
              valEl.find("a").length > 0
                ? valEl.find("a").text().trim()
                : valEl.text().trim();
            if (key) {
              stats[key] = val;
              if (key === "Upgrade for") upgradeFor = val.trim() || null;
            }
          });

        // ── upgradeInto ──────────────────────────────────────────────────
        // "Used For > Upgrade Into: Y" artinya xtal ini bisa diupgrade MENJADI Y
        // → Y = penerus/lebih tinggi
        const upgradeInto = [];

        $(el)
          .find("ul.accordion > li")
          .each((_, liEl) => {
            const headerText = $(liEl).find("> div:first-child").text().trim();
            if (headerText.includes("Used For")) {
              $(liEl)
                .find("p.card-title")
                .each((_, pEl) => {
                  if ($(pEl).text().trim() === "Upgrade Into") {
                    $(pEl)
                      .next("ul.styled-list")
                      .find("li a")
                      .each((_, a) => {
                        const n = cleanXtalName($(a).text());
                        if (n) upgradeInto.push(n);
                      });
                  }
                });
            }
          });

        allXtalRaw.push({ name, type, stats, upgradeFor, upgradeInto });
      });

      page++;
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`Total xtal terkumpul: ${allXtalRaw.length}`);

    // ── Bangun upgrade_route & max_upgrade_route ─────────────────────────
    //
    // Relasi:
    //   upgradeFor  = xtal ini upgrade DARI X → X adalah PENDAHULU
    //   upgradeInto = xtal ini upgrade MENJADI Y → Y adalah PENERUS
    //
    //   ROOT   = tidak punya upgradeFor (tidak ada pendahulu)
    //   PUNCAK = tidak punya upgradeInto (tidak ada penerus)
    //
    // upgrade_route     = "Root -> ... -> posisi xtal ini"
    //                     null jika xtal ini adalah ROOT
    //
    // max_upgrade_route = "Root -> ... -> Puncak"
    //                     null jika xtal ini sudah di PUNCAK (atau standalone)

    const byName = new Map(allXtalRaw.map((x) => [norm(x.name), x]));

    /**
     * Bangun path penuh dari Root hingga Puncak
     * untuk xtal dengan nama startName
     */
    function buildFullPath(startName) {
      let cur = byName.get(norm(startName));
      const visited = new Set();

      // 1. Naik ke ROOT lewat upgradeFor
      while (cur && cur.upgradeFor) {
        if (visited.has(norm(cur.name))) break; // hindari loop
        visited.add(norm(cur.name));
        const parent = byName.get(norm(cur.upgradeFor));
        if (!parent) break; // parent tidak ditemukan di data
        cur = parent;
      }
      const root = cur;
      if (!root) return null;

      // 2. Turun dari ROOT ke PUNCAK lewat upgradeInto[0]
      const path = [];
      let node = root;
      const seen = new Set();

      while (node && !seen.has(norm(node.name))) {
        path.push(node.name);
        seen.add(norm(node.name));
        if (node.upgradeInto && node.upgradeInto.length > 0) {
          node = byName.get(norm(node.upgradeInto[0])) ?? null;
        } else {
          node = null;
        }
      }

      return path; // [root, intermediate..., puncak]
    }

    const finalData = allXtalRaw.map((xtal) => {
      const fullPath = buildFullPath(xtal.name);

      // Standalone: tidak ada jalur upgrade (sendiri saja)
      if (!fullPath || fullPath.length <= 1) {
        return {
          name: xtal.name,
          type: xtal.type,
          stats: xtal.stats,
          upgrade_route: null,
          max_upgrade_route: null,
        };
      }

      const idxSelf = fullPath.map(norm).indexOf(norm(xtal.name));
      const isRoot = idxSelf === 0;
      const isPuncak = idxSelf === fullPath.length - 1;

      // Route xtal ini: Root -> ... -> posisi ini (null kalau IS root)
      const upgrade_route = !isRoot
        ? fullPath.slice(0, idxSelf + 1).join(" -> ")
        : null;

      // Route max: Root -> ... -> Puncak (null kalau sudah di puncak)
      const max_upgrade_route = !isPuncak ? fullPath.join(" -> ") : null;

      return {
        name: xtal.name,
        type: xtal.type,
        stats: xtal.stats,
        upgrade_route,
        max_upgrade_route,
      };
    });

    fs.writeFileSync(
      "xtal_data.json",
      JSON.stringify(finalData, null, 2),
      "utf-8",
    );
    console.log("Selesai! Data tersimpan di 'xtal_data.json'.");

    // Preview contoh yang punya route
    const contoh = finalData
      .filter((x) => x.upgrade_route || x.max_upgrade_route)
      .slice(0, 5);
    console.log("\n── Preview ──");
    contoh.forEach((x) => {
      console.log(`\n${x.name}`);
      console.log(
        `  upgrade_route    : ${x.upgrade_route ?? "(sudah di root)"}`,
      );
      console.log(
        `  max_upgrade_route: ${x.max_upgrade_route ?? "(sudah di puncak)"}`,
      );
    });
  } catch (err) {
    console.error("Error:", err.message);
  }
}

scrapeToramXtal();
