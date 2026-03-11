import puppeteer from "puppeteer";
import fs from "fs";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function scrape() {
  const url = "https://toram-id.space/skill";
  const output = "skills.json";

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

  const result = [];

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
        await skillPage.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        );

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
          const text = (el) => (el ? el.innerText.trim() : "");

          const title =
            text(document.querySelector("h1")) ||
            text(document.querySelector("h2"));

          const tables = [...document.querySelectorAll("table")].map(
            (table) => {
              const headers = [...table.querySelectorAll("th")].map((th) =>
                th.innerText.trim(),
              );

              const rows = [...table.querySelectorAll("tr")]
                .slice(1)
                .map((tr) =>
                  [...tr.querySelectorAll("td")].map((td) =>
                    td.innerText.trim(),
                  ),
                );

              return {
                headers,
                rows,
              };
            },
          );

          const sections = [...document.querySelectorAll(".card, .box")].map(
            (card) => {
              const name =
                text(card.querySelector(".card-header")) ||
                text(card.querySelector("h3"));

              const content =
                text(card.querySelector(".card-body")) || text(card);

              return {
                name,
                content,
              };
            },
          );

          const images = [...document.querySelectorAll("img")].map(
            (img) => img.src,
          );

          return {
            title,
            tables,
            sections,
            images,
          };
        });

        result.push({
          url: link,
          ...data,
        });

        await skillPage.close();

        await delay(1000);
      } catch (err) {
        console.log("skip error:", link);
        console.log(err.message);
        await skillPage.close();
        continue;
      }
    }

    fs.writeFileSync(output, JSON.stringify(result, null, 2));

    console.log("data saved:", output);
  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

scrape();
