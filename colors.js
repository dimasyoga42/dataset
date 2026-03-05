import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";

async function scrapeAndSaveXtal() {
  const baseUrl = "https://coryn.club/item.php?special=xtal&p=";
  const allXtal = [];
  const fileName = "xtal_data.json";

  try {
    console.log("Memulai ekstraksi data daring...");

    // Melakukan iterasi halaman untuk memastikan kelengkapan data
    for (let p = 0; p <= 5; p++) {
      const { data } = await axios.get(`${baseUrl}${p}`);
      const $ = cheerio.load(data);
      const cards = $(".card-container > div");

      if (cards.length === 0) break;

      cards.each((i, el) => {
        const titleElement = $(el).find(".card-title");
        if (titleElement.length === 0) return;

        const fullName = titleElement.text().trim();
        const typeMatch = fullName.match(/\[(.*?)\]/);
        const name = fullName.replace(/\[.*?\]/, "").trim();
        const type = typeMatch ? typeMatch[1] : "";

        const stats = {};
        $(el)
          .find(".item-basestat > div")
          .each((idx, statEl) => {
            if (idx === 0) return;
            const statName = $(statEl).find("div:first-child").text().trim();
            const statVal = $(statEl).find("div:last-child").text().trim();
            if (statName) stats[statName] = statVal;
          });

        const upgradeInto = [];
        $(el)
          .find("li")
          .each((idx, liEl) => {
            if ($(liEl).text().includes("Used For")) {
              $(liEl)
                .find("ul.styled-list li a")
                .each((j, a) => {
                  upgradeInto.push($(a).text().trim());
                });
            }
          });

        const upgradeFor = stats["Upgrade for"] || null;

        allXtal.push({
          name,
          type,
          stats,
          upgradeFor,
          upgradeInto,
        });
      });
      console.log(`Halaman ${p} berhasil diproses.`);
    }

    // Memetakan rute upgrade dan memfilter tampilan sesuai permintaan
    const finalData = allXtal.map((xtal) => {
      const isRoot = !xtal.upgradeFor;
      const path = buildUpgradePath(xtal.name, allXtal);

      return {
        name: xtal.name,
        type: xtal.type,
        stats: xtal.stats,
        // Rute hanya muncul jika bukan root
        upgrade_route: !isRoot ? path : null,
      };
    });

    // Menyimpan hasil ke file JSON
    fs.writeFileSync(fileName, JSON.stringify(finalData, null, 2), "utf-8");
    console.log(`\nBerhasil! Data telah disimpan ke dalam berkas: ${fileName}`);
  } catch (error) {
    console.error("Terjadi kesalahan:", error.message);
  }
}

/**
 * Logika penelusuran rute upgrade linear
 */
function buildUpgradePath(currentName, fullList) {
  let rootName = currentName;
  let temp = fullList.find((x) => x.name === rootName);

  // Mencari akar (root) terdalam
  while (temp && temp.upgradeFor) {
    rootName = temp.upgradeFor;
    temp = fullList.find((x) => x.name === rootName);
  }

  const path = [];
  let curr = fullList.find((x) => x.name === rootName);

  // Menyusun silsilah dari dasar ke atas
  while (curr) {
    path.push(curr.name);
    if (curr.upgradeInto && curr.upgradeInto.length > 0) {
      const nextName = curr.upgradeInto[0];
      curr = fullList.find((x) => x.name === nextName);
    } else {
      curr = null;
    }
  }

  return path.length > 1 ? path : null;
}

scrapeAndSaveXtal();
