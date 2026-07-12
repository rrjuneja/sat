"""Print a summary of the generated question data + image assets."""
import glob
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    idx_path = os.path.join(BASE, "public", "data", "index.json")
    if not os.path.exists(idx_path):
        print("index.json not found - run build_data.py first")
        return
    d = json.load(open(idx_path, encoding="utf-8"))
    print("total questions:", len(d))
    tests = {}
    for r in d:
        t = tests.setdefault(r["test"], {"n": 0, "domains": {}, "diff": {}})
        t["n"] += 1
        t["domains"].setdefault(r["domain"], set()).add(r["skill"])
        t["diff"][r["difficulty"]] = t["diff"].get(r["difficulty"], 0) + 1
    for t, v in tests.items():
        print(f"\n{t}: {v['n']} questions  diff={v['diff']}")
        for dom, skills in sorted(v["domains"].items()):
            print(f"   - {dom}: {len(skills)} skills")

    for sub, label in (("q", "question"), ("r", "rationale")):
        files = glob.glob(os.path.join(BASE, "public", "img", sub, "*.webp"))
        total = sum(os.path.getsize(p) for p in files)
        avg = total / max(1, len(files))
        print(f"\n{label} images: {len(files)} files, {total/1024/1024:.1f} MB, avg {avg/1024:.1f} KB")

    data_files = glob.glob(os.path.join(BASE, "public", "data", "**", "*.json"), recursive=True)
    dtotal = sum(os.path.getsize(p) for p in data_files)
    print(f"\njson data: {len(data_files)} files, {dtotal/1024/1024:.2f} MB")


if __name__ == "__main__":
    main()
