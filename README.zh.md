<!-- Copyright 2026 LanEinstein. Licensed under Apache-2.0 (see LICENSE). -->

# Codex Claude Code 插件

[English](./README.md) · **[中文](./README.zh.md)**

> 这是 [`openai/codex-plugin-cc`](https://github.com/openai/codex-plugin-cc) 的 fork,维护者 [LanEinstein](https://github.com/LanEinstein)。新增能力参见 [Fork 新增内容](#fork-新增内容-laneinstein);其他部分与上游保持一致。

在 Claude Code 内部调用 Codex,进行代码审查、任务委派,或让 Codex 以独立顾问角色参与计划与调研。

本插件面向已在使用 Claude Code、希望把 Codex 无缝接入现有工作流的用户。

<video src="./docs/plugin-demo.webm" controls muted playsinline autoplay></video>

## 你能得到什么

- `/codex:review` —— 普通只读的 Codex 代码审查
- `/codex:adversarial-review` —— 可引导的对抗式审查
- `/codex:rescue` / `/codex:status` / `/codex:result` / `/codex:cancel` —— 委派任务与后台作业管理
- **[Fork 新增]** `/codex:consult` —— 在 plan / 调研 / 思考阶段把 Codex 当作独立顾问,Codex 的结构化反馈作为补充信息流入 Claude,Claude 仍是主导者

## 环境要求

- **ChatGPT 订阅(含 Free 档)或 OpenAI API key**
  - 使用会计入 Codex 的用量额度。[了解更多](https://developers.openai.com/codex/pricing)。
- **Node.js 18.18 及以上版本**

## 安装

在 Claude Code 中添加 marketplace:

```bash
/plugin marketplace add LanEinstein/codex-plugin-cc
```

> 如果想使用官方原版,把 `LanEinstein` 换成 `openai` 即可。本 fork 的 package name 与上游一致(`openai-codex`),版本号升至 `1.1.0-consult.1`。

安装插件:

```bash
/plugin install codex@openai-codex
```

重载插件:

```bash
/reload-plugins
```

然后运行:

```bash
/codex:setup
```

`/codex:setup` 会告诉你 Codex 是否就绪。若未安装且 npm 可用,它可以代为安装 Codex。

如果你更愿意手动安装 Codex,使用:

```bash
npm install -g @openai/codex
```

Codex 已安装但尚未登录时运行:

```bash
!codex login
```

安装完成后,你应当看到:

- 下面列出的所有斜杠命令
- `/agents` 里有 `codex:codex-rescue` 与 **`codex:codex-oracle`**(fork 新增)子代理

一个最简单的首次运行:

```bash
/codex:review --background
/codex:status
/codex:result
```

## 使用方法

### `/codex:review`

对当前工作进行标准 Codex 审查。与直接在 Codex 内部运行 `/review` 得到的审查质量一致。

> [!NOTE]
> 多文件变更的代码审查可能耗时较长,建议放到后台运行。

适用场景:

- 审查当前未提交的改动
- 审查你的分支相对于基准分支(如 `main`)的差异

`--base <ref>` 用于分支审查。支持 `--wait` 与 `--background`。本命令不可引导、不接收自定义 focus 文本——需要挑战具体决策或风险领域时请用 [`/codex:adversarial-review`](#codexadversarial-review)。

示例:

```bash
/codex:review
/codex:review --base main
/codex:review --background
```

本命令只读,不会修改任何代码。后台运行时可用 [`/codex:status`](#codexstatus) 查看进度、[`/codex:cancel`](#codexcancel) 取消。

### `/codex:adversarial-review`

运行**可引导**的审查,质疑所选实现与设计。

用于对假设、权衡、失败模式以及"其他方案是否更安全/更简单"进行压力测试。

复用与 `/codex:review` 相同的审查目标选取逻辑,包含 `--base <ref>`,并同样支持 `--wait` / `--background`。与 `/codex:review` 不同,它可以在 flag 之后接受自定义 focus 文本。

适用场景:

- 发布前审查,想挑战方向而非仅细节
- 聚焦设计抉择、权衡、隐藏假设与替代方案
- 针对鉴权、数据丢失、回滚、竞态、可靠性等具体风险的压力测试

示例:

```bash
/codex:adversarial-review
/codex:adversarial-review --base main 质疑当前的缓存与重试策略是否合理
/codex:adversarial-review --background 查找竞态问题并质疑这一方案
```

本命令只读,不修改代码。

### `/codex:rescue`

通过 `codex:codex-rescue` 子代理把任务交给 Codex。

适用场景:

- 调查 bug
- 让 Codex 动手修复
- 继续之前的 Codex 任务
- 切换到更快/更便宜的小模型跑一遍

> [!NOTE]
> 视任务和模型大小,这类任务可能耗时较长,建议强制后台执行,或把代理本身移到后台。

支持 `--background` / `--wait` / `--resume` / `--fresh`。若都未指定,插件会询问是否继续该仓库最近的 rescue 线程。

示例:

```bash
/codex:rescue 调查测试为什么开始失败
/codex:rescue 用最小的安全补丁修复失败用例
/codex:rescue --resume 应用上次运行的首推修复
/codex:rescue --model gpt-5.4-mini --effort medium 调查断断续续的集成测试
/codex:rescue --model spark 快速修复问题
/codex:rescue --background 调查这次回归
```

也可以用自然语言委派任务:

```text
请 Codex 重新设计数据库连接使其更具韧性。
```

**要点:**

- 不传 `--model` 或 `--effort` 时,由 Codex 自选默认
- 说 `spark` 时,插件会映射为 `gpt-5.3-codex-spark`
- 后续的 rescue 请求可以继续该仓库最近的 Codex 任务

### `/codex:consult`(Fork 新增)

在 plan / 调研 / 思考阶段把 Codex 作为**独立顾问**。Claude 仍是主导者,Codex 的结构化 JSON 输出作为补充信息流入 Claude 的决策过程。详见 [Fork 新增内容 → `/codex:consult`](#codexconsult--codex-作为独立顾问)。

### `/codex:status`

显示当前仓库运行中和最近的 Codex 作业。

示例:

```bash
/codex:status
/codex:status task-abc123
```

用途:

- 查看后台工作的进度
- 查看最新完成的作业
- 确认任务是否仍在运行

### `/codex:result`

显示已完成作业的最终存档输出。若有,还会附带 Codex session ID,方便用 `codex resume <session-id>` 直接在 Codex 中重开。

示例:

```bash
/codex:result
/codex:result task-abc123
```

### `/codex:cancel`

取消正在执行的 Codex 后台作业。

示例:

```bash
/codex:cancel
/codex:cancel task-abc123
```

### `/codex:setup`

检查 Codex 是否已安装并登录。未安装且 npm 可用时,可代为安装。

也可用 `/codex:setup` 管理可选的 review gate。

#### 启用 review gate

```bash
/codex:setup --enable-review-gate
/codex:setup --disable-review-gate
```

启用后,插件使用 `Stop` hook 在 Claude 回合结束时对其响应进行定向 Codex 审查;若发现问题,则阻止停止,让 Claude 先处理。

> [!WARNING]
> review gate 可能造成 Claude/Codex 长循环、快速消耗用量。仅在计划主动观察会话时启用。

## 典型流程

### 发布前审查

```bash
/codex:review
```

### 把问题交给 Codex

```bash
/codex:rescue 调查为什么 CI 构建失败
```

### 启动长时间任务

```bash
/codex:adversarial-review --background
/codex:rescue --background 调查断续失败的测试
```

然后用下面的命令跟进:

```bash
/codex:status
/codex:result
```

### Plan 阶段向 Codex 求得补充意见(Fork 新增)

```bash
/codex:consult plan-critique ./docs/my-plan.md
/codex:consult investigate "SQLite 在多进程并发写入下是否安全?"
/codex:consult second-opinion "用 Redis 还是 Postgres 做 1k qps 的持久化任务队列"
```

## Codex 集成

本插件封装了 [Codex app server](https://developers.openai.com/codex/app-server)。它使用你环境中的全局 `codex` 二进制,并[沿用同一份配置](https://developers.openai.com/codex/config-basic)。

### 常见配置

若想修改插件使用的默认推理等级或默认模型,可以在用户级或项目级 `config.toml` 里定义。例如,在项目根目录的 `.codex/config.toml` 中始终使用 `gpt-5.4-mini` / `high`:

```toml
model = "gpt-5.4-mini"
model_reasoning_effort = "high"
```

配置按以下顺序读取:

- 用户级:`~/.codex/config.toml`
- 项目级:`.codex/config.toml`
- 项目级配置仅在[项目被信任](https://developers.openai.com/codex/config-advanced#project-config-files-codexconfigtoml)时加载

更多选项见 [Codex 配置文档](https://developers.openai.com/codex/config-reference)。

### 把工作迁到 Codex 内继续

委派的任务以及任何 [stop gate](#启用-review-gate) 运行都可以通过 `codex resume` 直接在 Codex 内继续——传入 `/codex:result` 或 `/codex:status` 给你的 session ID,或从列表里选。

这样你可以在 Codex 中审查那份工作,或继续推进。

<!-- Fork additions below © 2026 LanEinstein. Licensed under Apache-2.0. -->

## Fork 新增内容 (LanEinstein)

本章节记录 `LanEinstein/codex-plugin-cc` fork 独有的功能。上游的命令与行为保持不变。

### `/codex:consult` —— Codex 作为独立顾问

在 Claude Code 的 plan / 调研 / 思考阶段,把一个具体的咨询问题委派给 Codex。Claude 仍是主导者;Codex 的结构化输出作为**补充信息**流入 Claude,Claude 阅读、权衡并整合进最终计划。

Consult 是**纯咨询性**的:Codex 以 `sandbox: read-only` 运行,在此流程中从不修改文件,`--write` 标志对外不开放。

#### 三种模式

| 模式 | 适用场景 |
|------|----------|
| `plan-critique` | 让 Codex 审阅计划文档:隐藏假设、失败模式、更简方案、具体风险。若 target 是有效文件路径,会读取该文件内容。 |
| `investigate` | 让 Codex 独立调研一个具体问题,作为辅助研究。 |
| `second-opinion` | 就某个决策获取对立视角。结构化输出包含 `disagreements` 数组,显式对比 Claude 的观点与 Codex 的观点。 |

#### 用法

```bash
/codex:consult plan-critique ./path/to/my-plan.md
/codex:consult investigate "SQLite 在多进程并发写入下是否安全?"
/codex:consult second-opinion "用 Redis 还是 Postgres 做 1k qps 的持久化任务队列"
```

#### 可用 flags

| Flag | 默认值 | 作用 |
|------|--------|------|
| `--timeout <seconds>` | `90` | 硬超时。超时后 oracle 优雅跳过(`reason=timeout`)。 |
| `--model <model>` | 自动(Codex 默认) | 覆盖 Codex 模型。支持 `spark` → `gpt-5.3-codex-spark`。 |
| `--effort <level>` | 自动 | 推理等级:`none` / `minimal` / `low` / `medium` / `high` / `xhigh`。 |
| `--context-file <path>` | 无 | 从文件读取补充上下文。`second-opinion` 模式下,用它传入 Claude 的初步观点。 |

本版本只支持前台执行,尚不支持 `--background`。

#### 输出

成功时,consult 向 stdout 输出一个 JSON 对象,符合 [`plugins/codex/schemas/consult-output.schema.json`](./plugins/codex/schemas/consult-output.schema.json):

```json
{
  "mode": "plan-critique",
  "summary": "对当前计划的一段定性评估(ship / no-ship 判断)",
  "confidence": "medium",
  "findings": [
    {
      "title": "...",
      "severity": "high",
      "detail": "...",
      "evidence": "Plan §3.2",
      "suggestion": "重试前先加幂等保护"
    }
  ],
  "disagreements": [],
  "open_questions": []
}
```

Claude 读取这份 JSON,采纳有价值的点、驳回不认同的点,然后精修计划。Codex 的输出是补充信息,不是最终结论。

### `codex-oracle` 子代理

在认为"计划 / 调研 / 决策"值得一次独立意见时,Claude 可以主动召唤 `codex-oracle` 子代理。该子代理是到 `/codex:consult` 的轻量转发——运行在独立上下文里,Codex 的长篇输出不会污染主线对话。

Claude 预计会在以下场景自动召唤:

- 起草非平凡计划且权衡不明朗时
- 调研陌生代码或自己不确定的概念时
- 已有初步观点、想听相反意见时

对于琐碎任务,Claude **不会**召唤它——直接自己处理。

### 优雅降级

当 Codex 不可用时,consult 以 exit code 0 退出,输出一段警告块,以固定 sentinel 开头:

```
> [!WARNING] Codex oracle unavailable — reason: <class>
> <hint> Proceeding without Codex input.
```

Claude 检测到这一 sentinel 后会跳过本次兼听、继续推进。**Consult 不可用永远不会阻塞 Claude 的工作。** 跳过原因分类:

| Reason | 常见原因 | 面向 Claude 的提示 |
|--------|---------|-------------------|
| `auth` | Codex 未登录或 401 | 运行 `/codex:setup` 登录 |
| `quota` | 额度耗尽 / 429 | Codex 用量达上限 |
| `timeout` | `--timeout` 超时前无响应 | 提高 `--timeout` 或稍后重试 |
| `network` | 连接被拒 / DNS 故障 | 检查网络 |
| `not_installed` | Codex CLI 缺失或异常 | 运行 `/codex:setup` 安装 Codex |
| `unknown` | 其他错误 | 参见 detail 行 |

所有跳过路径都以 exit 0 结束——"辅助信号缺失"从 Claude 的视角不是错误。

### 安装本 fork

```bash
/plugin marketplace add LanEinstein/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

本 fork 保留上游包名 `openai-codex`,版本升至 `1.1.0-consult.1`。现有的 `/codex:review`、`/codex:rescue` 等命令与上游完全一致。

### 许可

Apache-2.0,继承自上游。见 [`LICENSE`](./LICENSE) 与 [`NOTICE`](./NOTICE)。

<!-- End fork additions -->

## FAQ

### 本插件需要独立的 Codex 账号吗?

不需要。若你在本机已登录 Codex,这里会直接复用。插件使用你本地的 Codex CLI 认证。

若你平时只用 Claude Code、从未用过 Codex,则需用 ChatGPT 账号或 API key 登录 Codex。[Codex 已包含在 ChatGPT 订阅中](https://developers.openai.com/codex/pricing/),[`codex login`](https://developers.openai.com/codex/cli/reference/#codex-login) 同时支持 ChatGPT 账号与 API key。运行 `/codex:setup` 检查状态,未就绪时用 `!codex login`。

### 插件会不会启动另一个 Codex runtime?

不会。本插件委派到你本机的 [Codex CLI](https://developers.openai.com/codex/cli/) 与 [Codex app server](https://developers.openai.com/codex/app-server/)。

这意味着:

- 使用你直接运行 Codex 时用的同一个 Codex 安装
- 使用同一份本地认证
- 使用同一份仓库检出和机器环境

### 能复用我已有的 Codex 配置吗?

可以。若你已经在使用 Codex,插件会自动读取相同的[配置](#常见配置)。

### 能继续用我现有的 API key 或自定义 base URL 吗?

可以。插件使用本地 Codex CLI,你现有的登录方式和配置仍然生效。

如需把内置 OpenAI provider 指到其他 endpoint,在 [Codex config](https://developers.openai.com/codex/config-advanced/#config-and-state-locations) 中设置 `openai_base_url`。

### Consult 的结构化输出我能信赖到什么程度?

Codex 的输出已按 JSON Schema 约束(`consult-output.schema.json`),大多数情况下会返回结构化 JSON。极少数情况下 Codex 可能忽略 "仅返回 JSON" 的指令而输出散文,此时 consult 会回退为 `{status: "unstructured", raw: "..."}` 的信封,Claude 仍可读到原始内容,只是需要自行解析。即使在回退场景,Claude 也能基于 raw 内容继续工作,不会卡住。

### 如何在我的项目中默认让 Claude 自动兼听 Codex?

本 fork 的默认触发策略是**依赖 Claude 自主判断**(软约束):`codex-oracle` 子代理的 description 提示 Claude 在 plan 阶段主动使用。若你希望更强的约束,可以在项目级 `CLAUDE.md` 或全局 `~/.claude/CLAUDE.md` 里加一条规则,例如"进入 plan 模式并起草初版计划后,调用 ExitPlanMode 之前必须先调用 `codex:codex-oracle` 整合意见再提交"。若软硬约束仍不够,可自行配置 `PreToolUse(ExitPlanMode)` hook 强制拦截(本 fork 默认不启用,以便保持简单)。
