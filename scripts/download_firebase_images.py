#!/usr/bin/env python3
import argparse
import os
import re
from pathlib import Path
from urllib.parse import urlparse, unquote

import requests
import firebase_admin
from firebase_admin import credentials, firestore


def _sanitize_filename(name: str) -> str:
    safe = re.sub(r"[\\/:*?\"<>|]+", "_", name).strip()
    return safe or "untitled"


def _extension_from_url(url: str) -> str:
    path = unquote(urlparse(url).path)
    ext = Path(path).suffix
    return ext if ext else ".png"


def init_firebase(cred_path: str) -> None:
    # Инициализируем Firebase Admin один раз
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)


def download_cards(collection: str, output_dir: Path) -> None:
    db = firestore.client()
    output_dir.mkdir(parents=True, exist_ok=True)

    docs = db.collection(collection).stream()
    seen_names = set()

    for doc in docs:
        data = doc.to_dict() or {}
        name = data.get("name")
        image_url = data.get("image_url")

        if not name or not image_url:
            print(f"Skipping {doc.id}: missing name or image_url")
            continue

        base_name = _sanitize_filename(str(name))
        ext = _extension_from_url(str(image_url))
        filename = f"{base_name}{ext}"

        if filename in seen_names:
            filename = f"{base_name}_{doc.id}{ext}"

        seen_names.add(filename)
        destination = output_dir / filename

        response = requests.get(str(image_url), timeout=30)
        response.raise_for_status()
        destination.write_bytes(response.content)

        print(f"Saved {destination}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download card images from Firebase Storage using metadata stored in Cloud Firestore (Firebase Admin SDK)."
    )
    parser.add_argument(
        "--cred",
        required=True,
        help="Path to Firebase service account JSON (certificate).",
    )
    parser.add_argument(
        "--collection",
        default="cards",
        help="Firestore collection name that stores card documents.",
    )
    parser.add_argument(
        "--output",
        default="downloads/cards",
        help="Directory to save downloaded images.",
    )
    args = parser.parse_args()

    cred_path = os.path.expanduser(args.cred)
    output_dir = Path(os.path.expanduser(args.output))

    init_firebase(cred_path)
    download_cards(args.collection, output_dir)


if __name__ == "__main__":
    main()
