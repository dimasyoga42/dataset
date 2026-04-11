import puppeteer from "puppeteer";
import { writeFileSync } from "fs";

const BASE_URL = "https://irunawiki.com";
const MONSTER_LIST_URL = `${BASE_URL}/monsters`;

// ─── SCROLL FIX (lebih akurat) ─────────────────────────────
async function scrollToBottom(page) {
  console.log("[*] Scrolling...");

  let prevCount = 0;

  for (let i = 0; i < 30; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 1500));

    const count = await page.evaluate(
      () => document.querySelectorAll("a[href*='/monster/']").length
    );

    console.log(`  Scroll ${i + 1} | items: ${count}`);

    if (count === prevCount) break;
    prevCount = count;
  }

  console.log("[*] Scroll done");
}

// ─── GET LINKS ─────────────────────────────────────────────
async function getMonsterLinks(page) {
  await page.goto(MONSTER_LIST_URL, { waitUntil: "networkidle2" });

  await page.waitForSelector("a[href*='/monster/']");
  await scrollToBottom(page);

  const monsters = await page.evaluate((baseUrl) => {
    const seen = new Set();
    const results = [];

    document.querySelectorAll("a[href*='/monster/']").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || seen.has(href)) return;

      seen.add(href);

      results.push({
        url: baseUrl + href,
      });
    });

    return results;
  }, BASE_URL);

  console.log(`[*] Total: ${monsters.length}`);
  return monsters;
}

// ─── PARSE ────────────────────────────────────────────────
async function parseMonster(page, url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

  await page.waitForSelector(".stat-box", { timeout: 10000 });

  return await page.evaluate((url) => {
    const titleMatch = document.title.match(/Iruna (.+?)【.+?,\s*(.+?)】/);

    const stats = {};
    document.querySelectorAll(".stat-box").forEach((box) => {
      const t = box.querySelector(".stat-title");
      const v = box.querySelector(".stat-value");
      if (t && v) stats[t.innerText.trim()] = v.innerText.trim();
    });

    const drops = [...document.querySelectorAll(".drop-container")]
      .map((d) => d.innerText.trim())
      .filter(Boolean);

    return {
      Name: titleMatch?.[1] || "",
      Location: titleMatch?.[2] || "",
      URL: url,
      Lv: stats["Lv"] || "",
      MaxHP: stats["MaxHP"] || "",
      EXP: stats["EXP"] || "",
      ATK: stats["ATK"] || "",
      MATK: stats["MATK"] || "",
      DEF: stats["DEF"] || "",
      MDEF: stats["MDEF"] || "",
      STR: stats["STR"] || "",
      AGI: stats["AGI"] || "",
      VIT: stats["VIT"] || "",
      INT: stats["INT"] || "",
      DEX: stats["DEX"] || "",
      Drops: drops.join(" | "),
    };
  }, url);
}

// ─── RETRY WRAPPER ─────────────────────────────────────────
async function safeParse(page, url, retry = 2) {
  try {
    return await parseMonster(page, url);
  } catch (err) {
    if (retry <= 0) {
      console.log("  [X] Skip:", url);
      return null;
    }
    console.log("  [!] Retry:", url);
    return safeParse(page, url, retry - 1);
  }
}

// ─── CSV ───────────────────────────────────────────────────
function saveToCsv(data) {
  const headers = Object.keys(data[0]);

  const csv = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  writeFileSync("monsters.csv", csv);
  console.log("Saved monsters.csv");
}

// ─── MAIN ──────────────────────────────────────────────────
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox"],
});

const page = await browser.newPage();

const links = await getMonsterLinks(page);

const results = [];

// 🔥 concurrency (3 tab)
const CONCURRENCY = 3;

for (let i = 0; i < links.length; i += CONCURRENCY) {
  const chunk = links.slice(i, i + CONCURRENCY);

  const pages = await Promise.all(
    chunk.map(() => browser.newPage())
  );

  const data = await Promise.all(
    pages.map((p, idx) => safeParse(p, chunk[idx].url))
  );

  data.forEach((d) => d && results.push(d));

  await Promise.all(pages.map((p) => p.close()));

  console.log(`[*] Progress: ${results.length}/${links.length}`);
}

await browser.close();

saveToCsv(results);
