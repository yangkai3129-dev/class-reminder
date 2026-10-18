#!/usr/bin/env python3
"""class-reminder — 本地上课提醒工具。

运行 `python3 class_reminder.py` 启动本地 HTTP 服务，浏览器自动打开
http://127.0.0.1:8000，提供学生档案的增删改查与 JSON 持久化。
仅依赖 Python 3 标准库。
"""

import argparse
import base64
import glob
import hashlib
import http.server
import io
import json
import os
import re
import shutil
import sqlite3
import ssl
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import uuid
import webbrowser
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "data.json")
STATIC_DIR = os.path.join(SCRIPT_DIR, "static")

PLACEHOLDERS = ["{时间}", "{教室号}", "{教师}"]

# URL → 文件 的静态路由白名单（防路径穿越：绝不把用户路径拼进文件系统）
STATIC_ROUTES = {
    "/": "index.html",
    "/index.html": "index.html",
    "/style.css": "style.css",
    "/app.js": "app.js",
}

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}

EMPTY_SCHEMA = {"profiles": [], "rooms": []}

# 首次运行时预置的教室名单（更新包不再携带 data.json，避免覆盖同事数据）
DEFAULT_ROOMS = [
    {"id": "r_seed_%s" % n, "number": n, "category": "class"}
    for n in [
        "2801", "2802", "2804", "2805", "2806", "2807", "2808", "2809", "2810",
        "2811", "2812", "2813", "2814", "2815", "2816", "2817", "2818",
        "2821", "2822", "2823", "2824",
    ]
] + [
    {"id": "r_seed_v%02d" % i, "number": "V%02d" % i, "category": "vip"}
    for i in range(1, 41)
]


class JsonStore:
    """data.json 的读写封装，save 用原子写（tmp + os.replace）防损坏。"""

    def __init__(self, path):
        self.path = path

    def load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return dict(EMPTY_SCHEMA)
        if not isinstance(data, dict):
            return dict(EMPTY_SCHEMA)
        return {
            "profiles": data.get("profiles") or [],
            "rooms": data.get("rooms") or [],
        }

    def save(self, data):
        tmp_path = self.path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, self.path)


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat()


def new_profile(name, template):
    now = now_iso()
    return {
        "id": "p_" + uuid.uuid4().hex[:12],
        "name": name,
        "template": template,
        "last_time": "",
        "last_room": "",
        "last_teacher": "",
        "created_at": now,
        "updated_at": now,
    }


def validate_profile(body):
    """校验并清洗档案输入，返回 (name, template, error)。合法时 error 为 None。"""
    if not isinstance(body, dict):
        return None, None, "模板里至少要有一个占位符（{时间}、{教室号} 或 {教师}）。"
    name = body.get("name")
    template = body.get("template")
    if not isinstance(name, str):
        name = str(name) if name is not None else ""
    if not isinstance(template, str):
        template = str(template) if template is not None else ""
    name = name.strip()
    if not name:
        return None, None, "学生/班级名称不能为空。"
    if not any(p in template for p in PLACEHOLDERS):
        return None, None, "模板里至少要有一个占位符（{时间}、{教室号} 或 {教师}）。"
    return name, template, None


def new_room(number, category):
    return {
        "id": "r_" + uuid.uuid4().hex[:12],
        "number": number,
        "category": category,
    }


def validate_room(body):
    """校验并清洗教室输入，返回 (number, category, error)。合法时 error 为 None。"""
    if not isinstance(body, dict):
        return None, None, "教室号不能为空。"
    number = body.get("number")
    category = body.get("category")
    if not isinstance(number, str):
        number = str(number) if number is not None else ""
    number = number.strip()
    if not number:
        return None, None, "教室号不能为空。"
    if category not in ("class", "vip"):
        return None, None, "教室类型无效。"
    return number, category, None


