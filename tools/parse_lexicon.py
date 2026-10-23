#!/usr/bin/env python
"""把官方《LEXICON FOR NEW ITHKUIL》PDF 解析成机器可读的词根库。

版式两个坑：
 1. **双栏**：左/右两栏必须按"视觉行"配对（同一 top 带），
    行文本 = 左栏 + 右栏。这样 'GLOSS 在左、/ 续行’ 在右 这类断行能拼回一句；
    表格里成排的词根（`-CPY- 1. nail … -CPW- 1.` + 右栏 `screw 2. bolt …`）也自然连上。
 2. **多种条目写法**：
      a) 详解式 `-ŢK- ‘MAKE / CONSTRUCT …’` + 下面几段 STEM 1/2/3
      b) 词典式 `-ŘCP- Lanthanum`
      c) 反序式 `Alagille syndrome -ŇZZGR-`
      d) 数字义项式 `-FKȚ- 1. … 2. … 3. …`
    统一做法：扫出每个 -XXX- 记号，取"同行、本记号之后、下一个记号之前"的文字当释义。

输出：data/roots.json  [{r, gloss, senses, page, raw, style}]
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "data" / "lexicon.pdf"
OUT = ROOT / "data"

XSPLIT = 443.0
BAND = 3.0
ROOT_TOK = re.compile(r"-\s?([A-ZÀ-ɏḀ-ỿ]{1,7})\s?-")
PROSE_START = re.compile(r"^(the|a|an|and|or|of|to|in|see|also|above|below|i\.e|e\.g|for|if|when|where)\b", re.I)


def is_root(tok: str) -> bool:
    return tok.isalpha() and tok == tok.upper() and 1 <= len(tok) <= 7


def page_rows(page) -> list[tuple[str, str]]:
    words = page.extract_words()
    left = [w for w in words if w["x0"] < XSPLIT]
    right = [w for w in words if w["x0"] >= XSPLIT]
    items = [(w["top"], 0, w) for w in left] + [(w["top"], 1, w) for w in right]
    items.sort(key=lambda t: (t[0], t[1], t[2]["x0"]))
    bands: list[dict] = []
    for top, side, w in items:
        if bands and abs(top - bands[-1]["top"]) <= BAND:
            bands[-1]["items"].append((side, w))
        else:
            bands.append({"top": top, "items": [(side, w)]})
    rows = []
    for b in bands:
        lw = sorted([w for s, w in b["items"] if s == 0], key=lambda w: w["x0"])
        rw = sorted([w for s, w in b["items"] if s == 1], key=lambda w: w["x0"])
        rows.append((" ".join(x["text"] for x in lw), " ".join(x["text"] for x in rw)))
    return rows


CID = re.compile(r"\(cid:\d+\)")


def clean(s: str) -> str:
    s = s.replace("(cid:1)(cid:2)", "↔")
    s = CID.sub("", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.strip(" |")


def split_senses(s: str) -> list[str]:
    parts = re.split(r"(?:^|\s)([123])\.\s*", s)
    if len(parts) < 7:      # 三段义项会切出 1,2,3 + 前后碎片
        return []
    out = []
    for i in (2, 4, 6):
        if i < len(parts):
            out.append(clean(parts[i]))
    return [x for x in out if x]


def main() -> None:
    entries: list[dict] = []
    with pdfplumber.open(PDF) as pdf:
        npages = len(pdf.pages)
        for pno, page in enumerate(pdf.pages, start=1):
            rows = page_rows(page)
            for ri, (l, r) in enumerate(rows):
                joined = (l + " " + r).strip()
                if not joined:
                    continue
                toks = [m for m in ROOT_TOK.finditer(joined) if is_root(m.group(1))]
                for i, m in enumerate(toks):
                    end = toks[i + 1].start() if i + 1 < len(toks) else len(joined)
                    after = clean(joined[m.end():end])
                    before = clean(ROOT_TOK.sub(" ", joined[:m.start()]))
                    q = re.match(r"^[‘'\"](.+?)[’'\"](.*)$", after)
                    if q:
                        gloss, rest, style = clean(q.group(1)), clean(q.group(2)), "block"
                    elif after and not PROSE_START.match(after) and len(after) <= 110:
                        gloss, rest, style = after, "", "inline"
                    else:
                        gloss, rest, style = clean(before), "", "reverse"
                    if not gloss or len(gloss) > 110:
                        continue
                    gloss = gloss.strip("‘’'\" ") or gloss
                    senses = split_senses(gloss)
                    detail = []
                    # 详解式：把后续行收进来，直到出现下一个词根记号
                    if style == "block":
                        for l2, r2 in rows[ri + 1: ri + 12]:
                            if any(is_root(x.group(1)) for x in ROOT_TOK.finditer(l2 + " " + r2)):
                                break
                            detail.append((l2, r2))
                    raw = "\n".join(x if not y else f"{x} ｜ {y}" for x, y in detail)
                    entries.append({
                        "r": m.group(1), "gloss": gloss, "senses": senses,
                        "page": pno, "style": style, "raw": raw,
                    })

    merged: dict[str, dict] = {}
    for e in entries:
        cur = merged.get(e["r"])
        if not cur:
            merged[e["r"]] = e
            continue
        if len(e["gloss"]) > len(cur["gloss"]):
            cur["gloss"] = e["gloss"]
        if e["senses"] and not cur["senses"]:
            cur["senses"] = e["senses"]
        if len(e["raw"]) > len(cur["raw"]):
            cur["raw"] = e["raw"]
    roots = sorted(merged.values(), key=lambda x: (x["page"], x["r"]))
    (OUT / "roots.json").write_text(json.dumps(roots, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "roots-index.json").write_text(
        json.dumps([{"r": x["r"], "g": x["gloss"], "p": x["page"]} for x in roots],
                   ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"pages={npages} tokens={len(entries)} roots={len(roots)}")
    (OUT / "roots.json").stat()
    print(f"roots.json={(OUT / 'roots.json').stat().st_size / 1e6:.2f} MB")
    for q in ("ŢK", "KSF", "MPW", "RBB", "CPY", "ŠMY", "ŇZZGR"):
        hit = merged.get(q)
        print(f"-{q}- :: {hit['gloss'][:70] if hit else 'MISSING'} | p{hit['page'] if hit else '-'}")


if __name__ == "__main__":
    main()
