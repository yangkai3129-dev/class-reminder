# Walking Skeleton — class-reminder

**Phase:** 1
**Generated:** 2026-10-07

## Capability Proven End-to-End

A colleague runs `python3 class_reminder.py`, the browser opens the Apple-styled local UI at `http://127.0.0.1:8000`, they create a student/class profile with a name and a template containing the `{时间}`/`{教室号}`/`{老师}` placeholders, see it rendered as a row in the 档案 list, and it persists to `data.json` across restart.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Python 3 stdlib `http.server` (`ThreadingHTTPServer`) + hand-written HTML/CSS/JS. No framework, no npm, no build step | Zero third-party dependencies is a hard constraint (PROJECT.md). Matches the "排课脚本式" local-tool form of the reference project kebiao-tools |
| Data layer | Single `data.json` file next to the script, loaded/saved by a `JsonStore` class using atomic writes (`data.json.tmp` + `os.replace`) | User must be able to copy the data file to another Mac. Atomic write protects against corruption if the process dies mid-write |
| Auth | None. Server binds to `127.0.0.1` only | Single-user local tool. Binding to loopback (not `0.0.0.0`) is the security boundary — no LAN exposure |
| Deployment target | Local Mac. Run command `python3 class_reminder.py` (auto-opens browser via `webbrowser.open`) | No deployment, no signing, no expiry. The "deployment" is the documented local run command |
| Directory layout | Flat project folder: `class_reminder.py` (server + API + store) beside `static/` (`index.html`, `style.css`, `app.js`) and `data.json` (created at runtime, gitignored) | Separating the SPA into `static/` keeps the sizeable Apple-styled UI maintainable, while the whole folder stays copyable to another Mac |

## Stack Touched in Phase 1

- [x] Project scaffold — single `class_reminder.py` + `static/` + `.gitignore` (ignores `data.json`, `__pycache__/`)
- [x] Routing — one HTTP server with real GET/POST/PUT/DELETE routes under `/api/*` and static file serving under `/`
- [x] Database — real read (GET list) AND real write (POST/PUT/DELETE persist to `data.json`)
- [x] UI — interactive editor modal wired to the API (create a profile, see it in the list)
- [x] Deployment — documented local run: `python3 class_reminder.py` → browser at `http://127.0.0.1:8000`

## Out of Scope (Deferred to Later Slices)

- Daily fill (time wheels, room point-select, teacher typing, global toggle) — Phase 2 (FILL-01..04, ROOM-02)
- Copy-to-clipboard confirm dialog + clipboard write — Phase 3 (COPY-01..03)
- Enterprise WeChat API auto-send — never (manual paste only)
- Multi-user / cloud sync — never (v1 single-user local)
- Mobile/tablet UI — v2 (MOBILE-01)
- Batch generation — v2 (BATCH-01)
- Native macOS app / signing — never (user explicitly declined)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: 每日填写 — open a profile → prefill time/room/teacher from last values → adjust via Apple-style wheels/point-select → global toggle for wheel-vs-typing
- Phase 3: 生成与复制 — confirm dialog renders the fully substituted template → 「修改」/「确认复制」 → full text into clipboard
