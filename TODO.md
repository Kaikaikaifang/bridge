# Bridge TODO

## P0 — 必须立即修复

- [x] #14 Agent 抛错时用户无反馈 — `handleMessage` 中 `agent.ask()` 无 try/catch，异常传播后用户收到沉默
- [x] #11 `apiPost` 对 sendmessage 超时静默返回 null — long-poll 超时返回 null 是正确的，但 sendMessage 超时应抛错
- [x] #1 配置校验 — `loadConfig` 使用裸 `JSON.parse` + `deepMerge`，无运行时校验，错误配置静默通过

## P1 — 重要，影响生产可用性

- [x] #4 Session 过期处理 — 不区分 session 过期与临时网络抖动，token 失效后无限重试
- [x] #3 `notifyStart`/`notifyStop` 生命周期通知 — 微信服务端不知道 bot 上下线状态
- [x] #5 优雅关停 — SIGINT 不等待 in-flight 请求、不通知微信、不清理临时文件
- [x] #8 Typing 指示器 — Agent 执行期间用户无反馈
- [x] #13 `WeixinChannel.stop()` 延迟生效 — `stop()` 后最长等 38s 才能退出轮询
- [x] #17 Config index signature 破坏类型安全 — `agents.[name: string]: unknown` 弱化了所有 agent 配置的类型

## P2 — 功能完善

- [x] #2 结构化日志 — 全项目 `console.log`，无 level、无持久化、无上下文
- [ ] #7 媒体消息支持 — 只能收发文本，图片/语音/文件全部丢弃
- [ ] #9 Markdown 过滤 — Agent 返回的 markdown 在微信中无法渲染
- [x] #12 `apiGet` 无超时控制 — 可能无限挂起
- [x] #15 Codex 临时文件泄露 — 进程崩溃时残留，并发下文件名冲突
- [x] #18 重复的 `构建Prompt` — 两个 provider 各有一份，变更需同步
- [x] #20 消息去重 — 微信可能重复投递，同一条消息触发两次 Agent
- [x] #27 输入长度限制 — 超长消息直接传给 Agent CLI，可能导致异常

## P3 — 代码质量

- [x] #21 零测试 — 核心逻辑无任何测试覆盖
- [x] #22 中文标识符 — `构建Prompt`/`默认配置` 等影响 grep 和协作
- [x] #23 `FeishuChannel` 死代码 — 每个方法都 throw，误导用户
- [x] #24 硬编码魔数 — `300_000`/`38_000` 等散落各处
- [x] #25 `package-lock.json` 和 `bun.lock` 共存
- [x] #26 手写 `vendor.d.ts` — 应使用社区类型定义
- [ ] #6 API 层缺失 Header — `iLink-App-Id`/`iLink-App-ClientVersion`/`SKRouteTag`
- [ ] #10 单账号限制 — 不支持多微信账号
- [ ] #16 `JsonStore.update` 非原子 — 未来并发使用可能丢数据

## P4 — 统一网关能力

- [x] #28 动态 Agent 注册 — 从硬编码 codex/claude 改为配置驱动的插件系统
- [x] #29 Codebuddy / OpenCode provider — 新增 Codebuddy CLI 和 OpenCode 适配器
- [x] #30 CLI 通道 — 终端 REPL 交互模式，统一 CLI 入口
- [x] #31 `/agents` 命令 — 列出所有可用 Agent，含当前标记
- [x] #32 `/help` 命令 — 显示可用命令列表
- [ ] #33 智能路由 — 按任务类型/成本/能力自动选择最优 Agent
- [ ] #34 用量聚合 — 统一展示各 Agent 的 rate limit / token 余量
- [ ] #35 跨 Agent 上下文桥接 — 切换 Agent 时保留对话摘要
