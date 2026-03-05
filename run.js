import puppeteer from "puppeteer";
import fs from "fs";

const url = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon";
const output = "colorweapon_full.png";

const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;

        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
};

const run = async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  console.log("opening page...");

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  await page.waitForSelector("table");

  console.log("scrolling page...");

  await autoScroll(page);

  await new Promise((r) => setTimeout(r, 2000));

  console.log("taking screenshot...");

  await page.screenshot({
    path: output,
    fullPage: true,
  });

  await browser.close();

  console.log("done:", output);
};

run();
