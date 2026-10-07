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
import webbrowser

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(SCRIPT_DIR, "data.json")
STATIC_DIR = os.path.join(SCRIPT_DIR, "static")

PLACEHOLDERS = ["{时间}", "{教室号}", "{老师}"]

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


class ReminderHandler(http.server.BaseHTTPRequestHandler):
    store = JsonStore(DATA_PATH)

    def address_string(self):
        # 避免反向 DNS，本地响应更快
        return self.client_address[0]

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_empty(self, status):
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.end_headers()

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
