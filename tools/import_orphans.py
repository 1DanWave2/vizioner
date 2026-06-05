#!/usr/bin/env python3
"""
Импорт «бесхозных» фото из assets/img/works/ в data/works.json.

Делает:
1. Сканирует папку assets/img/works/
2. Находит файлы которые НЕ упомянуты в works.json
3. Переименовывает .jpg.jpg в чистый slug
4. Создаёт записи в works.json: художник, название, цена, описание
5. Размеры — дефолт (60х70 см), правишь потом через admin.html
"""

import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKS = ROOT / "data" / "works.json"
IMG_DIR = ROOT / "assets" / "img" / "works"
BACKUP = ROOT / ".backup" / "works.before-orphans.json"

# Множитель цены по художнику (как в generate_pricing.py)
ARTIST_MULTIPLIER = {
    "Изумрудов": 1.4,
    "Есенов":    1.4,
    "Углач":     1.0,
    "Шугаев":    1.0,
}

# Дефолтные размеры — для типичных небольших работ
DEFAULT_SIZE_W = 60
DEFAULT_SIZE_H = 70

# Словарь нормальных русских названий
# Ключ — slug файла (без .jpg/.jpg.jpg), значение — название
TITLE_MAP = {
    # Есенов
    "esenov-bik":            "Бык",
    "esenov-cvetivvase":     "Цветы в вазе",
    "esenov-fruktivvase":    "Фрукты в вазе",
    "esenov-grushi":         "Груши",
    "esenov-kacheli":        "Качели",
    "esenov-krasnayanoch":   "Красная ночь",
    "esenov-krasnoemore":    "Красное море",
    "esenov-kvartirnik":     "Квартирник",
    "esenov-levitaciya":     "Левитация",
    "esenov-lichnosti":      "Личности",
    "esenov-loshadka":       "Лошадка",
    "esenov-noch":           "Ночь",
    "esenov-nochnoydom":     "Ночной дом",
    "esenov-nochnoykon":     "Ночной конь",
    "esenov-ptica":          "Птица",
    "esenov-rosi":           "Росы",
    "esenov-trigrushi":      "Три груши",
    "esenov-vinograd":       "Виноград",
    "esenov-zolotayaribka":  "Золотая рыбка",
    "esenov-evening":        "Вечер",
    "esenov-quiet-field":    "Тихое поле",
    # Изумрудов добавочные
    "izumrudov-lines":       "Линии",
    "izumrudov-warm":        "Тёплое",
    # Углач добавочные
    "uglach-abstract-1":     "Абстракция I",
    "uglach-silence":        "Тишина",
}

# Жанры по работам
GENRE_MAP = {
    "esenov-bik":            "фигуратив",
    "esenov-cvetivvase":     "натюрморт",
    "esenov-fruktivvase":    "натюрморт",
    "esenov-grushi":         "натюрморт",
    "esenov-kacheli":        "фигуратив",
    "esenov-krasnayanoch":   "фигуратив",
    "esenov-krasnoemore":    "пейзаж",
    "esenov-kvartirnik":     "жанровая",
    "esenov-levitaciya":     "фигуратив",
    "esenov-lichnosti":      "портрет",
    "esenov-loshadka":       "фигуратив",
    "esenov-noch":           "фигуратив",
    "esenov-nochnoydom":     "пейзаж",
    "esenov-nochnoykon":     "фигуратив",
    "esenov-ptica":          "фигуратив",
    "esenov-rosi":           "натюрморт",
    "esenov-trigrushi":      "натюрморт",
    "esenov-vinograd":       "натюрморт",
    "esenov-zolotayaribka":  "фигуратив",
    "esenov-evening":        "пейзаж",
    "esenov-quiet-field":    "пейзаж",
    "izumrudov-lines":       "абстракция",
    "izumrudov-warm":        "абстракция",
    "uglach-abstract-1":     "абстракция",
    "uglach-silence":        "пейзаж",
}

