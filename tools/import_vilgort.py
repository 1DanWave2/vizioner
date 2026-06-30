#!/usr/bin/env python3
"""
Импорт нового художника Олега Петровича Вильгорта и 10 его работ.

Что делает:
1. Копирует 10 файлов из ~/Downloads в assets/img/works/ с правильными slug-именами
2. Добавляет Вильгорта в data/artists.json
3. Добавляет 10 работ в data/works.json с ценами и описаниями
"""

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOWNLOADS = Path.home() / "Downloads"
IMG_DIR = ROOT / "assets" / "img" / "works"
WORKS_JSON = ROOT / "data" / "works.json"
ARTISTS_JSON = ROOT / "data" / "artists.json"
BACKUP_DIR = ROOT / ".backup"

# Множитель цены для Вильгорта (выше Изумрудова из-за музейности)
ARTIST_MULTIPLIER = 1.5

# Файлы Downloads → каталожные данные в порядке отправки
# Имена файлов телеграма (по времени отправки)
WORKS = [
    {
        "src": "photo_2026-06-30 12.51.35.jpeg",
        "slug": "vilgort-buket-v-tumane",
        "title": "Букет в тумане",
        "year": 2025,
        "size_w": 90, "size_h": 80, "size": "90×80 см",
        "genre": "натюрморт",
        "description": "Камерный натюрморт с белыми ромашками и полевыми цветами в керамическом кувшине. Приглушённая палитра, рассеянный свет. Подойдёт в спальню, столовую или светлую гостиную в классическом интерьере.",
    },
    {
        "src": "photo_2026-06-30 12.51.42.jpeg",
        "slug": "vilgort-cveti-v-sadu",
        "title": "Цветы в саду",
        "year": None,
        "size_w": 80, "size_h": 80, "size": "80×80 см",
        "genre": "натюрморт",
        "description": "Пышный букет полевых и садовых цветов в керамической вазе на каменных ступенях. Сочная зелень и насыщенные акценты. Хорошо смотрится в гостиную, прихожую или столовую дома за городом.",
    },
    {
        "src": "photo_2026-06-30 12.51.47.jpeg",
        "slug": "vilgort-dachnye-bukety",
        "title": "Дачные букеты",
        "year": None,
        "size_w": 80, "size_h": 80, "size": "80×80 см",
        "genre": "натюрморт",
        "description": "Большой летний букет в фаянсовом кувшине на фоне окна с занавесками. Многоцветие полевых трав и садовых соцветий. Универсальная работа в гостиную или столовую с классическим декором.",
    },
    {
        "src": "photo_2026-06-30 12.51.53.jpeg",
        "slug": "vilgort-letniy-buket",
        "title": "Летний букет",
        "year": 2025,
        "size_w": 80, "size_h": 80, "size": "80×80 см",
        "genre": "натюрморт",
        "description": "Букет луговых цветов в синей расписной вазе на фоне летнего пейзажа. Открытое пространство, тёплый свет. Подойдёт в гостиную или столовую с морской или загородной темой интерьера.",
    },
    {
        "src": "photo_2026-06-30 12.51.59.jpeg",
        "slug": "vilgort-cveti-i-more",
        "title": "Цветы и море",
        "year": 2025,
        "size_w": 80, "size_h": 80, "size": "80×80 см",
        "genre": "натюрморт",
        "description": "Букет полевых цветов в гжельской вазе на фоне горного побережья. Бирюзовое море и насыщенная зелень склона. В гостиную, спальню или кабинет со светлыми стенами.",
    },
    {
        "src": "photo_2026-06-30 12.54.45.jpeg",
        "slug": "vilgort-cveti-na-krylce",
        "title": "Цветы на крыльце",
        "year": 2025,
        "size_w": 80, "size_h": 80, "size": "80×80 см",
        "genre": "натюрморт",
        "description": "Букет в кувшине на каменной ступени у окна загородного дома. Розы, ромашки, полевые травы, мягкий вечерний свет. Сильная работа для гостиной, столовой или прихожей в доме.",
    },
    {
        "src": "photo_2026-06-30 12.54.50.jpeg",
        "slug": "vilgort-veneciya",
        "title": "Венеция",
        "year": 2026,
        "size_w": 80, "size_h": 80, "size": "80×80 см",
        "genre": "натюрморт",
        "description": "Букет луговых цветов в кувшине у окна с видом на Гранд-канал и Базилику Санта-Мария-делла-Салюте. Атмосферное сочетание классического сюжета и живописного букета. Выразительная работа в гостиную, кабинет или столовую.",
    },
    {
        "src": "photo_2026-06-30 12.54.56.jpeg",
        "slug": "vilgort-osen",
        "title": "Осень",
        "year": 2026,
        "size_w": 80, "size_h": 80, "size": "80×80 см",
        "genre": "натюрморт",
        "description": "Осенний букет в керамической вазе на каменной ступени, тёплая охристая палитра. Состояние позднего сентября. Подойдёт в гостиную, кабинет или столовую с тёмным деревом и тёплыми интерьерами.",
    },
    {
        "src": "photo_2026-06-30 12.55.01.jpeg",
        "slug": "vilgort-leto",
        "title": "Лето",
        "year": 2026,
        "size_w": 40, "size_h": 80, "size": "40×80 см",
        "genre": "пейзаж",
        "description": "Горизонтальный пейзаж с рекой и цветущим лугом в утреннем тумане. Лиричная палитра, мягкий свет. Подойдёт как акцент над диваном, кроватью или комодом в горизонтальной композиции.",
    },
    {
        "src": "photo_2026-06-30 12.55.06.jpeg",
        "slug": "vilgort-bez-nazvaniya",
        "title": "Без названия",
        "year": 2026,
        "size_w": 40, "size_h": 80, "size": "40×80 см",
        "genre": "пейзаж",
        "description": "Горизонтальный пейзаж с рекой среди цветущего луга, мягкие закатные тона. Покой и пространство. Хорошо смотрится в спальню, гостиную или кабинет над низкой мебелью.",
    },
]


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


