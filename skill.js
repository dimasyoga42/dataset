import puppeteer from "puppeteer";
import fs from "fs";

const URL = "https://asia.pokemon-card.com/id/deck-build/";

const scrape = async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    protocolTimeout: 0,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process"
    ],
  });

  const page = await browser.newPage();

  // disable timeout bawaan
  page.setDefaultNavigationTimeout(0);
  page.setDefaultTimeout(0);

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  );

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 0 });

  await page.waitForSelector("#searchResultContainer");

  // 🔥 scroll container (fix infinite loop)
  await page.evaluate(async () => {
    const container = document.querySelector("#searchResultContainer");

    let lastHeight = 0;
    let retry = 0;
    let maxLoop = 90;

    while (maxLoop-- > 0) {
      container.scrollTop = container.scrollHeight;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const newHeight = container.scrollHeight;

      if (newHeight === lastHeight) {
        retry++;
        if (retry >= 3) break;
      } else {
        retry = 0;
      }

      lastHeight = newHeight;
    }
  });

  console.log("Scroll selesai");

  const data = await page.evaluate(() => {
    const cards = document.querySelectorAll(".deckCard");

    return Array.from(cards).map((card) => {
      const name = card.getAttribute("data-card-name") || "";

      const img = card.querySelector("img");
      const image =
        img?.getAttribute("data-original") ||
        img?.getAttribute("src") ||
        "";

      return { name, image };
    });
  });

  await browser.close();

  return data;
};

const saveCSV = (data) => {
  const header = "name,image\n";

  const rows = data
    .map(
      (d) =>
        `"${(d.name || "").replace(/"/g, '""')}","${d.image || ""}"`
    )
    .join("\n");

  fs.writeFileSync("pokemon_cards.csv", header + rows);
};

(async () => {
  try {
    const result = await scrape();

    console.log("Total:", result.length);

    saveCSV(result);

    console.log("Selesai -> pokemon_cards.csv");
  } catch (err) {
    console.error("ERROR:", err.message);
  }
})();
