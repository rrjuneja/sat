"""Parse the SAT question-bank PDFs into JSON + rendered question/rationale images.

Rendering strategy (chosen after probing the PDFs):
  * Equations/graphs are vector drawings that don't extract as text, and reading
    passages contain unmapped typographic glyphs. To guarantee fidelity we render
    the *question region* (cropped above "Correct Answer", so the answer stays
    hidden) as a grayscale WebP for EVERY question.
  * Math rationales also contain vector equations, so we render a rationale image
    (from "Correct Answer" downward, stitched across continuation pages) for Math.
  * Reading rationales are shown as (lightly cleaned) text.

Rendering is CPU-bound, so questions are processed across a process pool.

Outputs (relative to app public dir):
  public/data/index.json                      -> lightweight list for selection + dashboards
  public/data/content/<key>.json              -> full question content keyed by id
  public/img/q/<id>.webp                       -> question region image (answer hidden)
  public/img/r/<id>.webp                       -> rationale region image (math)

Usage:
  python tools/build_data.py                 # full run
  python tools/build_data.py --limit 30      # sample run per pdf
  python tools/build_data.py --workers 4     # cap worker processes
"""
import argparse
import json
import os
import re
from concurrent.futures import ProcessPoolExecutor

import fitz  # PyMuPDF
from PIL import Image, ImageOps

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(BASE, "public")
DATA = os.path.join(PUBLIC, "data")
CONTENT = os.path.join(DATA, "content")
IMG_Q = os.path.join(PUBLIC, "img", "q")
IMG_R = os.path.join(PUBLIC, "img", "r")

SOURCES = [
    {"file": "questionbank-export-2026-7-12 (1).pdf", "name": "SAT Math Question Bank", "test": "Math", "key": "math"},
    {"file": "questionbank-export-2026-7-12.pdf", "name": "SAT Reading and Writing Question Bank", "test": "Reading and Writing", "key": "rw"},
]

DPI = 130
WEBP_METHOD = 3
WEBP_Q = 72
WEBP_R = 68
FOOTER_BAND = 16  # points to trim from the bottom of each page (the "-- N of M --" marker)

QID_RE = re.compile(r"Question ID:\s*([0-9a-fA-F]+)")
FOOTER_RE = re.compile(r"--\s*\d+\s+of\s+\d+\s*--")
HEADERS = ["Assessment", "Test", "Domain", "Skill", "Difficulty"]
DIFFICULTIES = {"Easy", "Medium", "Hard"}


def ensure_dirs():
    for d in (DATA, CONTENT, IMG_Q, IMG_R):
        os.makedirs(d, exist_ok=True)


def clean(text):
    if not text:
        return text
    return text.replace("\ufffd", "'").replace("\xad", "")


def trim_vertical(img, pad=10):
    bbox = ImageOps.invert(img).getbbox()
    if not bbox:
        return img
    top = max(0, bbox[1] - pad)
    bottom = min(img.height, bbox[3] + pad)
    return img.crop((0, top, img.width, bottom))


def render_webp(page, clip, quality, dest):
    if clip.height <= 2 or clip.width <= 2:
        return 0
    pix = page.get_pixmap(dpi=DPI, clip=clip, colorspace=fitz.csGRAY)
    img = trim_vertical(Image.frombytes("L", (pix.width, pix.height), pix.samples))
    img.save(dest, format="WEBP", quality=quality, method=WEBP_METHOD)
    return os.path.getsize(dest)


def stitch_webp(pieces, quality, dest):
    imgs = []
    for page, clip in pieces:
        if clip.height <= 2:
            continue
        pix = page.get_pixmap(dpi=DPI, clip=clip, colorspace=fitz.csGRAY)
        imgs.append(Image.frombytes("L", (pix.width, pix.height), pix.samples))
    imgs = [im for im in imgs if im.height > 4]
    if not imgs:
        return 0
    width = max(im.width for im in imgs)
    canvas = Image.new("L", (width, sum(im.height for im in imgs)), 255)
    y = 0
    for im in imgs:
        canvas.paste(im, (0, y))
        y += im.height
    trim_vertical(canvas).save(dest, format="WEBP", quality=quality, method=WEBP_METHOD)
    return os.path.getsize(dest)