def calc_price(w: int, h: int) -> tuple[int, str]:
    base = base_price_for_area(w * h)
    final = round_to_5k(int(base * ARTIST_MULTIPLIER))
    return final, f"от {final:,} ₽".replace(",", " ")


def main():
    BACKUP_DIR.mkdir(exist_ok=True)

    # Бэкап
    works = json.loads(WORKS_JSON.read_text(encoding="utf-8"))
    artists = json.loads(ARTISTS_JSON.read_text(encoding="utf-8"))
    (BACKUP_DIR / "works.before-vilgort.json").write_text(
        json.dumps(works, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (BACKUP_DIR / "artists.before-vilgort.json").write_text(
        json.dumps(artists, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[backup] .backup/works.before-vilgort.json")
    print(f"[backup] .backup/artists.before-vilgort.json")

    # 1. Добавляем художника
    if not any(a["slug"] == "vilgort" for a in artists):
        artists.append({
            "slug": "vilgort",
            "name": "Вильгорт",
            "tagline": "Натюрморты и пейзажи академической школы",
            "bio_short": "Олег Петрович Вильгорт. Член Союза художников России. Работы в Ярославском музее-заповеднике, Музее города Москвы, Чувашском государственном художественном музее.",
            "bio_full": "Олег Петрович Вильгорт окончил Московскую государственную художественно-промышленную академию имени С. Г. Строганова. Член Союза художников России. Работы хранятся в собраниях Ярославского музея-заповедника, Музея города Москвы и Чувашского государственного художественного музея. Главные мотивы — пышные натюрморты с букетами, городские и природные пейзажи, выполненные в традициях русской академической школы маслом по холсту.",
            "techniques": ["Масло, холст"],
            "themes": ["Натюрморт", "Пейзаж", "Цветы"],
        })
        print(f"[artist] добавлен: Вильгорт")
    else:
        print(f"[artist] уже есть, не добавляю")

    ARTISTS_JSON.write_text(
        json.dumps(artists, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # 2. Копируем картинки + добавляем работы
    next_sort = max((w.get("sort", 0) for w in works), default=0) + 1
    added = []

    for spec in WORKS:
        src = DOWNLOADS / spec["src"]
        dst_name = f"{spec['slug']}.jpg"
        dst = IMG_DIR / dst_name

        if not src.exists():
            print(f"  [SKIP] нет {src.name}")
            continue

        if dst.exists():
            print(f"  [skip] {dst_name} уже есть в каталоге")
            continue

        shutil.copy2(src, dst)

        price, price_label = calc_price(spec["size_w"], spec["size_h"])

        new_work = {
            "id": spec["slug"],
            "title": spec["title"],
            "artist": "Вильгорт",
            "year": spec["year"],
            "type": "живопись",
            "genre": spec["genre"],
            "material": "Холст, масло",
            "technique": "Масло",
            "size": spec["size"],
            "size_w": spec["size_w"],
            "size_h": spec["size_h"],
            "price": price,
            "price_label": price_label,
            "description": spec["description"],
            "image": f"assets/img/works/{dst_name}",
            "featured": False,
            "sort": next_sort,
        }
        works.append(new_work)
        added.append(new_work)
        next_sort += 1
        print(f"  [add] {dst_name}  {spec['title']:<22} {price_label}")

    # Поднимем 3 лучших Вильгорта во featured (Цветы и море, Венеция, Цветы на крыльце)
    featured_slugs = {"vilgort-cveti-i-more", "vilgort-veneciya", "vilgort-cveti-na-krylce"}
    for w in works:
        if w["id"] in featured_slugs:
            w["featured"] = True

    WORKS_JSON.write_text(
        json.dumps(works, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"\n[save] {WORKS_JSON.relative_to(ROOT)}: всего {len(works)} работ ({len(added)} новых)")
    print(f"[save] {ARTISTS_JSON.relative_to(ROOT)}: всего {len(artists)} художников")
    print(f"\n⚠ 3 работы Вильгорта помечены featured — будут на главной")


if __name__ == "__main__":
    main()
