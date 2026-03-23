import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MonsterScraper {
  constructor(outputFile = 'monster_data.csv') {
    this.baseUrl =
      'https://coryn.club/monster.php?name=&type=&order=id+DESC&show=88';
    this.outputFile = outputFile;
    this.monsterData = [];
    this.headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    };
  }

  getTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  async fetchPage(start = 0) {
    try {
      const url = `${this.baseUrl}&start=${start}`;
      console.log(`[${this.getTime()}] Fetch: ${url}`);

      const res = await axios.get(url, {
        headers: this.headers,
        timeout: 15000,
      });

      return res.data;
    } catch (err) {
      console.log(`[${this.getTime()}] Error: ${err.message}`);
      return null;
    }
  }

  parseHTML(html) {
    const $ = cheerio.load(html);
    const cards = $('.card-title-inverse');

    if (cards.length === 0) return [];

    const results = [];

    cards.each((i, card) => {
      const data = this.extractMonsterData($, card);
      if (data) results.push(data);
    });

    return results;
  }

  extractMonsterData($, card) {
    try {
      const $card = $(card);
      const $link = $card.find('a').first();

      if ($link.length === 0) return null;

      const name = $link.text().trim();
      const url = $link.attr('href') || '';

      let $parent = $card.parent();
      for (let i = 0; i < 3; i++) {
        if (!$parent.length) break;
        $parent = $parent.parent();
      }

      const stats = this.extractStats($, $parent);
      const extra = this.extractSpawnAndDrops($, $parent);

      return {
        name,
        level: stats.level,
        type: stats.type,
        mode: stats.mode,
        hp: stats.hp,
        element: stats.element,
        exp: stats.exp,
        tamable: stats.tamable,
        spawn: extra.spawn,
        drops: extra.drops,
        url,
      };
    } catch {
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

    const map = {
      Lv: 'level',
      Type: 'type',
      Mode: 'mode',
      HP: 'hp',
      Element: 'element',
      Exp: 'exp',
      Tamable: 'tamable',
    };

    $parent.find('div').each((_, el) => {
      const p = $(el).children('p');

      if (p.length === 2) {
        const key = p.eq(0).text().trim();
        const val = p.eq(1).text().trim();
        if (map[key]) stats[map[key]] = val;
      }
    });

    return stats;
  }

  extractSpawnAndDrops($, $parent) {
    let spawn = 'N/A';
    let drops = [];

    const textLines = $parent
      .text()
      .split('\n')
      .map((v) => v.trim())
      .filter(Boolean);

    let mode = null;

    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];

      if (line === 'Spawn at') {
        spawn = textLines[i + 1] || 'N/A';
      }

      if (line === 'Item Drops') {
        mode = 'drop';
        continue;
      }

      if (mode === 'drop') {
        if (
          line.startsWith('Lv') ||
          line.startsWith('Type') ||
          line.startsWith('Mode')
        )
          break;

        if (line.length > 0) {
          const clean = line.replace(/\[.*?\]\s*/, '');
          drops.push(clean);
        }
      }
    }

    return {
      spawn,
      drops: drops.join(' | ') || 'N/A',
    };
  }

  async scrapeAll() {
    let start = 0;
    let page = 1;

    while (true) {
      console.log(`\n[${this.getTime()}] === PAGE ${page} ===`);

      const html = await this.fetchPage(start);
      if (!html) break;

      const data = this.parseHTML(html);

      if (data.length === 0) {
        console.log(`[${this.getTime()}] Stop (no data)`);
        break;
      }

      console.log(`[${this.getTime()}] +${data.length} monster`);

      this.monsterData.push(...data);

      start += 88;
      page++;

      await new Promise((r) => setTimeout(r, 800));
    }

    console.log(`TOTAL: ${this.monsterData.length}`);
  }

  saveCSV() {
    const header = [
      'Name',
      'Level',
      'Type',
      'Mode',
      'HP',
      'Element',
      'EXP',
      'Tamable',
      'Location',
      'Drops',
      'URL',
    ];

    const rows = this.monsterData.map((m) => [
      m.name,
      m.level,
      m.type,
      m.mode,
      m.hp,
      m.element,
      m.exp,
      m.tamable,
      m.spawn,
      m.drops,
      m.url,
    ]);

    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((c) =>
            typeof c === 'string' &&
            (c.includes(',') || c.includes('"'))
              ? `"${c.replace(/"/g, '""')}"`
              : c
          )
          .join(',')
      )
      .join('\n');

    fs.writeFileSync(
      path.join(__dirname, this.outputFile),
      csv,
      'utf-8'
    );

    console.log(`Saved: ${this.outputFile}`);
  }

  async run() {
    const start = Date.now();

    await this.scrapeAll();
    this.saveCSV();

    console.log(
      `Done in ${((Date.now() - start) / 1000).toFixed(2)}s`
    );
  }
}

export default MonsterScraper;

if (import.meta.url === `file://${process.argv[1]}`) {
  new MonsterScraper().run();
}