def column_bands(words):
    anchors = {}
    for w in words:
        if w[4] in HEADERS and w[1] < 120 and w[4] not in anchors:
            anchors[w[4]] = w[0]
    if len(anchors) < 5:
        return None, None
    ordered = [(n, anchors[n]) for n in HEADERS]
    header_bottom = max(w[3] for w in words if w[4] in HEADERS and w[1] < 120)
    bands = {}
    for i, (name, x) in enumerate(ordered):
        left = x - 6
        right = (ordered[i + 1][1] - 6) if i + 1 < len(ordered) else 10000
        bands[name] = (left, right)
    return bands, header_bottom


def parse_metadata(words):
    bands, header_bottom = column_bands(words)
    if not bands:
        return {"domain": "", "skill": "", "difficulty": ""}, None

    q_head_y = None
    for i, w in enumerate(words):
        if w[4] == "Question" and w[1] > header_bottom:
            nxt = words[i + 1] if i + 1 < len(words) else None
            if not (nxt and nxt[4].startswith("ID")):
                q_head_y = w[1]
                break

    limit_y = q_head_y if q_head_y else header_bottom + 120
    cells = {n: [] for n in HEADERS}
    for w in words:
        y0, x0 = w[1], w[0]
        if y0 <= header_bottom or y0 >= limit_y:
            continue
        for name, (lft, rgt) in bands.items():
            if lft <= x0 < rgt:
                cells[name].append((round(y0), x0, w[4]))
                break

    def join(name):
        return " ".join(t[2] for t in sorted(cells[name], key=lambda t: (t[0], t[1]))).strip()

    difficulty = join("Difficulty")
    dtoks = [t for t in difficulty.split() if t in DIFFICULTIES]
    difficulty = dtoks[0] if dtoks else difficulty
    return {"domain": clean(join("Domain")), "skill": clean(join("Skill")), "difficulty": difficulty}, q_head_y


# A student-produced-response answer: integer, decimal, or fraction (optional
# leading minus). Used to pull grid-in answers out of "Correct Answer:" lines and
# rationale phrasing.
NUM_RE = re.compile(r"^-?\d+(?:\.\d+)?(?:/-?\d+(?:\.\d+)?)?$")


def split_nums(s):
    """Split a free-text answer list into normalised numeric tokens."""
    s = (s or "").replace("\u2212", "-")  # unicode minus -> ASCII
    out = []
    for part in re.split(r",|\band\b|\bor\b", s):
        p = part.strip().rstrip(".").strip()
        if NUM_RE.match(p) and p not in out:
            out.append(p)
    return out


def grid_from_rationale(text):
    """Recover acceptable grid-in answers when the value is only in an image.

    The bank still spells the answer out in prose, e.g.
      "... 7/6, 1.166, and 1.167 are examples of ways to enter a correct answer."
      "The correct answer is 5."
    """
    m = re.search(
        r"(?:Note that\s+)?([-0-9/.\s,]+?(?:and\s+[-0-9/.\s,]+)?)\s+(?:is|are)\s+"
        r"(?:an?\s+)?examples?\s+of\s+(?:a\s+)?ways?\s+to\s+enter\s+a\s+correct\s+answer",
        text,
        re.I,
    )
    if m:
        toks = split_nums(m.group(1))
        if toks:
            return toks
    m = re.search(r"[Tt]he correct answer is\s+([^.]+?)\.", text)
    if m:
        toks = split_nums(m.group(1))
        if toks:
            return toks
    return []


def answer_info(text):
    """From the full text of a question (all pages), return (mc_letter, accepted).

    `mc_letter` is set for multiple-choice; `accepted` is the list of acceptable
    grid-in answers otherwise. Reading the whole page span is important because
    the answer/rationale often spill onto continuation pages.
    """
    m = re.search(r"Correct Answer:\s*([A-D])\b", text)
    if m:
        return m.group(1), []
    m = re.search(r"\bChoices?\s+([A-D])\s+is\s+correct\b", text, re.I)
    if m:
        return m.group(1), []

    accepted = []
    m = re.search(r"Correct Answer:\s*([^\n]+)", text)
    if m:
        accepted = split_nums(m.group(1))
    if not accepted:
        accepted = grid_from_rationale(text)
    return None, accepted


