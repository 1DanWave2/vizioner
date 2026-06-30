#!/usr/bin/env python3
"""
Генерирует SEO-инфраструктуру:
1. sitemap.xml — карта сайта со всеми URL
2. robots.txt — инструкции для поисковых роботов
3. В каждый HTML вставляет блок SEO-тегов: canonical, OpenGraph, Twitter Card, Schema.org

Использование:
    python3 tools/build_seo.py
"""

import json
import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = "https://artvizioner.ru"
SITE_NAME = "Визионер"
DEFAULT_OG_IMAGE = f"{SITE_URL}/assets/img/og-cover.jpg"

# Список страниц + их SEO-метаданные
PAGES = [
    {
        "path": "index.html",
        "url": "/",
        "title": "Визионер — галерея современного искусства",
        "description": "Онлайн-галерея современного российского искусства. Подбор работ под интерьер: живопись, графика, скульптура. Работаем напрямую с художниками.",
        "type": "website",
        "priority": "1.0",
    },
    {
        "path": "gallery.html",
        "url": "/gallery.html",
        "title": "Галерея — Визионер",
        "description": "Каталог 59 работ современных российских художников: пейзажи, натюрморты, абстракция. Фильтр по типу, художнику. Цены от 55 000 ₽.",
        "type": "website",
        "priority": "0.9",
    },
    {
        "path": "artists.html",
        "url": "/artists.html",
        "title": "Художники — Визионер",
        "description": "Изумрудов, Углач, Шугаев, Есенов, Вильгорт — современные российские живописцы. Член Союза художников России, музейные коллекции. Биографии и работы.",
        "type": "website",
        "priority": "0.9",
    },
    {
        "path": "service.html",
        "url": "/service.html",
        "title": "Подбор картин под интерьер — Визионер",
        "description": "Бесплатная услуга: подберём современную живопись под ваш интерьер. По фото пространства за 24–48 часов предложим 3–5 работ.",
        "type": "website",
        "priority": "0.9",
    },
    {
        "path": "about.html",
        "url": "/about.html",
        "title": "О проекте — Визионер",
        "description": "Визионер — онлайн-галерея современного российского искусства и проект по подбору арт-решений для интерьеров.",
        "type": "website",
        "priority": "0.7",
    },
    {
        "path": "contact.html",
        "url": "/contact.html",
        "title": "Контакты — Визионер",
        "description": "Связаться с галереей Визионер: Telegram, телефон, email. Шаблон сообщения для быстрого подбора.",
        "type": "website",
        "priority": "0.6",
    },
]


def build_meta_block(page: dict) -> str:
    """Создаёт блок SEO-тегов для вставки в <head>."""
    full_url = SITE_URL + page["url"]
    title = page["title"]
    desc = page["description"]
    og_type = page["type"]

    return f"""  <!-- SEO -->
  <meta name="description" content="{desc}">
  <link rel="canonical" href="{full_url}">

  <!-- OpenGraph -->
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="{SITE_NAME}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{full_url}">
  <meta property="og:image" content="{DEFAULT_OG_IMAGE}">
  <meta property="og:locale" content="ru_RU">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{DEFAULT_OG_IMAGE}">
"""


def build_schema_org_home() -> str:
    """Schema.org JSON-LD для главной — расширенная разметка организации/галереи."""
    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "ArtGallery",
                "@id": f"{SITE_URL}/#gallery",
                "name": "Визионер",
                "alternateName": "Vizioner",
                "url": SITE_URL,
                "description": "Онлайн-галерея современного российского искусства",
                "telephone": "+7 903 720 24 99",
                "email": "11proekt@mail.ru",
                "image": DEFAULT_OG_IMAGE,
                "areaServed": {"@type": "Country", "name": "Россия"},
                "sameAs": ["https://t.me/vizioner959"],
            },
            {
                "@type": "WebSite",
                "@id": f"{SITE_URL}/#website",
                "name": SITE_NAME,
                "url": SITE_URL,
                "inLanguage": "ru",
                "publisher": {"@id": f"{SITE_URL}/#gallery"},
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": f"{SITE_URL}/gallery.html?q={{search_term_string}}",
                    "query-input": "required name=search_term_string",
                },
            },
        ],
    }
    return f'  <script type="application/ld+json">\n{json.dumps(schema, ensure_ascii=False, indent=2)}\n  </script>\n'


