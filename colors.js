import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
/**
 * Fungsi untuk membersihkan nama kristal dari teks residu DOM
 */
function cleanName(name) {
  if (!name) return "";
  return name
    .replace(/\s*(Upgrade Into|Crafting|Furniture|Used For)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function scrapeToramXtal() {
  const baseUrl = "https://coryn.club/item.php?special=xtal&p=";
  let allXtalRaw = [];
  let page = 0;
  let hasMoreData = true;

  try {
    console.log("Memulai ekstraksi data daring...");

    // Loop halaman hingga tidak ada data lagi
    while (hasMoreData) {
      console.log(`Mengambil data dari halaman ${page}...`);
      const { data } = await axios.get(`${baseUrl}${page}`);
      const $ = cheerio.load(data);
      const cards = $(".card-container > div");

      if (cards.length === 0) {
        hasMoreData = false;
        console.log("Tidak ada data lagi ditemukan. Berhenti.");
        break;
      }

      cards.each((_, el) => {
        const titleElement = $(el).find(".card-title");
        if (titleElement.length === 0) return;

        const fullName = titleElement.text().trim();
        const typeMatch = fullName.match(/\[(.*?)\]/);
        const name = cleanName(fullName.replace(/\[.*?\]/, ""));
        const type = typeMatch ? typeMatch[1] : "Unknown";

        const stats = {};
        $(el)
          .find(".item-basestat > div")
          .each((idx, statEl) => {
            if (idx === 0) return;
            const statName = $(statEl).find("div:first-child").text().trim();
            const statVal = $(statEl).find("div:last-child").text().trim();
            if (statName) stats[statName] = statVal;
          });

        // Normalisasi nilai "Upgrade for" agar bersih
        if (stats["Upgrade for"]) {
          stats["Upgrade for"] = cleanName(stats["Upgrade for"]);
        }

        // Ambil daftar upgrade selanjutnya untuk pemetaan rute nanti
        const upgradeInto = [];
        $(el)
          .find("li")
          .each((__, liEl) => {
            if ($(liEl).text().includes("Used For")) {
              $(liEl)
                .find("ul.styled-list li a")
                .each((___, a) => {
                  upgradeInto.push(cleanName($(a).text()));
                });
            }
          });

        allXtalRaw.push({
          name,
          type,
          stats,
          upgradeFor: stats["Upgrade for"] || null,
          upgradeInto,
        });
      });

      page++;
      // Delay singkat agar tidak membebani server (optional)
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`Total data mentah berhasil diambil: ${allXtalRaw.length}`);

    // Tahap Membangun Rute Upgrade
    const finalData = allXtalRaw.map((xtal) => {
      const isRoot = !xtal.upgradeFor;
      const route = buildUpgradeRoute(xtal.name, allXtalRaw);

      return {
        name: xtal.name,
        type: xtal.type,
        stats: xtal.stats,
        upgrade_route: !isRoot ? route : null,
      };
    });

    // Simpan ke file JSON
    fs.writeFileSync(
      "xtal_data.json",
      JSON.stringify(finalData, null, 2),
      "utf-8",
    );
    console.log("Berhasil! Data telah disimpan ke dalam 'xtal_data.json'.");
  } catch (error) {
    console.error("Terjadi kesalahan pada proses scraping:", error.message);
  }
}

/**
 * Membangun rute upgrade lengkap dari root ke puncak
 */
function buildUpgradeRoute(currentName, fullList) {
  let rootName = currentName;
  let temp = fullList.find((x) => x.name === rootName);

  // 1. Cari Root (Akar paling dasar)
  while (temp && temp.upgradeFor) {
    rootName = temp.upgradeFor;
    temp = fullList.find((x) => x.name === rootName);
  }

  // 2. Susun jalur dari Root ke bawah (Maju)
  const route = [];
  let curr = fullList.find((x) => x.name === rootName);
  const visited = new Set();

  while (curr && !visited.has(curr.name)) {
    route.push(curr.name);
    visited.add(curr.name);

    if (curr.upgradeInto && curr.upgradeInto.length > 0) {
      // Mengambil jalur upgrade pertama (asumsi linear)
      const nextName = curr.upgradeInto[0];
      curr = fullList.find((x) => x.name === nextName);
    } else {
      curr = null;
    }
  }

  return route.length > 1 ? route : null;
}

scrapeToramXtal();