def split_sections(text):
    text = FOOTER_RE.sub("", text)
    # Drop the leading "Question ID: <hex>" so the \bQuestion\b search below finds
    # the actual "Question" section header instead of matching inside "Question ID".
    text = QID_RE.sub("", text, count=1)

    stem = ""
    qm = re.search(r"\bQuestion\b", text)
    if qm:
        after = text[qm.end():]
        cut = re.search(r"\n\s*Answer\s*\n|Correct Answer:|\bRationale\b", after)
        stem = after[: cut.start()].strip() if cut else after.strip()

    choices = {}
    am = re.search(r"\n\s*Answer\s*\n", text)
    if am:
        seg = text[am.end():]
        cm = re.search(r"Correct Answer:|\bRationale\b", seg)
        seg = seg[: cm.start()] if cm else seg
        for cl in re.finditer(r"(?m)^\s*([A-D])\.\s*(.*)$", seg):
            choices[cl.group(1)] = clean(cl.group(2).strip())

    rationale = ""
    rm = re.search(r"\bRationale\b", text)
    if rm:
        rationale = text[rm.end():].strip()
    return clean(stem), choices, clean(rationale)


# ---- Worker (one open document per process) --------------------------------

_DOC = None
_SRC = None


def _init_worker(path, src):
    global _DOC, _SRC
    _DOC = fitz.open(path)
    _SRC = src


def find_answer_marker(pidx, end_page):
    """Locate where the answer/rationale block begins within a question's page span.

    Returns (page_index, y). "Correct Answer" is preferred (kept first so questions
    that used to resolve on their primary page render byte-for-byte identically);
    "Rationale" is a fallback for questions whose answer letter/value is an image
    and therefore has no "Correct Answer:" text.
    """
    for k in range(pidx, end_page + 1):
        rects = _DOC[k].search_for("Correct Answer")
        if rects:
            return k, rects[0].y0 - 2
    for k in range(pidx, end_page + 1):
        rects = _DOC[k].search_for("Rationale")
        if rects:
            return k, rects[0].y0 - 2
    return None, None


def process_question(task):
    pidx, qid, end_page = task
    page = _DOC[pidx]
    is_math = _SRC["key"] == "math"

    text = page.get_text()
    words = page.get_text("words")
    meta, q_head_y = parse_metadata(words)
    stem, choices, rationale = split_sections(text)

    # Answer detection reads the whole page span: the answer/rationale (and its
    # letter/value) frequently continue onto the next page(s).
    full_text = FOOTER_RE.sub("", "\n".join(_DOC[k].get_text() for k in range(pidx, end_page + 1)))
    mc_letter, accepted = answer_info(full_text)
    is_mc = mc_letter is not None
    qtype = "mc" if is_mc else "grid"

    if not is_math:
        for k in range(pidx + 1, end_page + 1):
            rationale += "\n" + clean(FOOTER_RE.sub("", _DOC[k].get_text()).strip())
        rationale = rationale.strip()

    ca_page_idx, answer_y = find_answer_marker(pidx, end_page)
    content_top = (q_head_y - 4) if q_head_y else page.rect.y0 + 40

    has_q_img = False
    qdest = os.path.join(IMG_Q, f"{qid}.webp")
    if ca_page_idx == pidx and answer_y and answer_y > content_top:
        # Single-page question: unchanged from the original render path.
        clip = fitz.Rect(page.rect.x0, content_top, page.rect.x1, answer_y)
        has_q_img = render_webp(page, clip, WEBP_Q, qdest) > 0
    elif ca_page_idx is not None and ca_page_idx > pidx:
        # Question (often with image answer choices) spans pages: stitch the
        # region from the top of the question down to the answer marker.
        pieces = []
        for k in range(pidx, ca_page_idx + 1):
            pg = _DOC[k]
            top = content_top if k == pidx else pg.rect.y0 + 4
            bot = answer_y if k == ca_page_idx else pg.rect.y1 - FOOTER_BAND
            pieces.append((pg, fitz.Rect(pg.rect.x0, top, pg.rect.x1, bot)))
        has_q_img = stitch_webp(pieces, WEBP_Q, qdest) > 0

    has_r_img = False
    if is_math and answer_y is not None:
        capage = _DOC[ca_page_idx]
        pieces = [(capage, fitz.Rect(capage.rect.x0, answer_y, capage.rect.x1, capage.rect.y1 - FOOTER_BAND))]
        for k in range(ca_page_idx + 1, end_page + 1):
            pg = _DOC[k]
            pieces.append((pg, fitz.Rect(pg.rect.x0, pg.rect.y0 + 4, pg.rect.x1, pg.rect.y1 - FOOTER_BAND)))
        has_r_img = stitch_webp(pieces, WEBP_R, os.path.join(IMG_R, f"{qid}.webp")) > 0

    dslug = re.sub(r"[^a-z0-9]+", "-", meta["domain"].lower()).strip("-") or "misc"
    index_rec = {
        "id": qid, "pdf": _SRC["name"], "test": _SRC["test"],
        "domain": meta["domain"], "skill": meta["skill"], "difficulty": meta["difficulty"],
        "page": pidx + 1, "type": qtype, "qImg": has_q_img, "rImg": has_r_img,
    }
    content_rec = {
        "id": qid, "stem": stem, "choices": choices, "type": qtype,
        "correct": mc_letter if is_mc else None, "accepted": accepted,
        "rationale": "" if is_math else rationale, "qImg": has_q_img, "rImg": has_r_img,
    }
    return f'{_SRC["key"]}__{dslug}', index_rec, content_rec


