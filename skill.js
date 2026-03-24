import puppeteer from "puppeteer";
import fs from "fs";

const URL = "https://asia.pokemon-card.com/id/deck-build/";

const scrape = async () => {
  const browser = await puppeteer.launch({
  headless: "new",
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
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
  await page.goto(URL, { waitUntil: "networkidle2" });

  await page.waitForSelector("#searchResultContainer");

  // scroll container
  await page.evaluate(async () => {
    const container = document.querySelector("#searchResultContainer");

    let lastHeight = 0;

    while (true) {
      container.scrollTop = container.scrollHeight;

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const newHeight = container.scrollHeight;

      if (newHeight === lastHeight) break;
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
    .map((d) => `"${d.name}","${d.image}"`)
    .join("\n");

  fs.writeFileSync("pokemon_cards.csv", header + rows);
};

(async () => {
  const result = await scrape();

  console.log("Total:", result.length);

  saveCSV(result);

  console.log("Selesai -> pokemon_cards.csv");
})();
