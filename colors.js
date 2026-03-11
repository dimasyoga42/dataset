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

        if (stats["Upgrade for"]) {
          stats["Upgrade for"] = cleanName(stats["Upgrade for"]);
        }

        // BUG FIX #1: Gunakan selector yang lebih tepat untuk "Used For"
        // Sebelumnya: mencari <li> yang mengandung teks "Used For" — tidak reliable
        // karena teks bisa tersebar di child elements
        const upgradeInto = [];
        $(el)
          .find(".item-basestat li, .card-body li")
          .each((__, liEl) => {
            const liText = $(liEl)
              .clone()
              .children()
              .remove()
              .end()
              .text()
              .trim();
            if (
              liText.includes("Used For") ||
              $(liEl).find("span, b, strong").text().includes("Used For")
            ) {
              $(liEl)
                .find("ul.styled-list li a, ul li a")
                .each((___, a) => {
                  upgradeInto.push(cleanName($(a).text()));
                });
            }
          });

        // BUG FIX #2: upgradeFor diambil dari stats SETELAH di-clean, bukan sebelum
        // Sebelumnya: stats["Upgrade for"] sudah di-overwrite, tapi referensi di push pakai
        // stats["Upgrade for"] yang belum tentu sama dengan yang disimpan di xtal.upgradeFor
        const upgradeFor = stats["Upgrade for"]
          ? cleanName(stats["Upgrade for"])
          : null;

        allXtalRaw.push({
          name,
          type,
          stats,
          upgradeFor, // konsisten: selalu dari cleanName
          upgradeInto,
        });
      });

      page++;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(`Total data mentah berhasil diambil: ${allXtalRaw.length}`);

    // BUG FIX #3: buildFullUpgradeRoute dipanggil dengan allXtalRaw yang sudah lengkap
    // MASALAH UTAMA: Di kode lama, finalData di-map() SEBELUM allXtalRaw selesai diisi.
    // Sekarang finalData diproses di sini, SETELAH loop selesai — sudah benar.
    // Namun ada bug di dalam buildFullUpgradeRoute itu sendiri (lihat fungsi di bawah).
    const finalData = allXtalRaw.map((xtal) => {
      const isRoot = !xtal.upgradeFor;
      const fullPath = buildFullUpgradeRoute(xtal.name, allXtalRaw);

      let currentRoute = null;
      let maxRoute = null;

      if (!isRoot && fullPath) {
        const currentIndex = fullPath.indexOf(xtal.name);
        // BUG FIX #4: Jika currentIndex === -1 (nama tidak ditemukan di path),
        // jangan slice — hasilnya array kosong yang membingungkan
        if (currentIndex !== -1) {
          currentRoute = fullPath.slice(0, currentIndex + 1).join(" -> ");
          maxRoute = fullPath.join(" -> ");
        }
      }

      return {
        name: xtal.name,
        type: xtal.type,
        stats: xtal.stats,
        upgrade_route: currentRoute,
        max_upgrade_route: maxRoute,
      };
    });

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
 * Mencari silsilah utuh dari Root hingga evolusi tertinggi.
 *
 * BUG FIX #5 (BUG UTAMA): Fungsi ini sebelumnya gagal menemukan root
 * karena pencarian pakai xtal.name exact-match, tapi nama di allXtalRaw
 * sudah di-clean() sedangkan upgradeFor mungkin belum konsisten.
 * Sekarang lookup pakai normalisasi trim+lowercase agar tidak case/space sensitif.
 */
function buildFullUpgradeRoute(currentName, fullList) {
  // Helper: cari xtal by name dengan normalisasi
  const findByName = (name) => {
    const normalized = name.trim().toLowerCase();
    return fullList.find((x) => x.name.trim().toLowerCase() === normalized);
  };

  // 1. Cari Root
  let rootName = currentName;
  let temp = findByName(rootName);
  const visited = new Set();

  while (temp && temp.upgradeFor) {
    if (visited.has(temp.name)) break; // hindari loop tak terbatas
    visited.add(temp.name);
    rootName = temp.upgradeFor;
    temp = findByName(rootName);
  }

  // 2. Susun jalur dari Root ke Puncak
  const route = [];
  let curr = findByName(rootName);
  const visitedPath = new Set();

  while (curr && !visitedPath.has(curr.name)) {
    route.push(curr.name);
    visitedPath.add(curr.name);

    if (curr.upgradeInto && curr.upgradeInto.length > 0) {
      const nextName = curr.upgradeInto[0];
      curr = findByName(nextName);
    } else {
      curr = null;
    }
  }

  return route.length > 1 ? route : null;
}

scrapeToramXtal();
