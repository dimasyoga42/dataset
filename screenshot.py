import time

from playwright.sync_api import sync_playwright

url = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon"


def auto_scroll(page):
    previous_height = 0
    while True:
        height = page.evaluate("document.body.scrollHeight")
        if height == previous_height:
            break
        previous_height = height
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(1)


with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"]
    )

    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    page.goto(url, wait_until="domcontentloaded", timeout=120000)

    time.sleep(5)

    auto_scroll(page)

    page.screenshot(path="colorweapon_full.png", full_page=True)

    browser.close()