def validate_fill(body):
    """校验并清洗填写输入，返回 (last_time, last_room, last_teacher, error)。合法时 error 为 None。"""
    if not isinstance(body, dict):
        return None, None, None, "时间格式不正确，例如 9:00。"
    last_time = body.get("last_time")
    last_room = body.get("last_room")
    last_teacher = body.get("last_teacher")
    if not isinstance(last_time, str):
        last_time = str(last_time) if last_time is not None else ""
    if not isinstance(last_room, str):
        last_room = str(last_room) if last_room is not None else ""
    if not isinstance(last_teacher, str):
        last_teacher = str(last_teacher) if last_teacher is not None else ""
    last_time = last_time.strip()
    last_room = last_room.strip()
    last_teacher = last_teacher.strip()
    if last_time:
        m = re.match(r"^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$", last_time)
        if not m:
            return None, None, None, "时间格式不正确，例如 9:00。"
        h1, m1, h2, m2 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        if h1 > 23 or m1 > 59 or h2 > 23 or m2 > 59:
            return None, None, None, "时间格式不正确，例如 9:00。"
        if h1 * 60 + m1 >= h2 * 60 + m2:
            return None, None, None, "开始时间不能晚于结束时间。"
    return last_time, last_room, last_teacher, None


def validate_import(body):
    """校验导入数据，返回 (data, error)。合法时 error 为 None。"""
    if not isinstance(body, dict):
        return None, "数据格式不正确。"
    profiles = body.get("profiles")
    rooms = body.get("rooms")
    if not isinstance(profiles, list) or not isinstance(rooms, list):
        return None, "数据格式不正确。"
    clean_profiles = []
    for p in profiles:
        if not isinstance(p, dict) or not isinstance(p.get("name"), str) or not isinstance(p.get("template"), str):
            return None, "档案数据格式不正确。"
        p = dict(p)
        if not isinstance(p.get("id"), str) or not p["id"]:
            p["id"] = "p_" + uuid.uuid4().hex[:12]
        clean_profiles.append(p)
    clean_rooms = []
    for r in rooms:
        if not isinstance(r, dict) or not isinstance(r.get("number"), str) or r.get("category") not in ("class", "vip"):
            return None, "教室数据格式不正确。"
        r = dict(r)
        if not isinstance(r.get("id"), str) or not r["id"]:
            r["id"] = "r_" + uuid.uuid4().hex[:12]
        clean_rooms.append(r)
    return {"profiles": clean_profiles, "rooms": clean_rooms}, None


# ---------- 课表解析（金山文档导出的 xlsx，零第三方依赖） ----------

_XLSX_MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_XLSX_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_XLSX_PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def _cell_ref_rc(ref):
    """A1 坐标 → (行, 列)，行列均从 1 起。"""
    m = re.match(r"^([A-Z]+)(\d+)$", ref)
    if not m:
        return None
    col = 0
    for ch in m.group(1):
        col = col * 26 + (ord(ch) - ord("A") + 1)
    return int(m.group(2)), col


def _uncompress_time(s):
    """还原排课工具 build_period 压缩的时间片段：'1330'→'13:30'、'15'→'15:00'。"""
    s = s.strip()
    if not s:
        return ""
    if len(s) <= 2:
        hh, mm = int(s), 0
    else:
        hh, mm = int(s[:-2]), int(s[-2:])
    return "%02d:%02d" % (hh, mm)


def _uncompress_period(text):
    """'1330-15' → '13:30-15:00'；非标准格式原样返回。"""
    text = text.strip()
    parts = text.split("-")
    if len(parts) != 2:
        return text
    return "%s-%s" % (_uncompress_time(parts[0]), _uncompress_time(parts[1]))


def _room_label(value):
    """'2816（8）'→'2816'、'V05（4 移动电视）'→'V05'；其余（远程/梦想自习区等）原样。"""
    s = str(value or "").strip()
    m = re.match(r"^(V\d+|28\d+)(（.*）)?$", s)
    return m.group(1) if m else s


def _read_xlsx_sheet_names(raw):
    """返回 xlsx 里所有工作表名（按顺序）。"""
    zf = zipfile.ZipFile(io.BytesIO(raw))
    try:
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        return [s.get("name") for s in wb.iter("{%s}sheet" % _XLSX_MAIN_NS)]
    finally:
        zf.close()