def scan_starts(path, limit):
    doc = fitz.open(path)
    n = doc.page_count
    starts = []
    for i in range(n):
        m = QID_RE.search(doc[i].get_text())
        if m:
            starts.append((i, m.group(1)))
    doc.close()
    tasks = []
    for si, (pidx, qid) in enumerate(starts):
        end_page = (starts[si + 1][0] - 1) if si + 1 < len(starts) else n - 1
        tasks.append((pidx, qid, end_page))
    if limit:
        tasks = tasks[:limit]
    return tasks


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=max(2, (os.cpu_count() or 4)))
    args = ap.parse_args()
    ensure_dirs()

    index, content_map, done = [], {}, 0
    for src in SOURCES:
        path = os.path.join(BASE, src["file"])
        print(f"Scanning {src['name']} ...", flush=True)
        tasks = scan_starts(path, args.limit)
        print(f"  {len(tasks)} questions -> rendering with {args.workers} workers", flush=True)
        with ProcessPoolExecutor(max_workers=args.workers, initializer=_init_worker, initargs=(path, src)) as ex:
            for bundle_key, index_rec, content_rec in ex.map(process_question, tasks, chunksize=8):
                index.append(index_rec)
                content_map.setdefault(bundle_key, {})[content_rec["id"]] = content_rec
                done += 1
                if done % 250 == 0:
                    print(f"  ...{done} questions", flush=True)

    index.sort(key=lambda r: (r["test"], r["domain"], r["skill"], r["page"]))
    with open(os.path.join(DATA, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)
    for key, qmap in content_map.items():
        with open(os.path.join(CONTENT, f"{key}.json"), "w", encoding="utf-8") as f:
            json.dump(qmap, f, ensure_ascii=False)

    print("\n==== SUMMARY ====")
    print("total questions:", len(index))
    tests = {}
    for r in index:
        t = tests.setdefault(r["test"], {"n": 0, "domains": {}, "q_img": 0, "r_img": 0})
        t["n"] += 1
        t["domains"].setdefault(r["domain"], set()).add(r["skill"])
        t["q_img"] += r["qImg"]
        t["r_img"] += r["rImg"]
    for t, v in tests.items():
        print(f"\n  {t}: {v['n']} questions | q_img={v['q_img']} r_img={v['r_img']}")
        for dom, skills in sorted(v["domains"].items()):
            print(f"     - {dom}: {len(skills)} skills")


if __name__ == "__main__":
    main()
