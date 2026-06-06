"""Convert AI-generated PNGs into the business-images JPG pack.

The image generator saves PNGs named like `{category}-NN.png` into the
Cursor project assets folder. This script converts each matching PNG to a
JPG and moves it into `vendor-web/public/business-images/{category}/`.

Only PNGs whose `{category}` matches an existing folder are processed.
"""
import os
import re
import sys
from PIL import Image

ASSETS = r"C:\Users\mslav\.cursor\projects\c-Users-mslav-OneDrive-Documents-Asureit-asureit\assets"
TARGET = r"C:\Users\mslav\OneDrive\Documents\Asureit\asureit\vendor-web\public\business-images"

PATTERN = re.compile(r"^(.+)-(\d{2})\.png$", re.IGNORECASE)


def main():
    moved = 0
    skipped = []
    for name in os.listdir(ASSETS):
        m = PATTERN.match(name)
        if not m:
            continue
        category, num = m.group(1), m.group(2)
        dest_dir = os.path.join(TARGET, category)
        if not os.path.isdir(dest_dir):
            skipped.append(name)
            continue
        src = os.path.join(ASSETS, name)
        dest = os.path.join(dest_dir, f"{category}-{num}.jpg")
        with Image.open(src) as im:
            rgb = im.convert("RGB")
            rgb.save(dest, "JPEG", quality=88, optimize=True)
        os.remove(src)
        moved += 1
        print(f"  -> {category}/{category}-{num}.jpg")
    print(f"MOVED: {moved}")
    if skipped:
        print(f"SKIPPED (no matching folder): {skipped}")


if __name__ == "__main__":
    main()
