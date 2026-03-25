# claude-hud ✦

A rich, opinionated statusline for [Claude Code](https://claude.ai/code) — forked from [`jarrodwatts/claude-hud`](https://github.com/jarrodwatts/claude-hud) with significant enhancements.

## What it looks like

```
✦ [Sonnet 4.6] │ 📁 MF200  master* [+84 -12] │ ⏱️  46m │ 🧠 Context ████████░░ 82%
📋 1 CLAUDE.md  🔌 12 MCPs  🪝 2 hooks  │  🔧 Read · Edit · Bash · Glob
~chat_input.dart(+47 -3)  ~message_bubble.dart(+12)  ~welcome_scene.dart(+8 -1)  ?3
```

Three information-dense lines, all rendered live in your Claude Code session:

| Line | Content |
|------|---------|
| **1** | Model · Project folder · Git branch + total diff · Session duration · Context usage |
| **2** | CLAUDE.md count · MCP servers · Hooks · Active tools |
| **3** | Modified files sorted by most-recently-edited, with per-file line diffs |

## Enhancements over upstream

### Clickable OSC 8 hyperlinks
Every file, the project folder, and the git branch are **clickable** in terminals that support OSC 8 (Ghostty, iTerm2, WezTerm, Kitty):
- **📁 Project folder** → opens in Finder / file manager
- **`master*`** → opens the branch on GitHub
- **File names** → jump directly to the file

### Rich git file stats
```
~chat_input.dart(+47 -3)  ~message_bubble.dart(+12)  +new_feature.dart  ?3
```
- Modified (`~`), added (`+`), deleted (`-`) with per-type color coding
- Per-file line diffs in parentheses
- Total `[+N -N]` on the project line
- Sorted by **most recently modified** so the files you're actively editing appear first
- Max 6 files shown; overflow shown as `+N more`
- Disappears gracefully if terminal is too narrow, wraps to additional lines otherwise

### Visual length fix for OSC 8
Upstream's line-wrapping logic counted invisible OSC 8 URL bytes as visible characters, causing other HUD elements (Context bar, duration) to be pushed off-screen. This fork fixes the ANSI escape regex to also strip OSC 8 sequences before measuring line width.

### Emoji config labels
```
📋 1 CLAUDE.md  🔌 12 MCPs  🪝 2 hooks
```

### 3-line merged layout
- Line 1: `project` + `context` merged side-by-side
- Line 2: `environment` (config counts) + `tools` merged side-by-side
- Line 3: git files (always last, dedicated line)

## Installation

This is a **persistent personal fork** designed to survive upstream plugin updates. It lives at `~/.claude/plugins/claude-hud/src/` and takes priority over the cached plugin version.

### 1. Clone into your Claude plugins directory

```bash
git clone https://github.com/thkbaldpsychologist/claude-hud.git \
  ~/.claude/plugins/claude-hud
```

### 2. Update your `~/.claude/settings.json` statusLine command

```json
{
  "statusLine": {
    "type": "command",
    "command": "bash -c 'custom=\"${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/claude-hud/src/index.ts\"; if [ -f \"$custom\" ]; then exec \"/usr/local/bin/bun\" --env-file /dev/null \"$custom\"; fi'"
  }
}
```

> **Requires [Bun](https://bun.sh)** — `brew install bun`

### 3. Enable file stats in `config.json`

```json
{
  "display": {
    "showTools": true,
    "showAgents": true,
    "showTodos": true,
    "showDuration": true,
    "showConfigCounts": true
  },
  "gitStatus": {
    "showFileStats": true
  }
}
```

The statusline refreshes automatically on every Claude Code prompt.

## Terminal compatibility

| Feature | Ghostty | iTerm2 | WezTerm | Kitty | Terminal.app |
|---------|:-------:|:------:|:-------:|:-----:|:------------:|
| Colors | ✅ | ✅ | ✅ | ✅ | ✅ |
| OSC 8 hyperlinks | ✅ | ✅ | ✅ | ✅ | ❌ |
| Emoji rendering | ✅ | ✅ | ✅ | ✅ | ⚠️ |

## Key files changed from upstream

| File | Change |
|------|--------|
| `src/git.ts` | Added `LineDiff`, `TrackedFile`, per-file stats, total line diff, branch GitHub URL |
| `src/render/lines/project.ts` | Clickable project + branch, total diff, `renderGitFilesLine` with mtime sort |
| `src/render/lines/environment.ts` | Emoji labels, removed duplicate duration |
| `src/render/index.ts` | OSC 8 visual length fix, 3-line merged layout, git files always-last |

## Credits

Built on top of [`jarrodwatts/claude-hud`](https://github.com/jarrodwatts/claude-hud) — go star the original!
