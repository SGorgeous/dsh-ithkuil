#!/usr/bin/env python
"""把 ithkuil.net 的语法章节 HTML 转成干净的纯文本（表格按行展开）。

用法: python tools/extract_text.py
输出: data/text/<chapter>.txt

坑：原页面是 Word 导出的 HTML，变形表里每个格都包着 <p>，
    直接按标签换行会把表格竖着摊开（cells 一行一个）。所以表格必须单独走一遍。
"""
from __future__ import annotations

import re
from pathlib import Path

import lxml.html

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "html"
OUT = ROOT / "data" / "text"


def decode(raw: bytes) -> str:
    for enc in ("cp1252", "utf-8"):
        try:
            s = raw.decode(enc)
        except UnicodeDecodeError:
            continue
        if "\ufffd" not in s:
            return s
    return raw.decode("cp1252", errors="replace")


def norm(s: str) -> str:
    s = s.replace("\xa0", " ").replace("\u200b", "").replace("\u2019", "’")
    return re.sub(r"\s+", " ", s).strip()


def cell_text(el) -> str:
    return norm(" ".join(el.itertext()))


def table_text(tbl) -> str:
    rows_out = []
    for tr in tbl.iter("tr"):
        cells = [cell_text(td) for td in tr if td.tag in ("td", "th")]
        cells = [c for c in cells if c]
        if not cells:
            continue
        # 同一格被 Word 拆成多列的重复内容，去重相邻相同值
        dedup = []
        for c in cells:
            if not dedup or dedup[-1] != c:
                dedup.append(c)
        rows_out.append(" | ".join(dedup))
    return "\n".join(rows_out)


BLOCK = ("p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "table")


def block_text(el) -> list[str]:
    """元素 -> 行列表；遇到 table 就换成行式表格。"""
    out: list[str] = []

    def walk(node):
        tag = node.tag.lower() if isinstance(node.tag, str) else ""
        if tag in ("script", "style", "head"):
            return
        if tag == "table":
            t = table_text(node)
            if t:
                out.append(t)
            return
        if tag in BLOCK:
            kids = [c for c in node.iterdescendants()
                    if isinstance(c.tag, str) and c.tag.lower() in BLOCK]
            if not kids:  # 叶子块：整块当一行
                txt = norm(" ".join(node.itertext()))
                if txt:
                    out.append(txt)
                return
        for c in node:
            walk(c)

    walk(el)
    return out


def body_root(doc):
    for el in doc.iter():
        if isinstance(el.tag, str) and el.tag.lower() == "body":
            return el
    return doc


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for f in sorted(SRC.glob("*.htm*")):
        raw = f.read_bytes()
        doc = lxml.html.document_fromstring(decode(raw))
        body = body_root(doc)
        lines = [ln for ln in block_text(body) if ln and ln != "|"]
        # 砍掉开头那块章节导航目录（到第一个 "N.0" 为止）
        start = 0
        for i, ln in enumerate(lines[:400]):
            if re.match(r"^\d+\.0(\s|$)", ln):
                start = i
                break
        lines = lines[start:]
        text = "\n".join(lines)
        dest = OUT / (f.stem + ".txt")
        dest.write_text(text, encoding="utf-8")
        print(f"{dest.name}: {len(text):,} chars, {len(lines):,} lines")


if __name__ == "__main__":
    main()