def _read_xlsx_sheet(raw, sheet_index=0):
    """用标准库读 xlsx 的第 sheet_index 个表，返回 (grid, max_row, max_col, sheet_name)。
    grid 是 {(行, 列): 字符串}，行列均从 1 起。"""
    zf = zipfile.ZipFile(io.BytesIO(raw))
    try:
        shared = []
        try:
            sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in sst.iter("{%s}si" % _XLSX_MAIN_NS):
                shared.append("".join(t.text or "" for t in si.iter("{%s}t" % _XLSX_MAIN_NS)))
        except KeyError:
            pass
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        sheets = [
            (s.get("name"), s.get("{%s}id" % _XLSX_REL_NS))
            for s in wb.iter("{%s}sheet" % _XLSX_MAIN_NS)
        ]
        rel_map = {}
        try:
            rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
            for rel in rels.iter("{%s}Relationship" % _XLSX_PKG_REL_NS):
                rel_map[rel.get("Id")] = rel.get("Target")
        except KeyError:
            pass
        if not sheets or sheet_index >= len(sheets):
            raise ValueError("课表文件里没有对应的工作表")
        target = rel_map.get(sheets[sheet_index][1])
        if not target:
            target = "xl/worksheets/sheet1.xml"
        elif target.startswith("/"):
            target = target.lstrip("/")
        else:
            target = "xl/" + target.lstrip("/")
        try:
            root = ET.fromstring(zf.read(target))
        except KeyError:
            candidates = [n for n in zf.namelist() if re.match(r"^xl/worksheets/sheet\d+\.xml$", n)]
            root = ET.fromstring(zf.read(candidates[0]))
        grid = {}
        max_row = max_col = 0
        for c in root.iter("{%s}c" % _XLSX_MAIN_NS):
            ref = c.get("r")
            rc = _cell_ref_rc(ref) if ref else None
            if not rc:
                continue
            r, col = rc
            t = c.get("t")
            val = ""
            if t == "s":
                v = c.find("{%s}v" % _XLSX_MAIN_NS)
                if v is not None and v.text:
                    idx = int(v.text)
                    if 0 <= idx < len(shared):
                        val = shared[idx]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter("{%s}t" % _XLSX_MAIN_NS))
            else:
                v = c.find("{%s}v" % _XLSX_MAIN_NS)
                val = v.text if (v is not None and v.text) else ""
            grid[(r, col)] = val
            max_row = max(max_row, r)
            max_col = max(max_col, col)
        return grid, max_row, max_col, (sheets[sheet_index][0] if sheets else "") or ""
    finally:
        zf.close()


def _parse_schedule_grid(grid, max_row, max_col, valid_rooms):
    """按「三行 + 第 1 行带（助教）括号」解析出 {学生名: [{time, teacher, room}]}。
    教室必须在 valid_rooms（上课提醒的教室名单）里，远程/梦想自习区/其他校区等一律跳过。"""
    result = {}
    for r in range(1, max_row + 1):
        for c in range(1, max_col + 1):
            value = (grid.get((r, c)) or "").strip()
            if not value or value == "上课时段":
                continue
            lines = value.split("\n")
            if len(lines) != 3:
                continue
            line0 = lines[0].strip()
            if "（" not in line0:
                continue
            student = line0[: line0.rfind("（")].strip()
            if not student:
                continue
            teacher = lines[1].strip()
            period = _uncompress_period(lines[2])
            room = "?"
            for rr in range(r - 1, 0, -1):
                if (grid.get((rr, 2)) or "").strip() == "上课时段":
                    room = _room_label(grid.get((rr, c)) or "")
                    break
            if room not in valid_rooms:
                continue
            result.setdefault(student, []).append({"time": period, "teacher": teacher, "room": room})
    return result


def _extract_schedule_date(grid, sheet_name):
    """优先从标题格找「M月D日」，回退到表名「M.D」。"""
    for value in grid.values():
        m = re.search(r"(\d{1,2})月(\d{1,2})日", value)
        if m:
            return "%d月%d日" % (int(m.group(1)), int(m.group(2)))
    m = re.match(r"\s*(\d{1,2})\.(\d{1,2})", sheet_name or "")
    if m:
        return "%d月%d日" % (int(m.group(1)), int(m.group(2)))
    return (sheet_name or "").strip() or "未知日期"


