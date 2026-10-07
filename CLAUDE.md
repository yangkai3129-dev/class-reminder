<!-- GSD:project-start source:PROJECT.md -->
## Project

**class-reminder**

给教培机构全职同事用的本地小工具：为每个学生/班级建一份自定义文案的上课提醒模板，每天只需确认或微调「上课时间」「教室号」「老师姓名」三个空，点确认即把完整文案复制到剪贴板，同事手动粘贴进企业微信客户群。形态是"排课脚本式"的本地程序——Python 脚本 + 浏览器界面，不碰微信 API、不是苹果原生 app、无签名无到期。

**Core Value:** 把「每天给每个学生编一条明日上课提醒」从「手敲文案」降到「确认默认值 + 一键复制」——每天几十个学生，每人少花几秒钟、少错一个字。

### Constraints

- **Tech stack**: Python 3 标准库 + 本地 HTTP 服务 + HTML/CSS/JS + JSON 文件存储 — 零第三方依赖、无签名、无到期（像 kebiao-tools）
- **平台**: Mac 优先；数据存本地 JSON 文件，可直接复制给下一位同事
- **UI**: 遵守全局 Apple 设计规范
- **无微信集成**: 不接企业微信/微信任何 API，发送靠手动粘贴
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