# Индивидуальные описания
DESCRIPTIONS = {
    "esenov-bik":
        "Фигуративная работа — мощная пластика быка, контрастная палитра. "
        "Сильный визуальный акцент. Подойдёт в просторную гостиную, лофт-кабинет или прихожую с характером.",

    "esenov-cvetivvase":
        "Цветы в вазе — классический натюрморт с авторским почерком, насыщенная живая палитра. "
        "Универсальная работа в столовую, кухню или гостиную в светлом интерьере.",

    "esenov-fruktivvase":
        "Натюрморт с фруктами в вазе — тёплый колорит, объёмная композиция. "
        "Хорошо смотрится на кухне, в столовой или у обеденной зоны.",

    "esenov-grushi":
        "Натюрморт с грушами — лаконичная композиция, тёплая охристая палитра. "
        "Камерная работа для столовой, кухни или прихожей.",

    "esenov-kacheli":
        "Фигуративная работа с динамикой — качели, состояние движения и лёгкости. "
        "Подойдёт в детскую, гостевую или светлую гостиную.",

    "esenov-krasnayanoch":
        "Драматическая работа с красным колоритом — ночная сцена, эмоциональная палитра. "
        "Сильный акцент стены для гостиной, кабинета или интерьера с характером.",

    "esenov-krasnoemore":
        "Морской пейзаж в красных тонах — закатное состояние, выразительная палитра. "
        "Подойдёт в гостиную, кабинет или столовую с тёплыми интерьерами.",

    "esenov-kvartirnik":
        "Жанровая сцена — квартирник, музыкальная компания. Тёплая атмосфера домашнего собрания. "
        "В гостиную, музыкальную комнату или кабинет с богемным настроем.",

    "esenov-levitaciya":
        "Фигуративная работа с темой полёта и невесомости — поэтичный сюжет. "
        "Камерная работа в спальню, кабинет или гостевую.",

    "esenov-lichnosti":
        "Серия портретов или характеров — психологическая работа с лицами и образами. "
        "В кабинет, библиотеку или гостиную для тех кто ценит фигуративное искусство.",

    "esenov-loshadka":
        "Фигуративный сюжет с лошадью — динамика, тёплая палитра. "
        "Подойдёт в детскую, гостевую, кабинет или гостиную с природной тематикой.",

    "esenov-noch":
        "Ночной сюжет — глубокие тёмные тона, состояние тишины. "
        "Камерная работа для спальни, кабинета или зоны отдыха.",

    "esenov-nochnoydom":
        "Ночной пейзаж с домом — состояние тихой ночи, мягкий свет в окнах. "
        "Сдержанная работа для спальни, гостиной или кабинета в тёмных интерьерах.",

    "esenov-nochnoykon":
        "Фигуративный сюжет — ночь и конь, поэтичный и драматичный образ. "
        "Сильная работа для гостиной, кабинета или просторной прихожей.",

    "esenov-ptica":
        "Птица — фигуративная работа с тонкой пластикой, поэтичный образ. "
        "Камерная работа для спальни, гостевой, столовой.",

    "esenov-rosi":
        "Натюрморт с розами — живая палитра, классическая композиция с авторским характером. "
        "Тёплая работа в столовую, кухню или гостиную.",

    "esenov-trigrushi":
        "Три груши — минималистичная композиция, благородные тона. "
        "Стильная небольшая работа для кухни, столовой или прихожей.",

    "esenov-vinograd":
        "Натюрморт с виноградом — насыщенная палитра, объёмная фактура. "
        "Хорошо смотрится в столовой, на кухне или в зоне обеда.",

    "esenov-zolotayaribka":
        "Образ золотой рыбки — поэтичный сказочный сюжет, тёплый колорит. "
        "Работа с лёгким настроением для детской, столовой или гостевой.",

    "esenov-evening":
        "Вечерний пейзаж — мягкий свет уходящего дня, спокойная палитра. "
        "Камерная работа в спальню, гостиную или столовую.",

    "esenov-quiet-field":
        "Тихое поле — пейзаж покоя и пространства, сдержанная палитра. "
        "Универсальная работа в спальню, гостиную, кабинет.",

    "izumrudov-lines":
        "Абстрактная композиция — ритм линий и плоскостей. "
        "Подойдёт в современный интерьер: гостиную, кабинет, лофт-пространство.",

    "izumrudov-warm":
        "Абстрактная работа в тёплой палитре — состояние и фактура важнее сюжета. "
        "Универсальная работа в современный интерьер, в гостиную или кабинет.",

    "uglach-abstract-1":
        "Абстрактная композиция — фактурная живопись, ритм цветовых пятен. "
        "Современная работа в гостиную, кабинет или лофт-пространство.",

    "uglach-silence":
        "Тишина — пейзажный мотив с минимальным сюжетом, состояние покоя. "
        "Камерная работа в спальню, кабинет, гостиную.",
}


def base_price_for_area(area_cm2: int) -> int:
    if area_cm2 < 3000:    return 45_000
    if area_cm2 < 4500:    return 55_000
    if area_cm2 < 6000:    return 70_000
    if area_cm2 < 9000:    return 95_000
    if area_cm2 < 13000:   return 140_000
    if area_cm2 < 17000:   return 200_000
    return 280_000