def parse_schedule_xlsx(raw, valid_rooms, month=None, day=None):
    """把 xlsx 字节解析成 {date, schedule, count}。
    给定 month/day 则匹配该日期的工作表，否则读第一个表。"""
    if month is not None and day is not None:
        sheet_names = _read_xlsx_sheet_names(raw)
        idx = _match_sheet_index(sheet_names, month, day)
        if idx is None:
            raise RuntimeError("课表文件里没有 %d月%d日 的工作表" % (month, day))
        grid, max_row, max_col, _ = _read_xlsx_sheet(raw, idx)
        date_label = "%d月%d日" % (month, day)
    else:
        grid, max_row, max_col, sheet_name = _read_xlsx_sheet(raw, 0)
        date_label = _extract_schedule_date(grid, sheet_name)
    schedule = _parse_schedule_grid(grid, max_row, max_col, valid_rooms)
    return {
        "date": date_label,
        "schedule": schedule,
        "count": sum(len(v) for v in schedule.values()),
    }


# ---------- 金山文档直扒（读 Chrome 登录态，零第三方依赖） ----------

KDOCS_SHARE_TOKEN = "cgT4s3LO6JUH"
KDOCS_API_DL = "https://www.kdocs.cn/api/v3/office/file/%s/download" % KDOCS_SHARE_TOKEN
KDOCS_REFERER = "https://www.kdocs.cn/l/%s" % KDOCS_SHARE_TOKEN
_KDOCS_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
             "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")


# ---------- 浏览器登录态读取（Mac/Windows × Chrome/Edge，零第三方依赖） ----------

_AES_SBOX = [
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16,
]
_AES_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d, 0x9a]


def _aes_sub_word(w):
    return [_AES_SBOX[b] for b in w]


def _aes_rot_word(w):
    return [w[1], w[2], w[3], w[0]]


def _aes_key_expansion(key):
    """AES-256：32 字节密钥 → 60 个 4 字节轮密钥字。"""
    nk, nr = 8, 14
    w = [list(key[4 * i:4 * i + 4]) for i in range(nk)]
    for i in range(nk, 4 * (nr + 1)):
        temp = list(w[i - 1])
        if i % nk == 0:
            temp = _aes_sub_word(_aes_rot_word(temp))
            temp[0] ^= _AES_RCON[i // nk - 1]
        elif i % nk == 4:
            temp = _aes_sub_word(temp)
        w.append([w[i - nk][j] ^ temp[j] for j in range(4)])
    return w


def _aes_xt(x):
    return ((x << 1) ^ (0x1b if x & 0x80 else 0)) & 0xff


def _aes256_encrypt_block(key, block):
    """AES-256 加密单个 16 字节块（用于 Windows GCM 的 CTR 密钥流）。"""
    w = _aes_key_expansion(key)
    state = [[block[4 * c + r] for c in range(4)] for r in range(4)]

    def add_round_key(rnd):
        for c in range(4):
            for r in range(4):
                state[r][c] ^= w[4 * rnd + c][r]

    add_round_key(0)
    for rnd in range(1, 14):
        for r in range(4):
            for c in range(4):
                state[r][c] = _AES_SBOX[state[r][c]]
        for r in range(4):
            state[r] = state[r][r:] + state[r][:r]
        for c in range(4):
            a0, a1, a2, a3 = state[0][c], state[1][c], state[2][c], state[3][c]
            state[0][c] = _aes_xt(a0) ^ _aes_xt(a1) ^ a1 ^ a2 ^ a3
            state[1][c] = a0 ^ _aes_xt(a1) ^ _aes_xt(a2) ^ a2 ^ a3
            state[2][c] = a0 ^ a1 ^ _aes_xt(a2) ^ _aes_xt(a3) ^ a3
            state[3][c] = _aes_xt(a0) ^ a0 ^ a1 ^ a2 ^ _aes_xt(a3)
        add_round_key(rnd)
    for r in range(4):
        for c in range(4):
            state[r][c] = _AES_SBOX[state[r][c]]
    for r in range(4):
        state[r] = state[r][r:] + state[r][:r]
    add_round_key(14)
    return bytes(state[r][c] for c in range(4) for r in range(4))


def _mac_v10_key(service, account=None):
    """macOS 钥匙串 → PBKDF2 派生 AES-128 密钥。"""
    cmd = ["security", "find-generic-password", "-w", "-s", service]
    if account:
        cmd = ["security", "find-generic-password", "-w", "-a", account, "-s", service]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
    if proc.returncode != 0:
        raise RuntimeError("读取 %s 钥匙串失败" % service)
    return hashlib.pbkdf2_hmac("sha1", proc.stdout.strip().encode(), b"saltysalt", 1003, 16)


def _mac_decrypt_v10(ciphertext, key, strip):
    """Mac v10 cookie：AES-128-CBC（IV=16 空格）+ 可选剥 32 字节域名哈希。"""
    iv = b" " * 16
    proc = subprocess.run(
        ["openssl", "enc", "-d", "-aes-128-cbc", "-K", key.hex(), "-iv", iv.hex()],
        input=ciphertext, capture_output=True,
    )
    out = proc.stdout
    if out and out[-1] <= 16:
        out = out[:-out[-1]]
    if strip and len(out) > 32:
        out = out[32:]
    return out.decode("latin-1")


def _win_dpapi_decrypt(blob):
    """Windows DPAPI 解密（CryptUnprotectData）。"""
    import ctypes
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    def make_blob(data):
        buf = ctypes.create_string_buffer(data, len(data))
        return DATA_BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))

    data_in = make_blob(blob)
    data_out = DATA_BLOB()
    if not ctypes.windll.crypt32.CryptUnprotectData(
            ctypes.byref(data_in), None, None, None, None, 0, ctypes.byref(data_out)):
        raise RuntimeError("DPAPI 解密失败")
    result = ctypes.string_at(data_out.pbData, data_out.cbData)
    ctypes.windll.kernel32.LocalFree(data_out.pbData)
    return result


