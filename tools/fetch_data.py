#!/usr/bin/env python
"""从 ithkuil.net 拉取官方文档，作为解析脚本的输入。

数据不是本仓库的资产，而是原作者 John Quijada 的作品（见 NOTICE.md）。
本仓库**不收录**这些原始文件，只提供这个下载脚本，方便你本地重建 data/*.json。

用法：
    python tools/fetch_data.py            # 下载到 data/
    python tools/fetch_data.py --check    # 只检查哪些已存在
"""
from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

BASE = "https://ithkuil.net/"

CHAPTERS = [
    ("00_intro.htm", "00_intro.html"),
    ("newithkuil_01_phonology.htm", "newithkuil_01_phonology.htm"),
    ("newithkuil_02_morpho-phonology.htm", "newithkuil_02_morpho-phonology.htm"),
    ("newithkuil_03_morphology.htm", "newithkuil_03_morphology.htm"),
    ("newithkuil_04_case.htm", "newithkuil_04_case.htm"),
    ("newithkuil_05_verbs.htm", "newithkuil_05_verbs.htm"),
    ("newithkuil_06_more_verbs.htm", "newithkuil_06_more_verbs.htm"),
    ("newithkuil_07_affixes.htm", "newithkuil_07_affixes.htm"),
    ("newithkuil_08_adjuncts.htm", "newithkuil_08_adjuncts.htm"),
    ("newithkuil_09_referentials.htm", "newithkuil_09_referentials.htm"),
    ("newithkuil_10_spec_constructions.htm", "newithkuil_10_spec_constructions.htm"),
    ("newithkuil_11_syntax.htm", "newithkuil_11_syntax.htm"),
    ("newithkuil_12_script.htm", "newithkuil_12_script.htm"),
    ("newithkuil_13_numbers.htm", "newithkuil_13_numbers.htm"),
    ("newithkuil_appendices.htm", "newithkuil_appendices.htm"),
]

PDFS = [
    "newithkuil_lexicon.pdf",
    "newithkuil_affixes.pdf",
    "new_ithkuil_phonotaxis.pdf",
]


def fetch(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"→ {dest.name}")
    req = urllib.request.Request(url, headers={"User-Agent": "dsh-ithkuil/0.1"})
    with urllib.request.urlopen(req, timeout=120) as r, dest.open("wb") as f:
        f.write(r.read())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只报告缺失文件")
    args = ap.parse_args()

    missing = []
    for local, remote in CHAPTERS:
        dest = DATA / "html" / local
        if not dest.exists():
            missing.append((BASE + remote, dest))
    for name in PDFS:
        dest = DATA / name
        if not dest.exists():
            missing.append((BASE + name, dest))

    if args.check:
        print(f"已有 {(len(CHAPTERS) + len(PDFS)) - len(missing)} / {len(CHAPTERS) + len(PDFS)}")
        for url, dest in missing:
            print("缺：", dest.relative_to(ROOT))
        return

    for url, dest in missing:
        fetch(url, dest)
    print(f"\n完成。缺了 {len(missing)} 个文件。" if missing else "\n都齐了。")
    if missing:
        print("下一步：python tools/extract_text.py && python tools/build_grammar.py && "
              "python tools/parse_lexicon.py && python tools/parse_affixes.py")


if __name__ == "__main__":
    main()
