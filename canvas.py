import re
import json
import sys
import time
from pathlib import Path
from html.parser import HTMLParser
from datetime import datetime

import requests
from PIL import Image, ImageDraw, ImageFont

URL = "https://tanaka0.work/AIO/en/DyePredictor/ColorWeapon"
JSON_OUTPUT = "dye_data.json"
PNG_OUTPUT = "dye_table.png"

FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

ITEMS_PER_COLUMN = 30
COLUMN_WIDTH = 400
ROW_HEIGHT = 40
HEADER_HEIGHT = 55
PADDING = 16

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


class DyeTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_target_table = False
        self.in_tr = False
        self.in_td = False
        self.td_index = 0
        self.current_boss = ""
        self.current_hex = ""
        self.current_dye = ""
        self.results = []
        self._td_text_parts = []
        self.month_label = ""
        self._in_month_th = False
        self._th_parts = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "table" and "color-wep-table" in attrs_dict.get("class", ""):
            self.in_target_table = True
            self.td_index = 0
        if not self.in_target_table:
            return
        if tag == "th":
            self._in_month_th = True
            self._th_parts = []
        if tag == "tr":
            self.in_tr = True
            self.td_index = 0
            self.current_boss = ""
            self.current_hex = ""
            self.current_dye = ""
        if tag == "td" and self.in_tr:
            self.in_td = True
            self._td_text_parts = []
        if tag == "font" and self.in_td:
            style = attrs_dict.get("style", "")
            match = re.search(r"color:\s*(#[0-9a-fA-F]{3,6})", style)
            if match:
                self.current_hex = match.group(1)

    def handle_endtag(self, tag):
        if tag == "th" and self._in_month_th:
            raw = " ".join(self._th_parts).strip()
            match = re.search(r"(\d{6})", raw)
            if match and not self.month_label:
                self.month_label = match.group(1)
            self._in_month_th = False
        if not self.in_target_table:
            return
        if tag == "table":
            self.in_target_table = False
        if tag == "td" and self.in_td:
            raw = " ".join(self._td_text_parts).strip()
            raw = re.sub(r"\s+", " ", raw)
            if self.td_index == 0:
                self.current_boss = raw
            elif self.td_index == 1:
                dye_match = re.search(r"([A-Z]\d+|Hidden|Unknown)", raw)
                self.current_dye = dye_match.group(1) if dye_match else raw.strip()
            self.td_index += 1
            self.in_td = False
            self._td_text_parts = []
        if tag == "tr" and self.in_tr and self.current_boss and self.current_dye:
            boss_clean = re.sub(r"\s*\(Lv\.\s*\d+\s*\)", "", self.current_boss).strip()
            if boss_clean and boss_clean not in ("Boss Name", ""):
                self.results.append({
                    "boss": boss_clean,
                    "dye": self.current_dye,
                    "hex": self.current_hex if self.current_hex else "#cccccc",
                })
            self.in_tr = False

    def handle_data(self, data):
        if self._in_month_th:
            stripped = data.strip()
            if stripped:
                self._th_parts.append(stripped)
        if self.in_td:
            stripped = data.strip()
            if stripped:
                self._td_text_parts.append(stripped)


