#!/usr/bin/env python3
"""
Генерирует PDF с QR-кодами для выставки.

Каждая этикетка: QR-код + название работы + пометка "artvizioner.ru".
При наведении посетитель попадает на страницу конкретной картины
на сайте (gallery.html#work=<slug>).

Использование:
    python3 tools/build_qr_labels.py                       # все работы Изумрудова
    python3 tools/build_qr_labels.py --artist Вильгорт     # другой художник
    python3 tools/build_qr_labels.py --ids id1,id2,id3     # конкретные работы

Результат: tmp/qr_labels_<artist>.pdf
"""

import argparse
import json
import sys
from io import BytesIO
from pathlib import Path

import qrcode
from qrcode.image.pil import PilImage
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parent.parent
WORKS = ROOT / "data" / "works.json"
OUT_DIR = ROOT / "tmp"

SITE_URL = "https://artvizioner.ru"

# --- Регистрируем русский шрифт из macOS ---
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    "/Library/Fonts/Arial.ttf",
]
FONT_BOLD_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]


def register_fonts() -> tuple[str, str]:
    """Возвращает (regular, bold) имена."""
    reg_name = "Regular"
    bold_name = "Bold"
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                pdfmetrics.registerFont(TTFont(reg_name, path))
                break
            except Exception:
                continue
    else:
        reg_name = "Helvetica"

    for path in FONT_BOLD_CANDIDATES:
        if Path(path).exists():
            try:
                pdfmetrics.registerFont(TTFont(bold_name, path))
                break
            except Exception:
                continue
    else:
        bold_name = reg_name

    return reg_name, bold_name


def qr_image(url: str, size_px: int = 400) -> ImageReader:
    """Генерит QR PNG в память, возвращает ImageReader для reportlab."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white", image_factory=PilImage)
    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return ImageReader(buf)


def wrap_text(text: str, max_chars: int) -> list[str]:
    """Простой перенос по словам."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        if not cur:
            cur = w
        elif len(cur) + 1 + len(w) <= max_chars:
            cur += " " + w
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines[:3]  # максимум 3 строки


def build_pdf(works: list[dict], out_path: Path):
    """Раскладка: 3 колонки × 3 ряда на A4 landscape (9 этикеток / страница).
    Каждая этикетка ≈ 85×90 мм — большой QR, крупное название.
    """
    reg, bold = register_fonts()

    page_w, page_h = landscape(A4)  # 297 × 210 мм
    cols, rows = 3, 3
    per_page = cols * rows

    margin_x = 10 * mm
    margin_y = 10 * mm

    cell_w = (page_w - 2 * margin_x) / cols   # ≈ 92 мм
    cell_h = (page_h - 2 * margin_y) / rows   # ≈ 63 мм

    qr_size = 45 * mm  # размер QR-кода на печати

    c = canvas.Canvas(str(out_path), pagesize=landscape(A4))
    c.setTitle("QR labels — Визионер")

    for idx, w in enumerate(works):
        page_idx = idx // per_page
        pos_in_page = idx % per_page
        row = pos_in_page // cols
        col = pos_in_page % cols

        # координаты левого-нижнего угла ячейки
        x0 = margin_x + col * cell_w
        y0 = page_h - margin_y - (row + 1) * cell_h

        # рамка ячейки (тонкая, серая) — чтоб легко резать ножницами
        c.setStrokeColorRGB(0.75, 0.75, 0.75)
        c.setLineWidth(0.3)
        c.rect(x0, y0, cell_w, cell_h)

        # === QR слева ===
        qr_x = x0 + 4 * mm
        qr_y = y0 + (cell_h - qr_size) / 2
        url = f"{SITE_URL}/gallery.html#work={w['id']}"
        c.drawImage(qr_image(url), qr_x, qr_y, qr_size, qr_size, mask="auto")

        # === Текст справа от QR ===
        text_x = qr_x + qr_size + 4 * mm
        text_w = cell_w - (qr_size + 8 * mm + 4 * mm)

        # Заголовок — «Валерий Изумрудов» мелко сверху
        c.setFont(reg, 7)
        c.setFillColorRGB(0.4, 0.4, 0.4)
        c.drawString(text_x, y0 + cell_h - 6 * mm, "Валерий Изумрудов")

        # Название — крупно (адаптивно: короткое = крупнее)
        c.setFillColorRGB(0.05, 0.05, 0.05)
        # автоподбор ширины: 16 символов при 11pt, 14 при 12pt
        title = w["title"]
        if len(title) <= 20:
            font_size, wrap_chars = 12, 16
        elif len(title) <= 34:
            font_size, wrap_chars = 11, 18
        else:
            font_size, wrap_chars = 9.5, 22
        title_lines = wrap_text(title, wrap_chars)
        line_h = (font_size + 2) * 0.35
        title_y = y0 + cell_h - 10 * mm
        for i, line in enumerate(title_lines):
            c.setFont(bold, font_size)
            c.drawString(text_x, title_y - i * line_h * mm, line)

        # Размер + материал
        c.setFont(reg, 8)
        c.setFillColorRGB(0.35, 0.35, 0.35)
        meta = []
        if w.get("size"):
            meta.append(w["size"])
        if w.get("year"):
            meta.append(str(w["year"]))
        info_y = title_y - len(title_lines) * line_h * mm - 3 * mm
        c.drawString(text_x, info_y, "  •  ".join(meta))

        # Материал
        if w.get("material"):
            c.drawString(text_x, info_y - 4 * mm, w["material"])

        # Подпись «Наведите камеру» + домен внизу
        c.setFont(reg, 7)
        c.setFillColorRGB(0.5, 0.5, 0.5)
        c.drawString(text_x, y0 + 6 * mm, "Наведите камеру на код")
        c.setFont(bold, 8)
        c.setFillColorRGB(0.1, 0.1, 0.1)
        c.drawString(text_x, y0 + 3 * mm, "artvizioner.ru")

        # Новая страница
        if (idx + 1) % per_page == 0 and idx + 1 < len(works):
            c.showPage()

    c.save()
    return out_path


def load_works(artist: str | None, ids: list[str] | None) -> list[dict]:
    all_works = json.loads(WORKS.read_text(encoding="utf-8"))
    if ids:
        selected = [w for w in all_works if w["id"] in ids]
        # сохраняем порядок как в аргументе
        selected.sort(key=lambda w: ids.index(w["id"]))
        return selected
    if artist:
        return [w for w in all_works if w.get("artist", "").lower() == artist.lower()]
    return all_works


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--artist", default="Изумрудов", help="фамилия художника (по умолчанию Изумрудов)")
    ap.add_argument("--ids", default=None, help="список id через запятую")
    ap.add_argument("--out", default=None, help="имя выходного файла")
    args = ap.parse_args()

    ids = args.ids.split(",") if args.ids else None
    works = load_works(args.artist if not ids else None, ids)

    if not works:
        print("❌ Не нашёл работ по условию")
        sys.exit(1)

    OUT_DIR.mkdir(exist_ok=True)
    out_name = args.out or f"qr_labels_{args.artist.lower()}.pdf"
    out_path = OUT_DIR / out_name

    print(f"[генерирую] {len(works)} QR-этикеток")
    for w in works[:5]:
        print(f"  · {w['title']}  →  {SITE_URL}/gallery.html#work={w['id']}")
    if len(works) > 5:
        print(f"  · ... и ещё {len(works) - 5}")

    build_pdf(works, out_path)
    print(f"\n✅ Сохранил: {out_path.relative_to(ROOT)}")
    print(f"   Работ: {len(works)}, страниц: {(len(works) + 8) // 9}")


if __name__ == "__main__":
    main()