def round_to_5k(price: int) -> int:
    return int(round(price / 5000)) * 5000


def calc_price(area: int, artist: str) -> tuple[int, str]:
    mult = ARTIST_MULTIPLIER.get(artist, 1.0)
    final = round_to_5k(int(base_price_for_area(area) * mult))
    return final, f"от {final:,} ₽".replace(",", " ")


def clean_slug(name: str) -> str:
    """esenov-Bik.jpg.jpg -> esenov-bik"""
    n = name.lower()
    n = n.replace(".jpg.jpg", "").replace(".jpg", "").replace(".jpeg", "").replace(".png", "")
    return n


def main():
    if not WORKS.exists():
        print(f"Нет {WORKS}")
        sys.exit(1)

    BACKUP.parent.mkdir(exist_ok=True)
    works = json.loads(WORKS.read_text(encoding="utf-8"))
    BACKUP.write_text(json.dumps(works, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[backup] {BACKUP}")

    used_basenames = {os.path.basename(w["image"]) for w in works}
    used_ids = {w["id"] for w in works}

    on_disk = sorted(f for f in os.listdir(IMG_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png")))
    orphans = [f for f in on_disk if f not in used_basenames]

    # Дубликат evening: используем большой .jpg.jpg, .jpg игнорим
    if "esenov-evening.jpg.jpg" in orphans and "esenov-evening.jpg" in orphans:
        # удаляем маленький из обработки (но не с диска — он останется)
        orphans = [f for f in orphans if f != "esenov-evening.jpg"]
        print(f"  [note] esenov-evening.jpg (28kb превью) пропущен в пользу .jpg.jpg (377kb)")

    print(f"\n[scan] нашёл {len(orphans)} бесхозных файлов")

    added = []
    next_sort = max((w.get("sort", 0) for w in works), default=0) + 1

    for fname in orphans:
        slug = clean_slug(fname)

        # уникальный id
        work_id = slug
        n = 2
        while work_id in used_ids:
            work_id = f"{slug}-{n}"
            n += 1
        used_ids.add(work_id)

        # определяем художника по префиксу
        if slug.startswith("esenov-"):
            artist = "Есенов"
        elif slug.startswith("izumrudov-"):
            artist = "Изумрудов"
        elif slug.startswith("uglach-"):
            artist = "Углач"
        elif slug.startswith("shugaev-"):
            artist = "Шугаев"
        else:
            artist = "—"

        title = TITLE_MAP.get(slug, slug.split("-", 1)[-1].replace("-", " ").capitalize())
        genre = GENRE_MAP.get(slug, "")
        description = DESCRIPTIONS.get(slug, f"Работа «{title}» художника {artist}. Подробное описание уточняется.")

        new_basename = f"{work_id}.jpg"
        new_image = f"assets/img/works/{new_basename}"

        # переименование файла на диске
        old_path = IMG_DIR / fname
        new_path = IMG_DIR / new_basename
        if old_path != new_path:
            if new_path.exists():
                print(f"  [skip] {new_path.name} уже существует")
            else:
                old_path.rename(new_path)
                print(f"  [rename] {fname} -> {new_basename}")

        area = DEFAULT_SIZE_W * DEFAULT_SIZE_H
        price, price_label = calc_price(area, artist)

        new_work = {
            "id": work_id,
            "title": title,
            "artist": artist,
            "year": None,
            "type": "живопись",
            "genre": genre,
            "material": "Холст масло",
            "technique": "Масляные краски",
            "size": f"{DEFAULT_SIZE_W}×{DEFAULT_SIZE_H} см",
            "size_w": DEFAULT_SIZE_W,
            "size_h": DEFAULT_SIZE_H,
            "price": price,
            "price_label": price_label,
            "description": description,
            "image": new_image,
            "featured": False,
            "sort": next_sort,
        }
        works.append(new_work)
        added.append(new_work)
        next_sort += 1

    WORKS.write_text(
        json.dumps(works, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"\n[save] {WORKS}: всего {len(works)} работ ({len(added)} новых)")
    print("\n=== Добавлены ===")
    print(f"{'ID':<28} {'Художник':<12} {'Название':<25} {'Цена'}")
    print("-" * 90)
    for w in added:
        print(f"{w['id']:<28} {w['artist']:<12} {w['title']:<25} {w['price_label']}")

    print("\n⚠ Размеры у новых работ = 60×70 (дефолт). Поправь реальные через admin.html.")


if __name__ == "__main__":
    main()
