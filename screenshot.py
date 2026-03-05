import time

from playwright.sync_api import sync_playwright

url = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    )

    context = browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    )

    page = context.new_page()

    page.goto(url, wait_until="domcontentloaded", timeout=120000)

    time.sleep(8)

    page.screenshot(path="colorweapon_full.png", full_page=True)

    browser.close()