def _win_aes_key(local_state_path):
    """从 Windows 浏览器的 Local State 取 AES-256 密钥（base64 'DPAPI'+blob）。"""
    with open(local_state_path, "rb") as f:
        state = json.load(f)
    key_b64 = state.get("os_crypt", {}).get("encrypted_key", "")
    if not key_b64:
        raise RuntimeError("Local State 里没有加密密钥")
    blob = base64.b64decode(key_b64)[5:]
    return _win_dpapi_decrypt(blob)


def _win_decrypt_v10(ciphertext, key, strip):
    """Windows v10 cookie：AES-256-GCM，只做 CTR 解密（不验 tag）。"""
    nonce = ciphertext[:12]
    ct = ciphertext[12:-16]
    ks = b""
    ctr = 2
    for i in range(0, len(ct), 16):
        ks += _aes256_encrypt_block(key, nonce + ctr.to_bytes(4, "big"))
        ctr += 1
    out = bytes(a ^ b for a, b in zip(ct, ks))
    if strip and len(out) > 32:
        out = out[32:]
    return out.decode("latin-1")


def _open_cookie_db(db_path):
    """打开 cookie DB：优先只读直连（浏览器锁文件时也能读），失败则复制到临时文件。
    返回 (conn, tmp_path)，只读直连时 tmp_path 为 None。"""
    try:
        uri = Path(db_path).absolute().as_uri()
        for options in ("?mode=ro", "?mode=ro&nolock=1", "?mode=ro&immutable=1"):
            try:
                conn = sqlite3.connect(uri + options, uri=True)
                conn.execute("select 1 from sqlite_master").fetchone()
                return conn, None
            except sqlite3.OperationalError:
                try:
                    conn.close()
                except Exception:
                    pass
    except Exception:
        pass
    tmp = os.path.join(tempfile.gettempdir(), "cr_cookie_%s.db" % os.getpid())
    shutil.copy2(db_path, tmp)
    return sqlite3.connect(tmp), tmp


