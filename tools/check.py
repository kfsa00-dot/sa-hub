#!/usr/bin/env python3
"""部署前檢查。在專案根目錄執行：

    python3 tools/check.py

只用 Python 標準庫，不需要安裝任何套件。檢查項目：
  1. SITES 清單：必填欄位、id 不重複且格式正確、網址是 https
  2. sw.js 預先快取的檔案、manifest 與 index.html 引用的圖示都存在，圖示尺寸正確
  3. 改了 index.html 卻沒把 sw.js 的 VERSION 加一（2026-09 的事故原因）
  4. 用 macOS 內建 jsc 跑 tools/test_sw.js（Service Worker 行為測試）

全部通過結束碼為 0，有任何錯誤為 1。
"""
import json
import os
import re
import struct
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSC = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"

errors, warnings, oks = [], [], []


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        return f.read()


def exists(rel):
    return os.path.isfile(os.path.join(ROOT, rel))


def png_size(rel):
    with open(os.path.join(ROOT, rel), "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", head[16:24])


def git(*args):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    return r.returncode, r.stdout.strip()


def sw_version(text):
    m = re.search(r"const VERSION = '([^']+)';", text)
    return m.group(1) if m else None


# ---------- 1. SITES ----------
def check_sites(html):
    m = re.search(r"const SITES = \[(.*?)\n\];", html, re.S)
    if not m:
        errors.append("index.html 找不到 const SITES = [ ... ];")
        return
    entries = re.findall(r"\{(.*?)\}", m.group(1), re.S)
    ids = []
    for i, body in enumerate(entries, 1):
        fields = dict(re.findall(r"(\w+):\s*'([^']*)'", body))
        label = fields.get("name") or "第 %d 筆" % i
        for key in ("id", "name", "category", "url"):
            if not fields.get(key):
                errors.append("SITES「%s」缺少 %s" % (label, key))
        if "note" not in fields:
            errors.append("SITES「%s」缺少 note（不需要備註請寫 note: ''）" % label)
        sid = fields.get("id", "")
        if sid and not re.fullmatch(r"[a-z][a-z0-9_-]*", sid):
            errors.append("SITES「%s」的 id「%s」只能用英文小寫、數字、-、_" % (label, sid))
        ids.append(sid)
        url = fields.get("url", "")
        if url and not url.startswith("https://"):
            errors.append("SITES「%s」的網址不是 https：%s" % (label, url))
    dup = sorted({x for x in ids if x and ids.count(x) > 1})
    if dup:
        errors.append("SITES 的 id 重複：%s（重複會讓兩張卡片的星號連動）" % ", ".join(dup))
    oks.append("SITES 共 %d 筆，欄位與 id 正常" % len(entries))


# ---------- 2. 檔案與圖示 ----------
def check_files(html, sw):
    before = len(errors)
    m = re.search(r"const ASSETS = \[(.*?)\];", sw, re.S)
    assets = re.findall(r"'\./([^']*)'", m.group(1)) if m else []
    for a in assets:
        if a and not exists(a):
            errors.append("sw.js 預先快取的檔案不存在：%s" % a)

    try:
        manifest = json.loads(read("manifest.webmanifest"))
    except ValueError as e:
        errors.append("manifest.webmanifest 不是合法 JSON：%s" % e)
        return
    for key in ("start_url", "scope"):
        if manifest.get(key) != "./":
            errors.append("manifest 的 %s 應為 \"./\"（GitHub Pages 子路徑）" % key)
    for icon in manifest.get("icons", []):
        rel = icon["src"][2:] if icon["src"].startswith("./") else icon["src"]
        if not exists(rel):
            errors.append("manifest 圖示不存在：%s" % rel)
            continue
        size = png_size(rel)
        want = tuple(int(x) for x in icon["sizes"].split("x"))
        if size != want:
            errors.append("manifest 圖示 %s 實際尺寸 %s，宣告為 %s" % (rel, size, icon["sizes"]))

    for href in re.findall(r'<link rel="(?:manifest|icon|apple-touch-icon)" href="\./([^"]+)"', html):
        if not exists(href):
            errors.append("index.html 引用的檔案不存在：%s" % href)
    if exists("icons/apple-touch-icon.png"):
        if png_size("icons/apple-touch-icon.png") != (180, 180):
            errors.append("apple-touch-icon.png 應為 180×180")
    if len(errors) == before:
        oks.append("預先快取檔案、manifest 與圖示都存在且尺寸正確")


# ---------- 3. VERSION 規則 ----------
def check_version_rule(sw):
    cur = sw_version(sw)
    if not cur:
        errors.append("sw.js 找不到 const VERSION = '...';")
        return
    code, sha = git("log", "-1", "--format=%H", "-G", "const VERSION", "--", "sw.js")
    if code != 0 or not sha:
        warnings.append("無法從 git 判斷 VERSION 上次修改的版本，略過 VERSION 規則檢查")
        return
    _, old_sw = git("show", "%s:sw.js" % sha)
    if sw_version(old_sw) != cur:
        oks.append("VERSION 已更新為 %s（尚未 commit）" % cur)
        return
    changed, _ = git("diff", "--quiet", sha, "--", "index.html")
    if changed != 0:
        errors.append(
            "index.html 在 VERSION %s 之後被改過，但 VERSION 沒有加一。"
            "請把 sw.js 的 VERSION 改成下一號，否則手機可能一直卡在舊清單。" % cur)
    else:
        oks.append("VERSION %s 與 index.html 一致" % cur)


# ---------- 4. Service Worker 測試 ----------
def run_sw_tests():
    if not os.path.exists(JSC):
        warnings.append("找不到 jsc（非 macOS？），略過 Service Worker 測試")
        return
    r = subprocess.run([JSC, "tools/test_sw.js"], cwd=ROOT, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    if "RESULT: PASS" in out:
        oks.append("Service Worker 測試：" + out.split("RESULT: PASS ")[1].splitlines()[0])
    else:
        errors.append("Service Worker 測試失敗：\n    " + out.replace("\n", "\n    "))


def main():
    html, sw = read("index.html"), read("sw.js")
    check_sites(html)
    check_files(html, sw)
    check_version_rule(sw)
    run_sw_tests()

    for m in oks:
        print("✓ " + m)
    for m in warnings:
        print("! " + m)
    for m in errors:
        print("✗ " + m)
    print()
    print("檢查失敗，請修正後再部署。" if errors else "全部通過，可以部署。")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
