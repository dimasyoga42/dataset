import puppeteer from "puppeteer";
import fs from "fs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeCSV(text) {
  if (!text) return "";
  return `"${text.replace(/"/g, '""').replace(/\n/g, " ")}"`;
}

async function scrape() {
  const url = "https://toram-id.space/skill";
  const output = "skills.csv";

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-features=site-per-process",
    ],
  });

  let csv = "skill_tree,name,image,content\n";

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    );

    await page.setViewport({ width: 1920, height: 1080 });

    console.log("opening skill list...");

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await delay(3000);

    const links = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll("a")];
      const list = [];

      anchors.forEach((a) => {
        const href = a.href;

        if (
          href.includes("/skill/") &&
          href !== "https://toram-id.space/skill" &&
          !list.includes(href)
        ) {
          list.push(href);
        }
      });

      return list;
    });

    console.log("total skill page:", links.length);

    for (const link of links) {
      console.log("scraping:", link);

      const skillPage = await browser.newPage();

      try {
        await skillPage.setViewport({ width: 1920, height: 1080 });

        await skillPage.goto(link, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        await delay(2000);

        await skillPage.evaluate(async () => {
          await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 300;

            const timer = setInterval(() => {
              window.scrollBy(0, distance);
              totalHeight += distance;

              if (totalHeight >= document.body.scrollHeight) {
                clearInterval(timer);
                window.scrollTo(0, 0);
                resolve();
              }
            }, 100);
          });
        });

        await delay(1000);

        const data = await skillPage.evaluate(() => {
          const skills = [];

          const cards = document.querySelectorAll(".card");

          const title =
            document.querySelector("h1")?.innerText ||
            document.querySelector("h2")?.innerText ||
            "";

          cards.forEach((card) => {
            const raw =
              card.querySelector(".card-body")?.innerText ||
              card.innerText ||
              "";

            const lines = raw
              .split("\n")
              .map((v) => v.trim())
              .filter((v) => v !== "");

            if (lines.length === 0) return;

            const name = lines[0];
            const content = lines.slice(1).join(" ");

            const img = card.querySelector("img")?.src || "";

            skills.push({
              tree: title,
              name,
              image: img,
              content,
            });
          });

          return skills;
        });

        for (const skill of data) {
          csv +=
            `${escapeCSV(skill.tree)},` +
            `${escapeCSV(skill.name)},` +
            `${escapeCSV(skill.image)},` +
            `${escapeCSV(skill.content)}\n`;
        }

        await skillPage.close();
        await delay(1000);
      } catch (err) {
        console.log("skip error:", link);
        await skillPage.close();
      }
    }

    fs.writeFileSync(output, csv);

    console.log("CSV saved:", output);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

scrape();
