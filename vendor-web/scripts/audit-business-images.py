"""Report JPG image counts for every business-images folder.

Lists how many `{category}-NN.jpg` files each category folder has, and
which folders still need topping up to reach the target count.
"""
import os

TARGET = r"C:\Users\mslav\OneDrive\Documents\Asureit\asureit\vendor-web\public\business-images"
GOAL = 15


def main():
    folders = sorted(
        d for d in os.listdir(TARGET)
        if os.path.isdir(os.path.join(TARGET, d))
    )
    need = []
    full = 0
    for d in folders:
        jpgs = [f for f in os.listdir(os.path.join(TARGET, d)) if f.lower().endswith(".jpg")]
        n = len(jpgs)
        if n >= GOAL:
            full += 1
        else:
            need.append((d, n))
    print(f"TOTAL FOLDERS: {len(folders)}")
    print(f"AT/ABOVE {GOAL}: {full}")
    print(f"NEED TOPPING UP: {len(need)}")
    for d, n in need:
        print(f"  {d}: {n} (need {GOAL - n})")


if __name__ == "__main__":
    main()
