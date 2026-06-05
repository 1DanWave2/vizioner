#!/usr/bin/env python3
"""
Pinterest bulk-pin exporter.

Генерирует CSV в формате, который Pinterest принимает для массовой загрузки пинов
(Pinterest Business → Bulk pin creator → CSV upload).

Использование:
    python3 tools/pinterest_export.py

Результат: tmp/pinterest_pins.csv
"""

import csv
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKS = ROOT / "data" / "works.json"
ARTISTS = ROOT / "data" / "artists.json"
OUT = ROOT / "tmp" / "pinterest_pins.csv"

# Поменяй на свой реальный публичный URL после деплоя
PUBLIC_URL = "https://vizioner.ru"

# Доски Pinterest (создай эти доски заранее в своём аккаунте)
BOARD_BY_TYPE = {
    "живопись": "Современная живопись",
    "графика": "Графика",
    "постеры": "Постеры",
    "скульптура": "Скульптура малых форм",
}


def main():
    OUT.parent.mkdir(exist_ok=True)
    works = json.loads(WORKS.read_text(encoding="utf-8"))
    artists_data = {}
    if ARTISTS.exists():
        for a in json.loads(ARTISTS.read_text(encoding="utf-8")):
            artists_data[a["name"]] = a

    rows = []
    for w in works:
        artist = artists_data.get(w.get("artist", ""), {})
        themes = ", ".join(artist.get("themes", []))
        bio = artist.get("bio_short", "")

        title = f"{w['title']} — {w.get('artist', '')}"
        description_parts = [
            f"{w['title']}, {w.get('artist', '')}.",
            f"{w.get('material', '')}, {w.get('size', '')}.",
        ]
        if w.get("description"):
            description_parts.append(w["description"])
        if bio:
            description_parts.append(bio)
        description_parts.append(
            "Современная российская живопись. Бесплатный подбор под интерьер — пишите."
        )
        description = " ".join(p for p in description_parts if p)

        # Pinterest ограничивает описание 500 символами
        if len(description) > 500:
            description = description[:497] + "..."

        link = f"{PUBLIC_URL.rstrip('/')}/gallery.html#work={w['id']}"
        image_url = f"{PUBLIC_URL.rstrip('/')}/{w['image']}"
        board = BOARD_BY_TYPE.get(w.get("type", "").lower(), "Современная живопись")

        # Хэштеги
        type_tag = w.get("type", "").replace(" ", "")
        genre_tag = w.get("genre", "").replace(" ", "")
        artist_tag = w.get("artist", "").replace(" ", "")
        hashtags = f"#{type_tag} #{genre_tag} #{artist_tag} #искусство #живопись #картинавинтерьер"

        rows.append({
            "Title": title,
            "Media URL": image_url,
            "Pinterest board": board,
            "Description": description,
            "Link": link,
            "Publish date": "",  # пусто = сразу
            "Keywords": hashtags,
        })

    with OUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "Title", "Media URL", "Pinterest board", "Description",
            "Link", "Publish date", "Keywords",
        ])
        writer.writeheader()
        writer.writerows(rows)

    print(f"[OK] {len(rows)} пинов записано в {OUT}")
    print()
    print("Что делать дальше:")
    print(f"  1. Замени PUBLIC_URL в этом скрипте на свой реальный домен (сейчас: {PUBLIC_URL})")
    print("  2. В Pinterest создай доски:", ", ".join(set(BOARD_BY_TYPE.values())))
    print("  3. Pinterest Business → Bulk pin creator → загрузи CSV")


if __name__ == "__main__":
    main()
