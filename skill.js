import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs/promises";
import { Parser } from "json2csv";

const BASE_URL = "https://coryn.club/";
const MAX_PAGE = 200;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchPage(url) {
  const { data } = await axios.get(url, {
    headers: HEADERS,
    timeout: 30000,
  });
  return data;
}

async function scrapeToramDatabase() {
  try {
    console.log("Memulai proses scraping...");
    const allItems = [];

    for (let page = 1; page <= MAX_PAGE; page++) {
      const url = `${BASE_URL}item.php?&show=11&order=id%20DESC&p=${page}`;
      console.log(`Mengambil Halaman ${page}...`);

      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      // Selector yang lebih spesifik untuk baris yang berisi data item
      // Di Coryn Club, baris data biasanya memiliki struktur td > b > a
      const itemRows = $("table.table-striped tbody tr");

      if (itemRows.length === 0) {
        console.log("Tidak ada baris terdeteksi, berhenti.");
        break;
      }

      let pageCount = 0;

      itemRows.each((_, el) => {
        const row = $(el);

        // Mencari elemen nama di dalam tag <b> sesuai struktur asli website
        const nameTag = row.find("td b a");
        const name = nameTag.text().trim();

        // Validasi: Lewati jika nama kosong atau baris bukan merupakan item
        if (!name) return;

        // Mengambil link detail
        const relativeLink = nameTag.attr("href");
        const link = relativeLink
          ? relativeLink.startsWith("http")
            ? relativeLink
            : BASE_URL + relativeLink
          : "-";

        // Mengambil seluruh teks dalam baris untuk ekstraksi statistik & durasi
        const fullText = row.text().trim();

        // Ekstraksi Tipe (biasanya di tag <small>)
        const type = row.find("small").first().text().trim() || "-";

        // Ekstraksi Durasi (Duration) menggunakan Regex
        const durationMatch = fullText.match(/Duration:\s*(\d+\s*\w+)/i);
        const duration = durationMatch ? durationMatch[1] : "-";

        // Ekstraksi Statistik (menggunakan class item-prop jika ada)
        const stats = row.find(".item-prop").text().trim() || "-";

        allItems.push({
          name,
          type,
          duration,
          stats,
          link,
        });

        pageCount++;
      });

      console.log(`Halaman ${page}: Berhasil mengambil ${pageCount} item.`);

      // Jika dalam satu halaman tidak ada item yang valid, kemungkinan sudah habis
      if (pageCount === 0) break;

      // Jeda agar tidak terkena rate limit/blokir
      await delay(1500);
    }

    if (allItems.length === 0) {
      throw new Error("Data tidak ditemukan. Periksa koneksi atau selector.");
    }

    // Simpan ke CSV
    const parser = new Parser();
    const csv = parser.parse(allItems);
    await fs.writeFile("coryn_fix.csv", csv, "utf8");

    console.log(
      `\nSELESAI: Total ${allItems.length} item disimpan ke 'coryn_fix.csv'`,
    );
  } catch (err) {
    console.error("TERJADI ERROR:", err.message);
  }
}

scrapeToramDatabase();