def _read_cookie_db(conn, key, mode):
    """通用：读已打开的 cookie 连接，按 mode（mac/win）解密 kdocs.cn cookie。"""
    try:
        strip = True
        try:
            row = conn.execute('SELECT value FROM meta WHERE key="version"').fetchone()
            strip = bool(row) and int(row[0]) >= 24
        except sqlite3.OperationalError:
            pass
        cookies = {}
        for name, enc in conn.execute(
                "SELECT name, encrypted_value FROM cookies WHERE host_key LIKE '%kdocs%'"):
            if not isinstance(enc, bytes) or enc[:3] != b"v10":
                continue
            if mode == "mac":
                cookies[name] = _mac_decrypt_v10(enc[3:], key, strip)
            else:
                cookies[name] = _win_decrypt_v10(enc[3:], key, strip)
        return cookies
    finally:
        conn.close()


def _cookie_dbs(app_dir):
    """返回某浏览器数据目录下所有可能的 cookie 文件路径（Default + Profile *）。"""
    dbs = []
    for profile in [os.path.join(app_dir, "Default")] + glob.glob(os.path.join(app_dir, "Profile *")):
        for sub in ("", "Network"):
            p = os.path.join(profile, sub, "Cookies")
            if os.path.exists(p):
                dbs.append(p)
    return dbs


def _read_browser_kdocs_cookies():
    """按顺序尝试 Chrome、Edge，返回第一个能读到 kdocs cookie 的 {name: value}。"""
    if sys.platform == "darwin":
        browsers = [
            ("Chrome", "Chrome Safe Storage", None,
             os.path.expanduser("~/Library/Application Support/Google/Chrome")),
            ("Edge", "Microsoft Edge Safe Storage", "Microsoft Edge",
             os.path.expanduser("~/Library/Application Support/Microsoft Edge")),
        ]
        for name, service, account, app_dir in browsers:
            if not os.path.isdir(app_dir):
                continue
            for db in _cookie_dbs(app_dir):
                tmp = None
                try:
                    key = _mac_v10_key(service, account)
                    conn, tmp = _open_cookie_db(db)
                    cookies = _read_cookie_db(conn, key, "mac")
                except Exception:
                    cookies = {}
                finally:
                    if tmp:
                        try:
                            os.unlink(tmp)
                        except OSError:
                            pass
                if cookies:
                    return cookies
        return {}
    elif sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA", "")
        browsers = [
            ("Chrome", os.path.join(base, "Google", "Chrome", "User Data")),
            ("Edge", os.path.join(base, "Microsoft", "Edge", "User Data")),
        ]
        for name, app_dir in browsers:
            if not os.path.isdir(app_dir):
                continue
            local_state = os.path.join(app_dir, "Local State")
            if not os.path.exists(local_state):
                continue
            for db in _cookie_dbs(app_dir):
                tmp = None
                try:
                    key = _win_aes_key(local_state)
                    conn, tmp = _open_cookie_db(db)
                    cookies = _read_cookie_db(conn, key, "win")
                except Exception:
                    cookies = {}
                finally:
                    if tmp:
                        try:
                            os.unlink(tmp)
                        except OSError:
                            pass
                if cookies:
                    return cookies
        return {}
    return {}


def _ssl_context():
    """构造 HTTPS 上下文，优先用系统 CA 证书（避免未装 certifi 时校验失败）。"""
    for cafile in (os.environ.get("SSL_CERT_FILE"), "/etc/ssl/cert.pem"):
        if cafile and os.path.exists(cafile):
            try:
                return ssl.create_default_context(cafile=cafile)
            except Exception:
                pass
    return ssl.create_default_context()


def _kdocs_download_raw():
    """用浏览器登录态下载金山文档整本 xlsx，返回原始字节。"""
    cookies = _read_browser_kdocs_cookies()
    if not cookies:
        raise RuntimeError(
            "读不到金山登录信息：新版 Chrome/Edge 用 v20 加密，自动抓取暂不支持，"
            "请点「手动选择文件」导入（从金山导出 xlsx 再选）；或先确认已用 Chrome/Edge 登录金山文档"
        )
    cookie_header = "; ".join("%s=%s" % (k, v) for k, v in cookies.items())
    ctx = _ssl_context()
    req = urllib.request.Request(KDOCS_API_DL, headers={
        "User-Agent": _KDOCS_UA, "Referer": KDOCS_REFERER,
        "Accept": "application/json", "Cookie": cookie_header,
    })
    with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
        info = json.loads(resp.read().decode("utf-8"))
    dl_url = info.get("download_url") or info.get("url")
    if not dl_url:
        raise RuntimeError("获取下载链接失败，可能未登录金山文档或链接已失效")
    req2 = urllib.request.Request(dl_url, headers={"User-Agent": _KDOCS_UA})
    with urllib.request.urlopen(req2, timeout=60, context=ctx) as resp2:
        return resp2.read()


