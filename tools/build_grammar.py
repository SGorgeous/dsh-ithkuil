#!/usr/bin/env python
"""把各章解出的纯文本切成"按小节"的语料，供插件做全文检索。

输出：data/grammar.json  [{ch, num, title, text}]
  ch   = 章节号（"3"）
  num  = 小节号（"3.6.1"）
  title= 小节标题
  text = 该小节正文（含表格行）
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TXT = ROOT / "data" / "text"
OUT = ROOT / "data"

HEAD = re.compile(r"^(\d+\.\d+(?:\.\d+)*)\s+(.+)$")

CH_NAMES = {
    "1": "音系 Phonology",
    "2": "形态音系 Morpho-Phonology",
    "3": "基本形态 Basic Morphology",
    "4": "格形态 Case Morphology",
    "5": "动词形态 Verb Morphology",
    "6": "更多动词形态 More Verb Morphology",
    "7": "词缀 Affixes",
    "8": "附加词 Adjuncts",
    "9": "指代 Referentials",
    "10": "特殊结构 Special Constructions",
    "11": "句法 Syntax",
    "12": "书写系统 Writing System",
    "13": "数词 Numbers",
    "A": "附录 Appendices",
    "0": "引言 Introduction",
    "01": "Phonology 音系",
    "02": "Morpho-Phonology 形态音系",
    "03": "Basic Morphology 基本形态",
    "04": "Case Morphology 格形态",
    "05": "Verb Morphology 动词形态",
    "06": "More Verb Morphology 更多动词形态",
    "07": "Affixes 词缀",
    "08": "Adjuncts 附加词",
    "09": "Referentials 指代",
    "10": "Special Constructions 特殊结构",
    "11": "Syntax 句法",
    "12": "Writing System 书写系统",
    "13": "Numbers 数词",
    "newithkuil_appendices": "Appendices 附录",
    "00_intro": "Introduction 引言",
}


def chapter_of(stem: str) -> str:
    m = re.match(r"newithkuil_(\d\d)", stem)
    if m:
        return str(int(m.group(1)))
    return "A" if "appendix" in stem else "0"


def main() -> None:
    sections: list[dict] = []
    for f in sorted(TXT.glob("*.txt")):
        stem = f.stem
        ch = chapter_of(stem)
        name = CH_NAMES.get(ch) or CH_NAMES.get(stem) or stem
        cur = {"ch": ch, "chName": name, "num": f"{ch}.0", "title": name, "text": []}
        for ln in f.read_text(encoding="utf-8").split("\n"):
            m = HEAD.match(ln)
            if m and len(m.group(2)) < 160:
                sections.append({**cur, "text": "\n".join(cur["text"]).strip()})
                cur = {"ch": ch, "chName": name, "num": m.group(1), "title": m.group(2).strip(), "text": []}
            else:
                cur["text"].append(ln)
        sections.append({**cur, "text": "\n".join(cur["text"]).strip()})

    sections = [s for s in sections if len(s["text"]) > 40]
    (OUT / "grammar.json").write_text(json.dumps(sections, ensure_ascii=False), encoding="utf-8")
    chars = sum(len(s["text"]) for s in sections)
    print(f"sections={len(sections)} chars={chars:,} size={(OUT / 'grammar.json').stat().st_size / 1e6:.2f} MB")
    for s in sections[:3]:
        print(" ", s["num"], s["title"][:60], len(s["text"]))


if __name__ == "__main__":
    main()
