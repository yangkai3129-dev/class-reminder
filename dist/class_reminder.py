#!/usr/bin/env python3
"""class-reminder — 本地上课提醒工具。

运行 `python3 class_reminder.py` 启动本地 HTTP 服务，浏览器自动打开
http://127.0.0.1:8000，提供学生档案的增删改查与 JSON 持久化。
仅依赖 Python 3 标准库。
"""

import argparse
import http.server
import json
import os
import re
import uuid
import webbrowser
from datetime import datetime, timezone

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

    # 首次运行时建立空数据文件，保证 data.json 始终存在
    if not os.path.exists(DATA_PATH):
        JsonStore(DATA_PATH).save(EMPTY_SCHEMA)

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
