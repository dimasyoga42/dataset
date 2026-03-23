/**
 * CORYN CLUB MONSTER DATA SCRAPER - JavaScript ESM Version
 * Scrape data monster dari URL dengan Node.js
 *
 * Requirements:
 *   npm install axios cheerio
 *
 * Usage:
 *   node scraper_direct.js
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MonsterScraper {
  constructor(outputFile = 'monster_data.csv') {
    this.url = 'https://coryn.club/monster.php?name=&type=&order=id+DESC&show=88';
    this.outputFile = outputFile;
    this.monsterData = [];
    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };
  }

  getTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  async fetchPage() {
    try {
      console.log(`[${this.getTime()}] Mengakses URL: ${this.url}`);
      const response = await axios.get(this.url, {
        headers: this.headers,
        timeout: 15000,
      });
      console.log(`[${this.getTime()}] ✓ Status: ${response.status}`);
      return response.data;
    } catch (error) {
      console.error(`[${this.getTime()}] ✗ Error: ${error.message}`);
      return null;
    }
  }

  parseHTML(html) {
    console.log(`[${this.getTime()}] Parsing HTML...`);
    const $ = cheerio.load(html);

    const cards = $('.card-title-inverse');
    console.log(`[${this.getTime()}] Ditemukan ${cards.length} monster cards`);

    if (cards.length === 0) {
      console.log(`[${this.getTime()}] ✗ Tidak ada data monster yang ditemukan`);
      return false;
    }

    cards.each((index, card) => {
      try {
        const monster = this.extractMonsterData($, card);
        if (monster) {
          this.monsterData.push(monster);
        }
      } catch (error) {
        console.log(
          `[${this.getTime()}] ⚠ Error processing card ${index + 1}: ${
            error.message
          }`
        );
      }
    });

    console.log(
      `[${this.getTime()}] Total data extracted: ${this.monsterData.length}`
    );
    return this.monsterData.length > 0;
  }

  extractMonsterData($, card) {
    try {
      const $card = $(card);

      const $link = $card.find('a').first();
      if ($link.length === 0) return null;

      const name = $link.text().trim();
      const url = $link.attr('href') || '';

      if (!name) return null;

      let $parent = $card.parent();
      for (let i = 0; i < 3; i++) {
        if ($parent.length === 0) break;
        $parent = $parent.parent();
      }

      const stats = this.extractStats($, $parent);
      const spawn = this.extractSpawn($, $parent);

      return {
        name: name,
        level: stats.level || 'N/A',
        type: stats.type || 'N/A',
        mode: stats.mode || 'N/A',
        hp: stats.hp || 'N/A',
        element: stats.element || 'N/A',
        exp: stats.exp || 'N/A',
        tamable: stats.tamable || 'N/A',
        spawn: spawn,
        url: url,
      };
    } catch (error) {
      return null;
    }
  }

  extractStats($, $parent) {
    const stats = {
      level: 'N/A',
      type: 'N/A',
      mode: 'N/A',
      hp: 'N/A',
      element: 'N/A',
      exp: 'N/A',
      tamable: 'N/A',
    };

    const labelMap = {
      Lv: 'level',
      Type: 'type',
      Mode: 'mode',
      HP: 'hp',
      Element: 'element',
      Exp: 'exp',
      Tamable: 'tamable',
    };

    $parent.find('div').each((index, div) => {
      const $div = $(div);
      const $ps = $div.children('p');

      if ($ps.length === 2) {
        const label = $ps.eq(0).text().trim();
        const value = $ps.eq(1).text().trim();

        if (labelMap[label]) {
          stats[labelMap[label]] = value;
        }
      }
    });

    return stats;
  }

  extractSpawn($, $parent) {
    try {
      const $hrs = $parent.find('hr.separator');
      if ($hrs.length === 0) return 'N/A';

      const $lastHr = $hrs.last();
      let $next = $lastHr.next();

      while ($next.length > 0) {
        if ($next.hasClass('item-prop')) {
          const $spawnLink = $next.find('a').first();
          if ($spawnLink.length > 0) {
            return $spawnLink.text().trim();
          }
        }
        $next = $next.next();
      }
    } catch (error) {}

    return 'N/A';
  }

  async saveCSV() {
    try {
      console.log(`[${this.getTime()}] Menyimpan data ke CSV...`);

      const csvData = this.monsterData.map((monster) => [
        monster.name,
        monster.level,
        monster.type,
        monster.mode,
        monster.hp,
        monster.element,
        monster.exp,
        monster.tamable,
        monster.spawn,
        monster.url,
      ]);

      const csvContent = csvData
        .map((row) =>
          row
            .map((cell) => {
              if (
                typeof cell === 'string' &&
                (cell.includes(',') || cell.includes('"'))
              ) {
                return `"${cell.replace(/"/g, '""')}"`;
              }
              return cell;
            })
            .join(',')
        )
        .join('\n');

      fs.writeFileSync(path.join(__dirname, this.outputFile), csvContent, 'utf-8');

      console.log(`[${this.getTime()}] ✓ Data berhasil disimpan`);
      console.log(
        `[${this.getTime()}] File: ${path.resolve(this.outputFile)}`
      );
      console.log(`[${this.getTime()}] Baris: ${this.monsterData.length}`);
      return true;
    } catch (error) {
      console.error(
        `[${this.getTime()}] ✗ Error menyimpan file: ${error.message}`
      );
      return false;
    }
  }

  printStatistics() {
    if (this.monsterData.length === 0) {
      console.log('Tidak ada data untuk ditampilkan');
      return;
    }

    console.log('\n' + '='.repeat(90));
    console.log('STATISTIK DATA MONSTER');
    console.log('='.repeat(90));
    console.log(`Total baris data: ${this.monsterData.length}`);

    const uniqueNames = {};
    this.monsterData.forEach((m) => {
      uniqueNames[m.name] = (uniqueNames[m.name] || 0) + 1;
    });

    console.log(`Total monster unik: ${Object.keys(uniqueNames).length}`);
    console.log('\nTop 15 monster:');

    Object.entries(uniqueNames)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach((entry, i) => {
        const padding = ' '.repeat(Math.max(0, 30 - entry[0].length));
        console.log(
          `  ${String(i + 1).padStart(2)}. ${entry[0]}${padding} (${entry[1]} varian)`
        );
      });

    const levels = this.monsterData
      .map((m) => parseInt(m.level))
      .filter((l) => !isNaN(l));

    if (levels.length > 0) {
      console.log('\nLevel Statistics:');
      console.log(`  Min Level    : ${Math.min(...levels)}`);
      console.log(`  Max Level    : ${Math.max(...levels)}`);
      console.log(
        `  Avg Level    : ${(
          levels.reduce((a, b) => a + b) / levels.length
        ).toFixed(1)}`
      );
    }

    console.log('\n' + '='.repeat(90) + '\n');
  }

  async run() {
    console.log('\n' + '='.repeat(90));
    console.log('MONSTER DATA SCRAPER - DIRECT MODE');
    console.log('='.repeat(90) + '\n');

    const startTime = Date.now();

    const html = await this.fetchPage();
    if (!html) return false;

    if (!this.parseHTML(html)) return false;

    if (!(await this.saveCSV())) return false;

    this.printStatistics();

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${this.getTime()}] Total waktu: ${elapsedTime} detik`);
    console.log(`[${this.getTime()}] ✓ Scraping selesai!\n`);

    return true;
  }
}

export default MonsterScraper;

if (import.meta.url === `file://${process.argv[1]}`) {
  const scraper = new MonsterScraper('monster_data.csv');
  scraper
    .run()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
