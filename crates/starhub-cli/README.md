# 🦀 StarHub Pure Rust CLI & MCP Server (`starhub-cli`)

> Zero Python · Single Binary · Native MCP `2024-11-05` + Skill Integration for `mkafw/StarHub`

## 功能亮点

- **双模统一入口**：同一二进制支持 **Model Context Protocol (Stdio JSON-RPC 2.0)** 与极速 **CLI**。
- **StarHub 23 类智能映射**：完整内置 `src/config/categories.ts` 预设分类（含 AI 短剧五维分类 + 技术栈分类）。
- **Cloudflare D1 云标签双向同步**：通过 `https://stars.qilong.us.ci/api/tags` 与 `/api/repoTags` 读写云端自定义标签。
- **全网检索与四级创作营养卡**：支持 `starhub search` 与 `starhub card owner/repo`。

## 编译安装

```bash
cd crates/starhub-cli
cargo build --release
install -m 755 target/release/starhub ~/.local/bin/starhub
```

## MCP 配置 (`mcp_config.json`)

```json
{
  "mcpServers": {
    "starhub": {
      "command": "/home/daoxuan/.local/bin/starhub",
      "args": ["--mcp"],
      "disabled": false
    }
  }
}
```
