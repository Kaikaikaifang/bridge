# Agent Bridge

Agent Bridge 是一个轻量的「多通讯软件 ↔ 多命令行 Agent」桥接器，同时提供统一的 CLI 入口。

目标是让微信、飞书等通讯软件里的消息，或者终端中的交互输入，可以安全地路由到本机的 Codex、Claude Code、Codebuddy、OpenCode 等命令行工具，并把最终回复发回原会话。

## 设计目标

- **多对多**：一个 Channel 可以选择不同 Agent，一个 Agent 也可被多个 Channel 复用。
- **统一入口**：除了微信/飞书，还提供 CLI 交互模式，作为所有 Agent 的统一终端入口。
- **轻量**：不依赖 OpenClaw 这类完整网关框架，先保证本机可运行、可理解、可扩展。
- **安全默认值**：默认只读沙箱、用户白名单、单会话串行、执行超时。
- **插件化**：通讯软件与命令行工具都通过统一接口接入。新增 Agent 只需在配置中添加一行。

## 当前状态

- Channel：`weixin` 初始可用骨架；`feishu` 预留适配器；`cli` 终端交互模式。
- Agent：`codex`、`claude`、`codebuddy`、`opencode` 适配器；`generic` 通用适配器支持任意 CLI。
- 消息类型：先支持文本消息。
- 媒体：后续在 Channel 层和 Agent 入参中扩展。

## 快速开始

### CLI 交互模式（推荐）

```bash
cd bridge
npm install

# 直接进入 CLI 交互模式，使用默认 Agent
npm run dev -- chat

# 指定 Agent
npm run dev -- chat --agent claude
npm run dev -- chat --agent codebuddy
```

### 微信通道

```bash
npm run dev -- run --channel weixin --agent codex
```

首次运行微信通道时，会展示二维码。扫码成功后，登录信息会保存到 `~/.agent-bridge`。

## 配置

配置文件默认位置：`~/.agent-bridge/config.json`。

也可以复制示例：

```bash
mkdir -p ~/.agent-bridge
cp examples/config.example.json ~/.agent-bridge/config.json
```

示例：

```json
{
  "defaultChannel": "cli",
  "defaultAgent": "codex",
  "workspace": "~/agent-bridge-workspace",
  "allowUsers": [],
  "allowedWorkspaceRoots": ["~/projects", "~/agent-bridge-workspace"],
  "agents": {
    "codex": {
      "command": "codex",
      "sandbox": "read-only",
      "approval": "never"
    },
    "claude": {
      "command": "claude",
      "model": "sonnet",
      "permissionMode": "dontAsk"
    },
    "codebuddy": {
      "command": "codebuddy",
      "permissionMode": "dontAsk"
    },
    "opencode": {
      "command": "opencode"
    },
    "my-custom-tool": {
      "type": "generic",
      "command": "my-ai-tool",
      "stdinPrompt": true
    }
  },
  "channels": {
    "weixin": {
      "baseUrl": "https://ilinkai.weixin.qq.com",
      "botType": "3"
    },
    "feishu": {
      "enabled": false
    },
    "cli": {
      "prompt": "bridge> ",
      "history": true
    }
  }
}
```

### Agent 配置

每个 Agent 通过配置键名自动推断类型。如果键名是 `codex`、`claude`、`codebuddy`、`opencode`，会自动使用对应的适配器。其他键名需要显式指定 `type` 字段。

| 字段 | 说明 | 适用类型 |
|------|------|----------|
| `type` | 适配器类型：codex/claude/codebuddy/opencode/generic | 全部 |
| `command` | CLI 命令名或完整路径 | 全部 |
| `model` | 模型标识 | 全部 |
| `timeoutMs` | 执行超时（毫秒） | 全部 |
| `extraArgs` | 额外 CLI 参数 | 全部 |
| `enabled` | 是否启用，默认 true | 全部 |
| `sandbox` | 沙箱模式：read-only/workspace-write/danger-full-access | codex |
| `approval` | 审批模式：untrusted/on-request/never/on-failure | codex |
| `permissionMode` | 权限模式：default/acceptEdits/bypassPermissions/dontAsk/plan/auto | claude, codebuddy |
| `tools` | 工具集 | claude |
| `provider` | 模型提供商 | opencode |
| `promptArg` | 传入 prompt 的 flag 名 | generic |
| `cwdArg` | 传入工作目录的 flag 名 | generic |
| `modelArg` | 传入模型的 flag 名 | generic |
| `stdinPrompt` | 是否通过 stdin 传入 prompt | generic |
| `outputPattern` | 从 stdout 提取结果的正则 | generic |

### 如何获取用户 ID（微信通道）

首次接入时，可以先保持 `allowUsers` 为空，然后用微信给 Bot 发一条消息。

Bridge 会拒绝执行 Agent，但会在终端和微信回复里显示用户 ID：

```text
你的用户 ID：xxxxxx@im.wechat
```

把这个 ID 加入 `allowUsers` 后重启即可：

```json
{
  "allowUsers": ["xxxxxx@im.wechat"]
}
```

注意：这个 ID 不是微信号，也不是昵称，而是 iLink 消息里的 `from_user_id`。

## 聊天内置命令

- `/help`：显示帮助信息。
- `/status`：查看当前会话状态。
- `/agents`：列出所有可用 Agent。
- `/agent codex`：把当前会话切到 Codex。
- `/agent claude`：把当前会话切到 Claude Code。
- `/agent codebuddy`：把当前会话切到 Codebuddy。
- `/agent opencode`：把当前会话切到 OpenCode。
- `/cwd /path/to/project`：切换当前会话工作目录。
- `/cwd wiki`：切换到配置 `workspace` 下的 `wiki` 子目录，而不是启动命令所在目录。
- `/reset`：清理当前会话状态。

## 目录结构

```text
src/
  agents/              # 命令行 Agent 抽象与具体适配器
    providers/         # 各 Agent 的具体实现
      codex.ts         # OpenAI Codex CLI
      claude-code.ts   # Anthropic Claude Code CLI
      codebuddy.ts     # Codebuddy CLI
      opencode.ts      # OpenCode CLI
      generic.ts       # 通用 CLI 适配器
  channels/            # 通讯软件通道抽象与具体适配器
    cli/               # 终端交互通道
    weixin/            # 微信通道
    feishu/            # 飞书通道（预留）
  config/              # 配置加载与默认值
  core/                # 桥接调度、路由、内置命令
  storage/             # 本地状态存储
  util/                # 通用工具函数
```

## 安全建议

- 务必配置 `allowUsers`，不要让未知联系人驱动本机 Agent。
- 初期建议 Codex 使用 `read-only` 沙箱。
- 谨慎启用 Claude Code 的 `bypassPermissions` 或 Codex 的 `danger-full-access`。
- 建议把工作目录限制在专门的项目目录，不要直接暴露整个 Home 目录。
