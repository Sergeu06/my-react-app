import os
import re
import argparse
from PIL import Image

SIZES = [1024, 512, 256]
IMAGE_EXT = ".png"

# Матчит имена "Название 512", "Название 256", "Название 1024" (без расширения)
RESIZED_SUFFIX_RE = re.compile(r"^(?P<base>.+)\s(?P<size>1024|512|256)$", re.IGNORECASE)


def ensure_folders(base_folder: str) -> None:
    for size in SIZES:
        os.makedirs(os.path.join(base_folder, str(size)), exist_ok=True)


def is_resized_name(filename: str) -> bool:
    if not filename.lower().endswith(IMAGE_EXT):
        return False
    stem = os.path.splitext(filename)[0]
    return RESIZED_SUFFIX_RE.match(stem) is not None


def resize_images(folder: str) -> None:
    ensure_folders(folder)

    for filename in os.listdir(folder):
        if not filename.lower().endswith(IMAGE_EXT):
            continue

        stem = os.path.splitext(filename)[0]

        # Пропускаем файлы, которые уже являются версиями 1024/512/256
        if RESIZED_SUFFIX_RE.match(stem):
            print(f"⏭ Пропущено (уже версия): {filename}")
            continue

        input_path = os.path.join(folder, filename)

        try:
            with Image.open(input_path) as img:
                img = img.convert("RGBA")

                for size in SIZES:
                    out_dir = os.path.join(folder, str(size))
                    out_name = f"{stem} {size}.png"
                    out_path = os.path.join(out_dir, out_name)

                    # Не перезаписываем, если уже есть
                    if os.path.exists(out_path):
                        continue

                    resized = img.resize((size, size), Image.LANCZOS)
                    resized.save(out_path, optimize=True)

            print(f"✔ Обработано: {filename}")

        except Exception as e:
            print(f"✖ Ошибка: {filename} — {e}")


def cleanup_resized_files(root_folder: str, dry_run: bool = False) -> None:
    """
    Удаляет в root_folder и во всех подпапках PNG-файлы с суффиксом:
    ' 1024', ' 512', ' 256' перед расширением.
    """
    deleted = 0
    scanned = 0

    for dirpath, _, filenames in os.walk(root_folder):
        for filename in filenames:
            scanned += 1
            if not is_resized_name(filename):
                continue

            full_path = os.path.join(dirpath, filename)

            if dry_run:
                print(f"[DRY-RUN] Удалил бы: {full_path}")
            else:
                try:
                    os.remove(full_path)
                    print(f"🗑 Удалено: {full_path}")
                    deleted += 1
                except Exception as e:
                    print(f"✖ Не удалось удалить: {full_path} — {e}")

    if dry_run:
        print(f"\nГотово (DRY-RUN). Просканировано файлов: {scanned}.")
    else:
        print(f"\nГотово. Просканировано файлов: {scanned}. Удалено: {deleted}.")


def main():
    parser = argparse.ArgumentParser(
        description="Resize PNG images into /1024 /512 /256 and/or cleanup resized versions."
    )
    parser.add_argument(
        "folder",
        help="Путь к папке с оригиналами PNG"
    )
    parser.add_argument(
        "--mode",
        choices=["resize", "cleanup", "both"],
        default="resize",
        help="resize — создать версии; cleanup — удалить версии; both — сначала resize, потом cleanup"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Только для cleanup: показать, что будет удалено, но ничего не удалять"
    )

    args = parser.parse_args()
    folder = os.path.abspath(args.folder)

    if not os.path.isdir(folder):
        raise SystemExit(f"Папка не найдена: {folder}")

    if args.mode in ("resize", "both"):
        resize_images(folder)

    if args.mode in ("cleanup", "both"):
        cleanup_resized_files(folder, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
