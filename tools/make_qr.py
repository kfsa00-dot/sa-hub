#!/usr/bin/env python3
"""產生推廣用 QR code（輸出到專案根目錄的 qr.png）。

用法：
    python3 tools/make_qr.py

需要：pip3 install --user segno pillow
換網址就改 URL。
"""
import os
import segno
from PIL import Image, ImageDraw, ImageFont

URL   = "https://kfsa00-dot.github.io/sa-hub/"
TITLE = "光復學務查詢系統"
SUB   = "手機掃描 → 加入主畫面"

FONT_CJK   = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_LATIN = "/System/Library/Fonts/HelveticaNeue.ttc"
NAVY = (30, 58, 95)
DIM  = (92, 104, 117)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, "qr.png")
TMP  = os.path.join(ROOT, "_qr_raw.png")

# 等級 H：容錯 30%，列印後髒污或折到一角仍掃得到
qr = segno.make(URL, error="h")
SCALE, BORDER = 19, 2          # 直接用整數倍率輸出，不再縮放，模組邊緣才不會糊
qr.save(TMP, scale=SCALE, border=BORDER, dark="#1e3a5f", light="#ffffff")

q = Image.open(TMP).convert("RGB")
QS = q.size[0]
W, H = QS + 200, 200 + QS + 130
card = Image.new("RGB", (W, H), (255, 255, 255))
d = ImageDraw.Draw(card)

f_title = ImageFont.truetype(FONT_CJK, 54, index=1)
f_sub   = ImageFont.truetype(FONT_CJK, 30, index=1)
f_url   = ImageFont.truetype(FONT_LATIN, 26, index=0)


def center(y, text, font, fill):
    b = d.textbbox((0, 0), text, font=font)
    d.text(((W - (b[2] - b[0])) / 2 - b[0], y), text, font=font, fill=fill)


center(58, TITLE, f_title, NAVY)
center(130, SUB, f_sub, DIM)
card.paste(q, ((W - QS) // 2, 200))
center(200 + QS + 55, URL, f_url, NAVY)
card.save(OUT)
os.remove(TMP)
print("QR code 已輸出：", OUT, card.size, "版本", qr.version)