def fetch_html(url: str, retries: int = 3) -> str:
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(url, headers=HEADERS, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            print(f"Attempt {attempt} failed: {e}", file=sys.stderr)
            if attempt < retries:
                time.sleep(5 * attempt)
    print(f"Error: failed to fetch {url} after {retries} attempts", file=sys.stderr)
    sys.exit(1)


def parse_html(content: str) -> tuple[list[dict], str]:
    parser = DyeTableParser()
    parser.feed(content)
    seen = set()
    unique = []
    for item in parser.results:
        key = item["boss"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(item)
    month_label = parser.month_label or datetime.now().strftime("%Y%m")
    return unique, month_label


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    try:
        r = int(hex_color[0:2], 16)
        g = int(hex_color[2:4], 16)
        b = int(hex_color[4:6], 16)
    except (ValueError, IndexError):
        return (200, 200, 200)
    return (r, g, b)


def brightness(rgb: tuple[int, int, int]) -> float:
    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000


def draw_table(data: list[dict], month_label: str, output_path: str) -> None:
    columns = max(1, -(-len(data) // ITEMS_PER_COLUMN))
    width = columns * COLUMN_WIDTH + PADDING * 2
    height = HEADER_HEIGHT + ITEMS_PER_COLUMN * ROW_HEIGHT + PADDING * 2

    img = Image.new("RGB", (width, height), color=(242, 242, 242))
    draw = ImageDraw.Draw(img)

    try:
        font_regular = ImageFont.truetype(FONT_REGULAR, 17)
        font_bold = ImageFont.truetype(FONT_BOLD, 18)
    except IOError:
        font_regular = ImageFont.load_default()
        font_bold = font_regular

    for col in range(columns):
        start_x = PADDING + col * COLUMN_WIDTH

        if col > 0:
            sep_x = start_x - PADDING
            draw.line([(sep_x, 0), (sep_x, height)], fill=(200, 200, 200), width=1)

        draw.text(
            (start_x, HEADER_HEIGHT // 2 - 9),
            f"Boss Name ({month_label})",
            fill=(51, 51, 51),
            font=font_bold,
        )
        draw.text(
            (start_x + COLUMN_WIDTH - 90, HEADER_HEIGHT // 2 - 9),
            "Color",
            fill=(51, 51, 51),
            font=font_bold,
        )

        sep_y = HEADER_HEIGHT - 4
        draw.line(
            [(start_x, sep_y), (start_x + COLUMN_WIDTH - PADDING, sep_y)],
            fill=(180, 180, 180),
            width=1,
        )

        rows = data[col * ITEMS_PER_COLUMN : (col + 1) * ITEMS_PER_COLUMN]
        for row_idx, item in enumerate(rows):
            y_top = HEADER_HEIGHT + row_idx * ROW_HEIGHT
            y_center = y_top + ROW_HEIGHT // 2

            if row_idx % 2 == 0:
                draw.rectangle(
                    [
                        start_x - 4,
                        y_top,
                        start_x + COLUMN_WIDTH - PADDING - 4,
                        y_top + ROW_HEIGHT,
                    ],
                    fill=(235, 235, 235),
                )

            boss = item.get("boss") or "-"
            draw.text(
                (start_x, y_center - 8),
                boss,
                fill=(51, 51, 51),
                font=font_regular,
            )

            box_w = 72
            box_h = 30
            box_x = start_x + COLUMN_WIDTH - box_w - PADDING * 2
            box_y = y_center - box_h // 2

            hex_color = item.get("hex") or "#cccccc"
            rgb = hex_to_rgb(hex_color)
            draw.rectangle(
                [box_x, box_y, box_x + box_w, box_y + box_h],
                fill=rgb,
                outline=(150, 150, 150),
                width=1,
            )

            dye = item.get("dye") or "-"
            text_color = (0, 0, 0) if brightness(rgb) > 140 else (255, 255, 255)
            bbox = draw.textbbox((0, 0), dye, font=font_regular)
            text_w = bbox[2] - bbox[0]
            draw.text(
                (box_x + (box_w - text_w) // 2, box_y + (box_h - 17) // 2),
                dye,
                fill=text_color,
                font=font_regular,
            )

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG")
    print(f"Image saved: {output_path}")


def main() -> None:
    print(f"Fetching {URL} ...")
    html = fetch_html(URL)

    print("Parsing HTML...")
    data, month_label = parse_html(html)
    print(f"Month: {month_label}")
    print(f"Total entries found: {len(data)}")

    if not data:
        print("Error: no data found in HTML tables", file=sys.stderr)
        sys.exit(1)

    with open(JSON_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"JSON saved: {JSON_OUTPUT}")

    draw_table(data, month_label, PNG_OUTPUT)


if __name__ == "__main__":
    main()