def _match_sheet_index(sheet_names, month, day):
    """在表名里找日期前缀为 M.D 的 sheet，返回下标（找不到返回 None）。"""
    for i, name in enumerate(sheet_names):
        m = re.match(r"^(\d{1,2})\.(\d{1,2})", (name or "").strip())
        if m and int(m.group(1)) == month and int(m.group(2)) == day:
            return i
    return None


def fetch_schedule(valid_rooms, month, day):
    """从金山文档直接扒指定日期的课表并解析，返回 {date, schedule, count}。"""
    raw = _kdocs_download_raw()
    sheet_names = _read_xlsx_sheet_names(raw)
    idx = _match_sheet_index(sheet_names, month, day)
    if idx is None:
        raise RuntimeError("课表里没有 %d月%d日 的工作表" % (month, day))
    grid, max_row, max_col, _ = _read_xlsx_sheet(raw, idx)
    schedule = _parse_schedule_grid(grid, max_row, max_col, valid_rooms)
    return {
        "date": "%d月%d日" % (month, day),
        "schedule": schedule,
        "count": sum(len(v) for v in schedule.values()),
    }


class ReminderHandler(http.server.BaseHTTPRequestHandler):
    store = JsonStore(DATA_PATH)

    def address_string(self):
        # 避免反向 DNS，本地响应更快
        return self.client_address[0]

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_empty(self, status):
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def _read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def _read_raw_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return b""
        return self.rfile.read(length)

    def _serve_static(self, path):
        filename = STATIC_ROUTES.get(path)
        if filename is None:
            self._send_json(404, {"error": "Not Found"})
            return
        filepath = os.path.join(STATIC_DIR, filename)
        try:
            with open(filepath, "rb") as f:
                content = f.read()
        except OSError:
            self._send_json(404, {"error": "Not Found"})
            return
        ctype = CONTENT_TYPES.get(os.path.splitext(filename)[1], "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/profiles":
            self._send_json(200, {"profiles": self.store.load()["profiles"]})
        elif path == "/api/rooms":
            self._send_json(200, {"rooms": self.store.load()["rooms"]})
        elif path == "/api/export":
            self._send_json(200, self.store.load())
        elif path == "/api/fetch-schedule":
            query = urllib.parse.parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
            date_str = (query.get("date") or [""])[0]
            m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", date_str)
            if not m:
                self._send_json(400, {"error": "日期格式不正确"})
                return
            try:
                rooms = self.store.load()["rooms"]
                valid_rooms = {r.get("number") for r in rooms if isinstance(r, dict) and r.get("number")}
                if not valid_rooms:
                    valid_rooms = {r["number"] for r in DEFAULT_ROOMS}
                result = fetch_schedule(valid_rooms, int(m.group(2)), int(m.group(3)))
            except Exception as e:
                self._send_json(400, {"error": "自动抓取课表失败：" + str(e)})
                return
            self._send_json(200, result)
        else:
            self._serve_static(path)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/profiles":
            body = self._read_body()
            name, template, err = validate_profile(body)
            if err:
                self._send_json(400, {"error": err})
                return
            profile = new_profile(name, template)
            data = self.store.load()
            data["profiles"].append(profile)
            self.store.save(data)
            self._send_json(201, {"profile": profile})
        elif path == "/api/rooms":
            body = self._read_body()
            number, category, err = validate_room(body)
            if err:
                self._send_json(400, {"error": err})
                return
            room = new_room(number, category)
            data = self.store.load()
            data["rooms"].append(room)
            self.store.save(data)
            self._send_json(201, {"room": room})
        elif path == "/api/import":
            body = self._read_body()
            data, err = validate_import(body)
            if err:
                self._send_json(400, {"error": err})
                return
            self.store.save(data)
            self._send_json(200, data)
        elif path == "/api/import-schedule":
            raw = self._read_raw_body()
            try:
                rooms = self.store.load()["rooms"]
                valid_rooms = {r.get("number") for r in rooms if isinstance(r, dict) and r.get("number")}
                if not valid_rooms:
                    valid_rooms = {r["number"] for r in DEFAULT_ROOMS}
                query = urllib.parse.parse_qs(self.path.split("?", 1)[1]) if "?" in self.path else {}
                date_str = (query.get("date") or [""])[0]
                m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})$", date_str)
                month, day = (int(m.group(2)), int(m.group(3))) if m else (None, None)
                result = parse_schedule_xlsx(raw, valid_rooms, month, day)
            except Exception as e:
                self._send_json(400, {"error": "无法解析这个课表文件：" + str(e)})
                return
            self._send_json(200, result)
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_PUT(self):
        path = self.path.split("?", 1)[0]
        prefix = "/api/profiles/"
        if path.startswith(prefix):
            profile_id = path[len(prefix):]
            if profile_id.endswith("/fill"):
                profile_id = profile_id[: -len("/fill")]
                body = self._read_body()
                last_time, last_room, last_teacher, err = validate_fill(body)
                if err:
                    self._send_json(400, {"error": err})
                    return
                data = self.store.load()
                for profile in data["profiles"]:
                    if profile["id"] == profile_id:
                        profile["last_time"] = last_time
                        profile["last_room"] = last_room
                        profile["last_teacher"] = last_teacher
                        profile["updated_at"] = now_iso()
                        self.store.save(data)
                        self._send_json(200, {"profile": profile})
                        return
                self._send_json(404, {"error": "Not Found"})
                return
            body = self._read_body()
            name, template, err = validate_profile(body)
            if err:
                self._send_json(400, {"error": err})
                return
            data = self.store.load()
            for profile in data["profiles"]:
                if profile["id"] == profile_id:
                    profile["name"] = name
                    profile["template"] = template
                    profile["updated_at"] = now_iso()
                    self.store.save(data)
                    self._send_json(200, {"profile": profile})
                    return
            self._send_json(404, {"error": "Not Found"})
        elif path.startswith("/api/rooms/"):
            room_id = path[len("/api/rooms/"):]
            body = self._read_body()
            number, category, err = validate_room(body)
            if err:
                self._send_json(400, {"error": err})
                return
            data = self.store.load()
            for room in data["rooms"]:
                if room["id"] == room_id:
                    room["number"] = number
                    room["category"] = category
                    self.store.save(data)
                    self._send_json(200, {"room": room})
                    return
            self._send_json(404, {"error": "Not Found"})
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_DELETE(self):
        path = self.path.split("?", 1)[0]
        prefix = "/api/profiles/"
        if path.startswith(prefix):
            profile_id = path[len(prefix):]
            data = self.store.load()
            for i, profile in enumerate(data["profiles"]):
                if profile["id"] == profile_id:
                    del data["profiles"][i]
                    self.store.save(data)
                    self._send_empty(204)
                    return
            self._send_json(404, {"error": "Not Found"})
        elif path.startswith("/api/rooms/"):
            room_id = path[len("/api/rooms/"):]
            data = self.store.load()
            for i, room in enumerate(data["rooms"]):
                if room["id"] == room_id:
                    del data["rooms"][i]
                    self.store.save(data)
                    self._send_empty(204)
                    return
            self._send_json(404, {"error": "Not Found"})
        else:
            self._send_json(404, {"error": "Not Found"})


def main():
    parser = argparse.ArgumentParser(description="class-reminder 本地上课提醒工具")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-browser", action="store_true", help="启动时不自动打开浏览器")
    args = parser.parse_args()

    # 首次运行时建立数据文件（预置教室名单），保证 data.json 始终存在
    if not os.path.exists(DATA_PATH):
        JsonStore(DATA_PATH).save({"profiles": [], "rooms": DEFAULT_ROOMS})

    server = http.server.ThreadingHTTPServer((args.host, args.port), ReminderHandler)
    url = "http://127.0.0.1:%d" % args.port
    print("class-reminder 已启动：%s" % url)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已退出。")


if __name__ == "__main__":
    main()
