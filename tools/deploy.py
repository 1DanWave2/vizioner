#!/usr/bin/env python3
"""
Деплой сайта на хостинг через FTP/SFTP.

Использование:
    1. Создай файл .env.deploy в корне (он в .gitignore):

       FTP_HOST=ftp.artvizioner.ru
       FTP_PORT=21
       FTP_USER=username
       FTP_PASS=password
       FTP_REMOTE_PATH=/var/www/USERNAME/data/www/artvizioner.ru/
       FTP_PROTOCOL=ftp           # ftp или sftp

    2. python3 tools/deploy.py

Что делает:
- Сканирует папку проекта
- Игнорирует служебные файлы (.git, tools, tmp, .backup, .md и т.д.)
- Загружает изменённые файлы на хостинг
- Сохраняет хеши залитых файлов в .deploy-cache (чтобы в следующий раз заливать только изменения)

Поддерживает:
- FTP (через ftplib)
- SFTP (через paramiko, требует pip install paramiko)
"""

import hashlib
import json
import os
import sys
from ftplib import FTP, FTP_TLS, error_perm
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env.deploy"
CACHE_FILE = ROOT / ".deploy-cache.json"

# Что НЕ загружаем на хостинг
SKIP_PATTERNS = {
    ".git", ".github", ".vscode", ".idea",
    ".backup", "tmp", "tools", "print", "cases",
    "__pycache__", ".venv", "node_modules",
    ".DS_Store", ".env.deploy", ".deploy-cache.json",
    "CONTEXT.md", "AGENTS.md", "TODO.md", "TEMPLATES.md",
    "DEPLOY.md", "README.md",
    ".cursor", ".claude",
}


def load_env():
    if not ENV_FILE.exists():
        print(f"❌ Создай {ENV_FILE} с FTP-данными (см. шапку скрипта)")
        sys.exit(1)
    env = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def should_skip(path: Path) -> bool:
    parts = path.relative_to(ROOT).parts
    for part in parts:
        if part in SKIP_PATTERNS:
            return True
        if part.startswith("."):
            # пропускаем все .скрытые кроме .htaccess
            if part != ".htaccess":
                return True
    return False


def collect_files() -> list[Path]:
    files = []
    for path in ROOT.rglob("*"):
        if path.is_file() and not should_skip(path):
            files.append(path)
    return files


def hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def save_cache(cache: dict):
    CACHE_FILE.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def upload_ftp(env, files_to_upload, all_hashes):
    use_tls = env.get("FTP_TLS", "").lower() in ("1", "true", "yes")
    Cls = FTP_TLS if use_tls else FTP

    print(f"\n→ Подключаюсь {'FTPS' if use_tls else 'FTP'} к {env['FTP_HOST']}:{env.get('FTP_PORT', 21)}")
    ftp = Cls()
    ftp.connect(env["FTP_HOST"], int(env.get("FTP_PORT", 21)), timeout=30)
    ftp.login(env["FTP_USER"], env["FTP_PASS"])
    if use_tls:
        ftp.prot_p()

    remote_root = env.get("FTP_REMOTE_PATH", "/").rstrip("/") + "/"
    print(f"  Корневая папка: {remote_root}")

    def ensure_remote_dir(remote_dir: str):
        """Создаёт удалённую папку если её нет."""
        parts = remote_dir.strip("/").split("/")
        current = ""
        for part in parts:
            if not part:
                continue
            current = (current + "/" + part).lstrip("/")
            try:
                ftp.cwd("/" + current)
            except error_perm:
                try:
                    ftp.mkd("/" + current)
                except error_perm:
                    pass

    uploaded = 0
    for path in files_to_upload:
        rel = path.relative_to(ROOT).as_posix()
        remote_path = remote_root + rel
        remote_dir = "/".join(remote_path.split("/")[:-1])
        try:
            ensure_remote_dir(remote_dir)
            with path.open("rb") as f:
                ftp.storbinary(f"STOR {remote_path}", f)
            print(f"  ✓ {rel}")
            uploaded += 1
        except Exception as e:
            print(f"  ✗ {rel}: {e}")

    ftp.quit()
    return uploaded


def upload_sftp(env, files_to_upload, all_hashes):
    try:
        import paramiko
    except ImportError:
        print("❌ Для SFTP нужен paramiko: pip install paramiko")
        sys.exit(1)

    print(f"\n→ Подключаюсь SFTP к {env['FTP_HOST']}:{env.get('FTP_PORT', 22)}")
    transport = paramiko.Transport((env["FTP_HOST"], int(env.get("FTP_PORT", 22))))
    transport.connect(username=env["FTP_USER"], password=env["FTP_PASS"])
    sftp = paramiko.SFTPClient.from_transport(transport)

    remote_root = env.get("FTP_REMOTE_PATH", "/").rstrip("/") + "/"
    print(f"  Корневая папка: {remote_root}")

    def ensure_remote_dir(remote_dir: str):
        parts = remote_dir.strip("/").split("/")
        current = ""
        for part in parts:
            if not part:
                continue
            current = (current + "/" + part).lstrip("/")
            try:
                sftp.stat("/" + current)
            except IOError:
                try:
                    sftp.mkdir("/" + current)
                except Exception:
                    pass

    uploaded = 0
    for path in files_to_upload:
        rel = path.relative_to(ROOT).as_posix()
        remote_path = remote_root + rel
        remote_dir = "/".join(remote_path.split("/")[:-1])
        try:
            ensure_remote_dir(remote_dir)
            sftp.put(str(path), remote_path)
            print(f"  ✓ {rel}")
            uploaded += 1
        except Exception as e:
            print(f"  ✗ {rel}: {e}")

    sftp.close()
    transport.close()
    return uploaded


def main():
    env = load_env()
    proto = env.get("FTP_PROTOCOL", "ftp").lower()

    print(f"=== Deploy → {env.get('FTP_HOST')} ({proto.upper()}) ===")

    files = collect_files()
    cache = load_cache()
    new_cache = {}
    to_upload = []

    for path in files:
        rel = path.relative_to(ROOT).as_posix()
        h = hash_file(path)
        new_cache[rel] = h
        if cache.get(rel) != h:
            to_upload.append(path)

    if not to_upload:
        print("\n✅ Всё актуально. Загружать нечего.")
        return

    print(f"\nК загрузке: {len(to_upload)} файлов")
    for p in to_upload[:10]:
        print(f"  · {p.relative_to(ROOT)}")
    if len(to_upload) > 10:
        print(f"  · ... и ещё {len(to_upload) - 10}")

    if proto == "sftp":
        uploaded = upload_sftp(env, to_upload, new_cache)
    else:
        uploaded = upload_ftp(env, to_upload, new_cache)

    save_cache(new_cache)
    print(f"\n✅ Загружено: {uploaded}/{len(to_upload)}")
    print(f"   Кеш хешей: {CACHE_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
