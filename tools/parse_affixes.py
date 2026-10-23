#!/usr/bin/env python
"""解析官方《VXCS AFFIXES FOR NEW ITHKUIL》PDF -> 词缀库。

版式：每个词缀是一张**带边框的表格**，所以直接让 pdfplumber 认表最稳：
    第 1 行 = [-ňḑ] [IDF Identificative]
    第 2..10 行 = 1..9 度的释义（0 度一般不列 = 该词缀的总体概念）

输出：data/affixes.json [{cs, abbr, name, topic, page, degrees[9]}]
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "data" / "affixes.pdf"
OUT = ROOT / "data"

CS_RE = re.compile(r"^-\s*([a-zà-ɏḀ-ỿ/]+)\s*$")
HEAD_RE = re.compile(r"^([A-Z]{2,3}\d?)\*?\s*(.+)$")
TOPIC_LINE = re.compile(r"^(.+?)\s+(\d{1,3})$")


def read_topics(pdf) -> list[tuple[int, str]]:
    """从第 1 页的目录读出 (起始页, 主题名)，按页排好。"""
    out: list[tuple[int, str]] = []
    for page in pdf.pages[:2]:
        for ln in (page.extract_text() or "").splitlines():
            m = TOPIC_LINE.match(ln.strip())
            if not m:
                continue
            name, pg = m.group(1).strip(), int(m.group(2))
            if 3 <= pg <= 130 and 6 < len(name) < 60 and name[0].isupper() and not any(ch.isdigit() for ch in name):
                out.append((pg, name))
    return sorted(set(out))


def topic_of(page: int, topics: list[tuple[int, str]]) -> str:
    cur = ""
    for start, name in topics:
        if page >= start:
            cur = name
    return cur


def main() -> None:
    affixes: list[dict] = []
    with pdfplumber.open(PDF) as pdf:
        topics = read_topics(pdf)
        print("topics:", topics)
        for pno, page in enumerate(pdf.pages, start=1):
            topic = topic_of(pno, topics)
            for t in page.find_tables():
                rows = [[re.sub(r"\s+", " ", (c or "")).strip() for c in r] for r in t.extract()]
                if not rows:
                    continue
                # 表头里找 CS 形（-ňḑ）
                hdr_idx, cs = None, ""
                for i, r in enumerate(rows[:3]):
                    for c in r:
                        m = CS_RE.match(c)
                        if m:
                            hdr_idx, cs = i, m.group(1)
                            break
                    if cs:
                        break
                if not cs:
                    continue
                hdr = rows[hdr_idx]
                abbr = name = ""
                for c in hdr:
                    if c and not CS_RE.match(c):
                        m = HEAD_RE.match(c)
                        if m:
                            abbr, name = m.group(1), m.group(2).strip()
                            break
                degrees: list[str] = []
                for r in rows[hdr_idx + 1:]:
                    if not r:
                        continue
                    first = r[0].strip()
                    if not first.isdigit():
                        continue
                    body = " ".join(x for x in r[1:] if x).strip()
                    if body:
                        degrees.append(body)
                if len(degrees) < 2:
                    continue
                affixes.append({
                    "cs": cs, "abbr": abbr, "name": name or abbr,
                    "topic": topic, "page": pno,
                    "degrees": degrees[:9],
                })
    # 去重（跨页续表会重复）
    seen: dict[str, dict] = {}
    for a in affixes:
        key = a["cs"] + "|" + a["abbr"]
        if key not in seen or len(a["degrees"]) > len(seen[key]["degrees"]):
            seen[key] = a
    items = sorted(seen.values(), key=lambda x: (x["page"], x["cs"]))
    (OUT / "affixes.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"affixes={len(items)}  size={(OUT / 'affixes.json').stat().st_size / 1e3:.0f} KB")
    for a in items[:3]:
        print(f"-{a['cs']} {a['abbr']} {a['name'][:50]} [{a['topic'][:30]}] deg={len(a['degrees'])}")
        print("   1:", a["degrees"][0][:90] if a["degrees"] else "")


if __name__ == "__main__":
    main()