def build_schema_org_service() -> str:
    """Schema.org для страницы услуги."""
    schema = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Подбор картин под интерьер",
        "provider": {
            "@type": "ArtGallery",
            "name": "Визионер",
            "url": SITE_URL,
        },
        "areaServed": {"@type": "Country", "name": "Россия"},
        "description": "Бесплатная услуга подбора картин современных российских художников под конкретный интерьер. По фото пространства за 24–48 часов предлагается 3–5 работ.",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "RUB"},
    }
    return f'  <script type="application/ld+json">\n{json.dumps(schema, ensure_ascii=False, indent=2)}\n  </script>\n'


def inject_seo_into_html(path: Path, page: dict) -> bool:
    """Вставляет/обновляет SEO-блок в HTML-файл."""
    content = path.read_text(encoding="utf-8")

    # Удаляем старые SEO-теги если они уже были
    content = re.sub(r"<!-- SEO -->.*?(?=<!-- OpenGraph -->|<link rel=\"stylesheet\")", "", content, flags=re.DOTALL)
    content = re.sub(r"<!-- OpenGraph -->.*?(?=<!-- Twitter Card -->|<link rel=\"stylesheet\")", "", content, flags=re.DOTALL)
    content = re.sub(r"<!-- Twitter Card -->.*?(?=<link rel=\"stylesheet\"|<script type=\"application/ld\\+json\")", "", content, flags=re.DOTALL)
    content = re.sub(r'<script type="application/ld\+json">.*?</script>\s*', "", content, flags=re.DOTALL)
    content = re.sub(r'<link rel="canonical"[^>]*>\s*', "", content)
    content = re.sub(r'<meta name="description"[^>]*>\s*', "", content)
    content = re.sub(r'<meta (?:property|name)="(?:og:|twitter:)[^"]*"[^>]*>\s*', "", content)

    # Готовим блок
    meta_block = build_meta_block(page)
    schema_block = ""
    if page["path"] == "index.html":
        schema_block = build_schema_org_home()
    elif page["path"] == "service.html":
        schema_block = build_schema_org_service()

    insert_block = meta_block + schema_block

    # Вставляем перед <link rel="stylesheet" href="assets/css/styles.css...
    # либо перед закрытием </head>
    if 'href="assets/css/styles.css' in content:
        content = re.sub(
            r'(\s*<link rel="stylesheet" href="assets/css/styles\.css)',
            r"\n" + insert_block + r"\1",
            content,
            count=1,
        )
    else:
        content = content.replace("</head>", insert_block + "</head>")

    # Чистим лишние пустые строки
    content = re.sub(r"\n{3,}", "\n\n", content)

    path.write_text(content, encoding="utf-8")
    return True


def build_sitemap():
    """Генерирует sitemap.xml."""
    today = date.today().isoformat()
    urls = []
    for p in PAGES:
        urls.append(f"""  <url>
    <loc>{SITE_URL}{p["url"]}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{p["priority"]}</priority>
  </url>""")

    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(urls)}
</urlset>
"""
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8")
    print(f"[sitemap.xml] {len(PAGES)} URLs")


def build_robots():
    """Генерирует robots.txt."""
    robots = f"""User-agent: *
Allow: /
Disallow: /admin.html
Disallow: /tools/
Disallow: /tmp/
Disallow: /.backup/
Disallow: /print/

Sitemap: {SITE_URL}/sitemap.xml
"""
    (ROOT / "robots.txt").write_text(robots, encoding="utf-8")
    print(f"[robots.txt] записан")


def main():
    print(f"=== SEO для {SITE_URL} ===\n")

    for page in PAGES:
        path = ROOT / page["path"]
        if not path.exists():
            print(f"  [skip] нет {page['path']}")
            continue
        inject_seo_into_html(path, page)
        print(f"  [ok] {page['path']}")

    print()
    build_sitemap()
    build_robots()

    print(f"\n[готово] Меняй URL в начале скрипта если домен другой.")


if __name__ == "__main__":
    main()
