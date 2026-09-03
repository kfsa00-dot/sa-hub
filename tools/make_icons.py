#!/usr/bin/env python3
"""重新產生 App 圖示。

用法（在專案根目錄執行）：
    python3 tools/make_icons.py

需要 Pillow：pip3 install --user pillow
改字樣就改 TEXT_TOP / TEXT_BOTTOM，改顏色就改 NAVY / GOLD。
"""
from PIL import Image, ImageDraw, ImageFont
import os

FONT_PATH  = "/System/Library/Fonts/STHeiti Medium.ttc"   # macOS 內建黑體
FONT_INDEX = 1
TEXT_TOP    = "光復"
TEXT_BOTTOM = "學務"
NAVY  = (30, 58, 95, 255)     # #1e3a5f，與網頁主色一致
WHITE = (255, 255, 255, 255)
GOLD  = (224, 167, 0, 255)
SS = 4                        # 超取樣倍率，縮小後邊緣才平滑

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")


def _font(px):
    return ImageFont.truetype(FONT_PATH, px, index=FONT_INDEX)


def _centered(d, cx, cy, text, font, fill):
    b = d.textbbox((0, 0), text, font=font)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text((cx - w / 2 - b[0], cy - h / 2 - b[1]), text, font=font, fill=fill)


def draw(S, rounded=True):
    """畫一張 S×S 的圖示。rounded=True 時四角透明。"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0) if rounded else NAVY)
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=NAVY)
    fs = int(S * 0.265)
    _centered(d, S / 2, S * 0.335, TEXT_TOP, _font(fs), WHITE)
    _centered(d, S / 2, S * 0.625, TEXT_BOTTOM, _font(fs), WHITE)
    d.rounded_rectangle([S * 0.36, S * 0.825, S * 0.64, S * 0.862],
                        radius=int(S * 0.018), fill=GOLD)
    return img


def rounded_icon(size):
    return draw(size * SS).resize((size, size), Image.LANCZOS)


def opaque_icon(size, inner_ratio):
    """不透明滿版，內容縮在安全區內（Android maskable、iOS apple-touch-icon 用）。"""
    S = size * SS
    bg = Image.new("RGBA", (S, S), NAVY)
    n = int(S * inner_ratio)
    inner = draw(n)                      # 圓角與底色同色，貼上後看不出接縫
    off = (S - n) // 2
    bg.paste(inner, (off, off), inner)
    return bg.resize((size, size), Image.LANCZOS).convert("RGB")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    rounded_icon(192).save(f"{OUT}/icon-192.png")
    rounded_icon(512).save(f"{OUT}/icon-512.png")
    opaque_icon(512, 0.76).save(f"{OUT}/icon-maskable-512.png")  # Android 圓形裁切
    opaque_icon(180, 0.94).save(f"{OUT}/apple-touch-icon.png")   # iOS 自己套圓角
    print("圖示已輸出到", OUT)
