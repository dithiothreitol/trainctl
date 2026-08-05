# -*- coding: utf-8 -*-
"""Ekstrakcja czystego tekstu z plikow .docx korpusu do corpus/raw-text/*.txt.

Uzycie: python tools/corpus/extract_text.py
Zrodlo: corpus/source/*.docx  ->  cel: corpus/raw-text/<basename>.txt
"""
import zipfile, re, html, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'corpus' / 'source'
DST = ROOT / 'corpus' / 'raw-text'


def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read('word/document.xml').decode('utf-8')
    xml = re.sub(r'<w:tab[^>]*/>', '\t', xml)
    xml = xml.replace('</w:p>', '\n').replace('</w:tc>', ' | ').replace('</w:tr>', '\n')
    parts = []
    for m in re.finditer(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>|(\n)|( \| )|(\t)', xml, re.S):
        parts.append(m.group(1) or m.group(2) or m.group(3) or m.group(4) or '')
    text = ''.join(html.unescape(p) for p in parts)
    lines = [re.sub(r'( \| )+$', '', l).strip() for l in text.split('\n')]
    lines = [l for l in lines if l and l != '|']
    return '\n'.join(lines)


def main():
    DST.mkdir(parents=True, exist_ok=True)
    files = sorted(SRC.glob('*.docx'))
    ok, fail = 0, []
    for f in files:
        try:
            out = DST / (f.stem.replace('.converted', '') + '.txt')
            out.write_text(docx_text(f), encoding='utf-8')
            ok += 1
        except Exception as e:
            fail.append(f'{f.name}: {e}')
    print(f'Extracted {ok}/{len(files)} files -> {DST}')
    for line in fail:
        print('FAILED:', line)


if __name__ == '__main__':
    main()
