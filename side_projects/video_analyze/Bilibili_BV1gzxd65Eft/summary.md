# DeepSeek Harness 视频系列全 46 讲精要总结

> 来源：B 站 UP「饭饭大王 ouo / 码士集团」《DeepSeek Harness 源码精读》系列（P01–P46）
> 整理时间：2026-11-29
> 整理范围：全部 46 讲；按视频发布顺序划分为五大板块
> 整理口径：以视频画面实证（代码、架构图、拉片帧）为准，口述推断处标注"讲者推断"

---

## 0. 总览：一张图看完 46 讲

| 板块 | 分 P | 主题 | 性质 |
|---|---|---|---|
| **A. 源码精读** | P01–P10 | DeepSeek Harness 内核（插件树、会话、Agent Loop、事件总线、MCP） | 源码 |
| **B. 项目实战** | P11–P20 | 技术选型 + ERP_OPENCLAW 企业级项目（目录、驾驭工程、Planning、文件后端、Multi-Agent） | 项目 |
| **C. Harness 六大核心能力** | P21–P32 | 人工介入 / Sandbox / Skills 自我进化 / Context-Engineering / 用户偏好 / 中间件矩阵 / SSE | 项目 + 源码 |
| **D. AsyncSubAgent** | P33–P36 | 异步子代理 + Agent Protocol Server + 求职 | 项目 |
| **E. 短问答集** | P37–P46 | 10 个高频问题的简短答疑 | 答疑 |

**一句话主线**：从"一条命令跑起来"走到"读懂主循环与事件总线"，再用一个 ERP 采购助手项目把 Harness **六大核心能力**（Planning / 安全且可动态路由的文件后端 / Multi-Agent / 上下文管理 / Skills 渐进式披露与自我进化 / Human-in-the-Loop）逐一落地——其中 **Sandbox 与中间件矩阵**是托住全部六项的基础设施，最后以 AsyncSubAgent 补齐"长任务不阻塞"，用 10 个短问答收尾。

---

## A. 源码精读（P01–P10）：DeepSeek Harness 内核

### P01 Harness 是什么：一条命令跑起来你的第一个 AI 工位（10m）

**一句话定位**：从官网 slogan 讲到两种启动方式，给后续源码精读定下前提——**先把工程跑起来**。

**要点**
- 入口是官网：`deepseek.com/harness`。开发者预览版，面向全球开发者开放测试。
- 唯一前置依赖是 **Node.js**。`npx @deepseek-ai/dsh web` 一条命令跨平台启动（默认端口 3080）。
- 源码安装：`git clone` → `pnpm install` → 构建 → `pnpm dsh web --port 8080`。安装版与源码版要**错开端口**，否则会同时起两个 Harness。
- 启动入口在 `apps/cli/src/bin.ts`，讲者在此加了一行 `running from source` 调试日志用于区分启动方式。
- 时间成本：首次装依赖 2–5 分钟、构建 5–10 分钟、启动 2 分钟内；第二次显著加快。

---

### P02 一切皆插件：四种预设模式怎么选（13m27）

**一句话定位**：用设置页把"一切皆插件"落地，给出四种 Agent 预设的选型口径；末尾给出读源码的方法论框架。

**要点**
- 设计哲学：**所有带 Agent 能力的东西都是插件**——模型、工具、Skills、会话、沙箱、存储、循环、调度、UI 本身；插件之间通过**服务 + 事件**对话、自由拼装。
- 默认 **159 个插件**，每项都能搜、能配。
- 四种 Agent 预设（输入框上方切换）：
  - **标准**：功能最全的编码 Agent，日常开发用它。
  - **PTC**：继承标准 + Code Mode SDK，让模型用一个 TypeScript 程序组合多步操作；适合"需求模糊但明显是长任务"。
  - **极简**：只给 **bash + str_replace_editor** 两个工具，适合做基准测试/压测。
  - **创造**：继承标准 + 运行时检查 + 插件实验 + preset 创作指导。
- 边界规则：预设变更"对此后新建的会话生效，运行中的会话保持它开始时的预设"。
- **模块三问**（读源码的总纲）：
  1. 它声明了什么 `ctx.*` 服务？
  2. 它发出 / 监听什么事件？
  3. 它注册了什么 effect（可逆副作用）？
- 源码阅读路线：`源码入口 → 插件树 → 会话 → prompt 组装 → 工具 → Agent 与主循环(Agent-Loop) → 模型 → END`；其中 Agent-Loop 与模型是**循环体**。
- **插件 ≠ 工具**：插件是"注册了什么能力"，工具是"某次会话实际挂上去、model 能调的"。159 个插件，但一次对话经 prompt 组装后实际可能只有 3 个工具。

---

### P03 读源码第一步：入口在哪、插件树怎么叠三层（7m17）

**一句话定位**：按 P02 的路线落地第一步与第二步——找到 `bin.ts` 入口、看清插件树的三层加载顺序。

**要点**
- 入口的朴素方法：`bin` 目录 = 启动目录，即 `apps/cli/src/bin.ts`。
- `bin.ts` 结构：`readVersion()` → `parseDshArgs(process.argv.slice(2), ...)` → `switch (invocation.mode)` 分派到 `profile` / `plugin` / `dump-config` / `default` 四种模式。
- `profile` 分支：先 `loadLayeredEnv('dsh')` 分层加载 `.env`，再 `runProfile(...)` 按 profile 起插件。
- 插件树**三层加载**，永远后者覆盖前者：
  1. 自身/内置的默认插件集；
  2. `profile` 目录里的插件；
  3. 用户主目录 `~` 下的插件/配置。
- 想覆盖默认行为，不必改源码，在用户目录写一份同 ID 的配置/插件即可。

---

### P04 对话信息藏在哪：session 事件驱动与持久化归属（10m+）

**一句话定位**：读第三个模块 `session`，得到全课第一个"颠覆认知"的结论——**`flush` 不是持久化，会话语义只在内存，落盘是插件的事**。

**要点**
- 会话代码不在 `apps` 里，在 `packages/core/session/src/index.ts`，1000 多行。
- 文件结构顺序：import → 类型/接口声明 → `SessionStorage` 接口 → `interface Events`（把会话事件声明成"事件名 → 回调签名"）→ 工具类型 → 校验与组装函数。
- **四个核心事件**：
  1. `session/created`——创建；
  2. `session/disposed`——销毁/离开 store（只对"已公告创建"的条目触发）；
  3. `session/event`——**追加后广播**（post-commit、fire-and-forget：监听器快照在日志 push 前解析、回调在 push 后运行，观察者抛错只记录、不使 append 失败）；
  4. `session/flush`——**持久化检查点**（awaited parallel durability checkpoint）。
- `session/created` / `disposed` / `event` 都受 `@deepseek-ai/dsh-scope` 的 scope 过滤：agent 级监听器只看得到"经由该 agent context 进入"的会话。
- 最大的认知点：**这些事件全在内存**。`flush` 只打一个**检查点**，**并不落盘**；真正的持久化由**持久化插件**承担（插件列表里能找到名字带 `storage` / `storage-json` 的"持久化三件套"）。
- 为什么要检查点而不是随时存：模型输出可能只到一半，此时落盘会把残缺状态写进去；恢复时从中间状态续接会改变对话规则/思路。所以约定"检查点之后再持久化"。
- 方法论引申：传统读源码的直觉（看到 `flush` 就以为"刷盘了"）会被"一切皆插件"打破——**会话自己只负责内存日志**。

---

### P05 提示词与工具链：像 AOP 一样的三层拦截机制（9m39）

**一句话定位**：落到两个最常被二次开发的插件——`system-prompt`（提示词组装）与 `tools`（工具调用 + 三层 AOP 式拦截）。

**要点**
- 提示词组装位置在 `packages/core/system-prompt`，入口 `src/index.ts`；`system-prompt` 自身也是个插件。
- **Cordis 内核只干一件事：插件的加载、卸载、依赖关系**；其余"模型/工具/技能/会话/沙箱/存储/循环/调度/UI"全是插件。
- **插件 ≠ 工具**：插件是大容器，内部包含若干工具；工具被调用时**一定经过三层拦截**（AOP 式），每层以事件形式暴露：
  - `tools/pre-execute`（before）：`@mode waterfall`，可放行/拒绝/询问。
  - `tools/execute`（executor）：`@mode waterfall`，围绕派发的 timeout/retry/metrics。
  - `tools/post-execute`（after）：`@mode waterfall`，可接受/替换/富化/拦截结果。
- **@mode waterfall** 是 Cordis 的事件模式之一：按注册顺序依次执行，上一环可以把结果传给下一环（`next()` 决定是放行还是替换），与 Java Spring 的 AOP / 拦截器链、Servlet Filter 链思路一致。
- 关键不变量：`exec.signal` 是调用方取消信号，**任何替换层都不能脱开调用方的取消**。

---

### P06 Agent 与 Agent Loop：主循环七步怎么跑起来（10m01）

**一句话定位**：把"一切皆插件"落到最核心的两个插件 `agent` 与 `agent-loop`，解释**为什么要把"智能体是什么"和"智能体的循环怎么跑"拆成两个插件**。

**要点**
- 两个插件：`packages/core/agent/src/index.ts` 与 `packages/core/agent-loop/src/index.ts`。
- **`agent` 插件**定义"智能体是什么"（接口、注册表、agent state、create agent、事件总线）；属于**静态描述层**。
- **`agent-loop` 插件**负责"把这个智能体跑起来"（think → read → write → think → …）；属于**运行时驱动层**。
- 拆开动机（讲者）：一个负责"智能体是什么"的静态描述，一个负责"怎么把它跑起来"的运行时驱动；主循环要能被不同预设（标准 / PTC / 极简 / 创造）复用与替换，不该焊死在智能体定义里。
- Web UI 一次"你能做什么？"对话的轨迹能看到 `Glob → Think → Pwsh → Think → Read → Pwsh → Think → Read`，并显示"3轮·9步 | LLM 1m15s · 工具调用 10.4s | 首 token 平均 1.1s · 103 tok/s | 缓存命中 79% | 输入 149K tok · 输出 6.7K tok"。
- **七步主流程**：
  1. 源码入口 `bin.ts`；
  2. 加载三层插件树（内置 → profile → 用户）；
  3. 日志 + 存储初始化；
  4. 用户在命令行/Web 敲下对话；
  5. 提示词组装（`system-prompt` 插件） + 工具装配（`tools` 插件）；
  6. Agent Loop 主循环：不断 think → 工具执行 → think → …；
  7. LLM 调用（每圈 think 的落点） → Agent 判断"做完了"→ END。

---

### P07 大模型调用怎么实现：抽象适配与环绕事件（10m44）

**一句话定位**：把主循环里每一圈 think 的最终落点——调大模型——拆到 `packages/core/llm`，得到"抽象类适配器 + waterfall 环绕事件"的可插拔结构。

**要点**
- `packages/core/llm` 提供**抽象适配器**（provider/model/reasoningEffort/流式回调等），各家模型（DeepSeek / OpenAI / Anthropic / Ollama / 智谱）是子类实现。
- **抽象类 `LlmAdapter`**：每个供应商（DeepSeek、OpenAI、智谱、通义千问…）实现一个这样的抽象类，把"公共的东西"抽出来；通过 `ctx.llm.registerAdapter(providers, adapter)` 注册。
- **`LlmRuntime extends Service`**：对外暴露 `stream(options: GenerateOptions): AsyncIterable<StreamChunk>`；内部先走 `streamWithRegistration(options, prepared)`，最终落到 `this.ctx.waterfall(this, 'llm/stream', options, () => this.adapterStream(options, prepared))`。
- **`llm/stream` 事件是"环绕每一次流式调用"的 waterfall**，所有模型调用都经过这个单一事件，再调到 `adapterStream`（生成器函数，token 级 delta 流）。
- 这个 waterfall 挂的三大能力（讲者归纳）：**重试机制 / 回放机制 / 路由机制**——全部以监听器形式挂在 `llm/stream` 上，所以换供应商、改重试策略都无需改 LLM 调用源码。
- `PreparedLlmCall` 接口：把"一次调用的 config + adapter registration"一起解析好并**深冻结**，字段包括 `config: LlmCallConfig`、`retryPolicy: ResolvedRetryPolicy`、`context?: LlmModelContext`、`adapterDefaults: LlmCallConfigAdapterDefaults`；"reuse or mismatch fails with `INVALID_PREPARED_CALL`"——保证一次调用的配置与适配器注册**强绑定、不可变**。
- 请求冻结：`buildRequest()` 用 `deepFreeze(structuredClone(...))` 冻结请求，确保"请求到底该不该发出去"经过一系列组装与条件判断。

---

### P08 主循环（回合 turn）× 事件总线（19m43）

**一句话定位**：把 `ReactLoopAgent.turn()` 当"唯一主线"读完——**turn 在外、while 在内**，一切状态变化都落成 `session.append(...)` 事件；再补 `cordis` 的 `waterfall` 事件总线如何把插件串成责任链。

**要点**
- 主循环路径：`packages/core/agent-loop/src/agent.ts`，类 `ReactLoopAgent implements Agent`，246 行 `private async turn(): Promise<boolean>`。
- `turn()` 骨架（帧实证）：
  - 不在运行态就直接抛错（前置守卫）；
  - `signal.throwIfAborted()` 立即检查中断；
  - `const turn = phase.turn + 1` 回合号自增；
  - `session.append('turn/start', { turn })` 写回合开始事件；
  - `while (true) { ... }` 一个回合内可跑 N 个 step；
  - `preStep(target, ...)` 事前决策（认领输入 + 组装提示词）；
  - `step(decision.assembly)` 真正的模型请求 + 工具调用；
  - `finally` 写回合结束 + `reason`。
- **turn 与 step 的关系**（讲者用拳击打比方）：一个"回合"=一场拳击的一局，`step` = 局内出拳；"只要拳速够快、够准，一个回合里打 100 次都行"——所以 **while 在 turn 里面，不是 turn 在 while 里面**。
- `preStep()` 三件事：① 认领输入（从 inbox 取 target）② 组装提示词（system/prompt assembly）③ 瀑布流调用（dispatch + waterfall → decision）。preStep 才是"插件真正插手的地方"。
- `step()` 流式调用模型，每个 chunk 都 `session.append` 落盘，所以"中间这些思考过程全部被持久化了"。
- `buildRequest()` 是"请求到底该不该发出去"的闸门。
- **事件总线**（`vendor/cordis/src/events.ts`）：
  - `parallel(name, ...args)` 并发派发到所有 listener；
  - `emit(name, ...args)` 同步派发；
  - `serial(name, ...args)` 串行派发，直到一个 listener bail；
  - `waterfall(...args)` 把最后一个 dispatch argument 当成 innermost `next`，listener outermost-first，不调 `next()` 就否决整条链（包括内置行为）。
- 默认并发、串行要显式 `serial`。

---

### P09 RAG 答案为什么会"飘"（10m04，纯答疑）

**一句话定位**：学员提问"RAG 智能问答怎么让答案稳定不漂移 + 怎么工程化落地"，讲者给出**向量检索 → 知识图谱（GraphRAG）→ 记忆/MCP** 的加固路径，并用自家"学习助手"的迭代史演示落地节奏。

**要点**
- 问题拆解：① RAG 企业知识库的**基础做法就是向量检索**；② 要让答案稳定，**要加知识图谱（GraphRAG）**。
- 为什么必须加图谱："**不建图谱，大模型始终是概率事件**"——向量只解决"**内容相似**"，"就算概率做到很高，调 1 万次也有 100 次不一样"；图谱补的是"**知识之间的关系**"。
- 举例（课程域）：直播课 27 期 → 课时 0…10 + 标题 + 内容描述 → 建关系（包含、**前置**、并列）。例：学 Redis 哨兵 ⇒ 前置是主从复制 ⇒ 再往前是 Redis 安装；查询走 `prerequisite` 链，"哪个课有哪些章、哪些知识点、之前要先学什么，一目了然"。
- 落地案例「学习助手」：RAG + 知识图谱 + function/finetune 都在用，提问时还做了**记忆增强**。
- 迭代史：需求设计 → **V2 加知识图谱并升级 Harness 架构** → **V3 从 demo 级网页改成对接 Web 协议**，成为正式产品形态 → 用真实学员群灰度测试 → 后续继续加 **MCP**（学员分析、记忆增强、月度学习情况汇总）。
- 方法论（反复强调）：**做智能体不要一上来就做到 90%–95%**，要先与主业务系统联调，一步两步三步迭代。

---

### P10 插件四件套 + MCP 对接（9m53）

**一句话定位**：一次"认知翻转"——**源码精读最难，插件开发最简单**；一个插件的最小形态 = `cordis.yml`（声明）+ `src/index.ts`（四件套），复杂的 MCP 插件也只是"多了 config 和错误映射"。

**要点**
- 插件最小形态 = **两个文件**：`cordis.yml`（声明 `id` + `name`）与 `src/index.ts`（代码入口）。
- **四件套**（`lesson4-example-tool/src/index.ts` 全文实证）：
  1. 固定引入：`import type { Context } from '@deepseek-ai/cordis'` + `import { defineTool } from '@deepseek-ai/dsh-tools'`；
  2. 插件命名：`export const name = 'tool-student-local'`（用于加载诊断）；
  3. 声明硬依赖：`export const inject = ['tools']`（工具必须注册在 `ctx.tools` 上）；
  4. 挂载入口：`export function apply(ctx: Context)`，内部 `ctx.tools.register(defineTool({...}))`；需要配置时签名变成 `apply(ctx, config)`，`config` 来自 `cordis.yml` 的 `config` 字段。
- 注册体五要素：`name / description / parameters / output.schema / execute`——名字、描述、参数、输出、执行逻辑。
- 完全体（MCP 插件，`lesson7-msb-plugin`）：四件套不变，**多出 Config 与错误映射**——`interface Config { url; apiKeyRef; toolCallTimeoutMs }` + 同名 zod schema 运行时校验；`toDiagnostic()` 把协议错误翻成"人话"（401 拒绝 API key、429 限流、406 协议不匹配）。
- MCP 接入细节：用官方 MCP SDK（`Client` + `StreamableHTTPClientTransport`），凭证经 `ctx.credentials.resolve(config.apiKeyRef)` 解析、不进代码；"这个插件只管 config、凭证、命名、错误映射，不管 JSON-RPC 线"。
- 讲者结论：**复杂的插件前面全都一模一样，只是多了一个 config、多了一堆 MCP 端点引入与协议错误诊断**——入口始终是 `apply`。

---

## B. 项目实战（P11–P20）：从选型到 ERP_OPENCLAW 项目

### P11 技术选型的第一性原则：哪些活该交给智能体（10m59）

**一句话定位**：把"第一性原则"落成一张**功能分派表**——一段需求先拆成 CRUD / Agent / RAG / Harness / vibe coding 五个去处，再谈报价。（前 5 分钟是招生暖场，非技术。）

**要点**
- 旧范式（2026 前）：客户说要个系统，就先"教育客户"买现成 SaaS；判断起点是**我有什么产品**。
- 第一性原则：判断起点换成**客户要解决什么问题**。
- **五问分派表**（本节干货核心）：
  1. 哪些功能交给传统的 CRUD 来做；
  2. 哪些功能是用 Agent 来做；
  3. 哪些功能使用 RAG 知识库来做；
  4. 哪些功能要使用 Harness 架构的思想；
  5. 哪些功能可以联通 vibe coding 工具。
- 五问是成本/能力分档：CRUD 最便宜可控；RAG 解决"答得准"；Agent 解决"会动手"；Harness 解决"长时间多步任务能跑完"；vibe coding 解决"根本不值得自己写"。
- 工程判断：**高频、重要的活直接搬进智能体**；以后"后台管理系统 ↔ Harness"对接是常态。

---

### P12 2026 课程全面转向 Harness：企业真实项目怎么练（15m21）

**一句话定位**：课程体系说明会——把"2026 所有新项目一律 Harness 架构"当卖点。（营销性质；时长、期数、薪资均为自述。）

**要点**
- 硬性口径：2026 年 2–3 月内部定调——除老项目维护升级外，"只要写项目，就一定是 Harness 架构"。
- 体系四块：① 应用工具（Claude Code / Codex / Dify / n8n / Coze）② 应用开发（核心 = 开发符合 Harness 架构的智能体：多模态、RAG、工作流、私有化部署）③ 微调与算法 ④ FDE（前沿部署工程师）体系。
- 生态论（与官网"一切皆插件"呼应）：别人做好的插件能满足 80% 业务场景，剩下 20% 做本地化改造与部署。

---

### P13 从课到 offer：私教路径、学员涨薪与内推服务（17m46）

**一句话定位**：私教班售前说明——服务清单、筛选逻辑、4 个学员案例与促销组合。（纯营销/服务介绍，无技术内容；数据全为自述。）

---

### P14 大模型岗位分类和 Harness Agent 项目（18m38）

**一句话定位**：用"2026 年面试官要看多智能体 + Harness 架构"的就业判断，引出本课程的企业级项目 **ERP_OPENCLAW** 的外部依赖全景。

**要点**
- 求职方向二分（讲者主观分类）：① 大模型研究方向 / 预训练（985 硕士起）② AI 大模型工程化落地（含应用开发、微调、推理优化、调传统算法如 YOLO）。
- 面试新要求两条：**你的智能体里有没有多智能体**、**有没有 Harness 架构**。
- 项目定位：基于已有 ERP 系统的**智能采购助手**，不是玩具 demo，要和老系统对接。
- 前后端：前端 Vite + Vue（:3000），后端 FastAPI（:8090）；智能体跑进 **ASGI** 服务，两个理由——异步高并发、真正实现流式输出（SSE）。
- 与 ERP 的对接方式：**MCP 协议 + 网关**读取 Java ERP 数据，不直连数据库。
- 两类安全诉求催生**沙箱（sandbox，本质 Docker 容器）**：Skills 可能含安全隐患；多用户文件必须隔离。
- 沙箱服务：`OpenSandbox:8080`，需要**镜像仓库**预置多套镜像。

**项目外部依赖全景图**：
```
前端（Vite:3000）Vue SPA ──/api/*→:8090──▶ FastAPI:8090 Chat Backend
                                            ├ 创建 Agent Graph
                                            ├ 创建/管理沙箱
                                            └ 读写会话
                                          │
        LLM调用 ◀── DeepSeek  api.deepseek.com
                ◀── 智谱AI    open.bigmodel.cn
        Web搜索

MCP Server:8000（Agent MCP 网关）
    ├─ 代理 8 个 API ──▶ Java ERP:8080（采购业务 API）
    └─ 26 种图表工具

云服务器（39.100.100.28）
    ├─ OpenSandbox:8080（代码执行容器）
    ├─ MongoDB:27017
    ├─ 摩托车配件商城:80（供应商报价页面）
    └─ 镜像/包仓库（阿里云容器镜像、阿里云 PyPI）
```

---

### P15 Harness 项目整体结构（16m14）

**一句话定位**：先给一张"Agent 核心代码架构"总图，再逐个目录落实——前端、Web 层、智能体核心、MCP、Skills、启动脚本。

**要点**
- 仓库两个大目录：`frontend/`（Vue 源码）+ `src/`（智能体与后端）。
- `src/` 一级：`agent/`（智能体核心）、`api_view/`（FastAPI/ASGI Web 层）、`download/`、`mcp_server/`、`skills/`、`test/`，另有 `langgraph.json`、`mcp工具列表.txt`、`motorparts_db.sql`、`pyproject.toml`、`requirements.txt`、`start_web.py`。
- Java ERP 是请码士 Java 老师写的**模拟系统**（摩托车零部件采购管理），有 Swagger 接口文档。
- `skills/` 下分若干子目录，全项目共 5–6 个；均为开发期**预置**。
- 关键判断：企业里 Skills 一定"随意灵活动态变化"，**增删 skill 不影响智能体启停**。
- 同类成熟实现列举：Claude Code、OpenClaw、DeepAgents 都是 Harness 架构。
- 启动方式：一个脚本用 `uvicorn` 起后端，再 `npm run dev` 起前端，统一封进 `start_web.py`。
- `agent/` 子目录：`backend/`（文件后端）、`memory/`（记忆）、`middleware/`（中间件）、`subagents/`（子智能体）、`tools/`（内置工具）、`main_agent.py`（主智能体）。
- 由此确认结构是**两层主从**：1 个主智能体 + 若干子智能体 = 多智能体项目。

---

### P16 Harness 驾驭工程的概念（10m48）

**一句话定位**：把"提示词工程 → 上下文工程 → 驾驭工程"讲成一条包含关系的演进线，并给出 **Agent = Model + Harness** 的公式与它要解决的五个工程病。

**要点**
- 三个阶段与时间点：提示词工程 2022–2024；上下文工程 2025 年 2 月之后；**Harness Engineering（驾驭工程）2026 年 2 月之后**。
- 三者是**包含关系**：驾驭工程 ⊃ 上下文工程 ⊃ 提示词工程。
- 今天单讲提示词没意义：新智能体的提示词不固定，**随上下文、随每个用户的偏好运行时动态注入**；注入机制由 Harness 架构提供，Memory 里的用户偏好最终就是通过提示词喂给模型。
- 定义：Harness 不再只优化模型输出，而是"构建包裹在模型之外的**一整套系统化基础设施**"，把大模型不确定、不稳定的智能，转成**可靠、稳定、能长时间执行复杂任务的工作引擎**。
- 它带来的新能力只有一个词：**长周期复杂任务**。对比"明天上海天气"（一句话调工具）与"统计 2026Q1 全部涉案账户并分析其特征"（先拆清单再执行，可能调 7–8 个工具 + 3–5 个 skill）。
- 术语本义：Harness = 马具/缰绳，指"模型本身之外的所有东西"——工具、记忆、规划、安全护栏等。
- 出处：LangChain 团队一篇约 126K 访问量的文章，把关系精炼成 `Agent = Model + Harness`——模型提供"思考"，Harness 负责"让它真的能干活、别出大事"。
- 传统 Agent 的**五大工程难题**：上下文窗口爆炸、状态丢失、工具调用混乱、缺乏规划、无法从失败中恢复。
- 规划的必要性：复杂任务必须先拆成任务清单，过去要单独开发"规划智能体"，现在由框架内建。

---

### P17 Harness 架构的 Planning 能力（14m12）

**一句话定位**：用一次"简单任务 vs 复杂任务"的对照演示，把 Planning 落到 `write_todos` 这一个工具上——它既做拆解，也做状态追踪。

**要点**
- 简单任务不需要规划：问"你有哪些可用技能/工具"，直接调工具即答，不生成 todo。
- 复杂任务样例：把"摩托车火花塞"与"博世火花塞"做**采购综合对比分析**——没告诉它对比什么维度、从哪些角度分析，这正是需要规划的场景。
- 复杂任务的第一步是**子智能体预判**（先判断该用哪个子 Agent），随后模型调 `write_todos` 生成任务清单。
- 清单固定 6 步（扫描技能目录并加载分析手册 → 收集规格参数 → 市场价格调研 → 供应商渠道对比 → 执行对比分析并生成图表 → 输出报告到 `/analysis/`），每步带 `status`；初始只有第 1 步 `in_progress`，其余 `pending`。
- 执行中清单被反复重写：跑到末段时前 5 步 `completed`、第 6 步 `in_progress`——**规划 = 拆解 + 逐项状态追踪**两件事。
- 报告落在沙箱内 `/analysis/` 目录，下载走 `download/`；报告里的柱状图、表格、雷达图是**现场生成**（数据来自网搜 + ERP），不是网上下载。
- `write_todos` 入参里那段"流程"不在代码里，而在 **skill 的 md 文件**中定义：理解需求 → 收集数据 → 执行分析 → 生成图表 → 生成报告，只定大阶段，不规定怎么做。
- 持久化：`CHECKPOINTER（MongoDBSaver）` 持久化 Agent state，跨重启保留任务进度。

---

### P18 解析任务规划 Planning 能力（15m30）

**一句话定位**：从代码层拆 `write_todos`——它内部**再调一次推理模型**生成清单，再用 LangGraph 的 `Command` 把清单写进 graph state 的独立字段。

**要点**
- 底座是 **DeepAgents** 框架（LangChain 团队，依赖 `langchain 1.2` + `langgraph 1.1`），官网首句即"面向 Agent 的 Harness 框架"。
- `write_todos` 本身不"算"清单，而是**再调一次大模型**（推理模型）生成；入参是一份 todos 流程/列表描述。
- **Planning 的五层核心**：① 目标分解与结构化 ② 状态驱动的执行循环 ③ 动态重规划与自我修正 ④ 执行诊断与可解释性 ⑤ 长时任务的抗遗忘机制。
- 执行循环里每一步"调工具或调 skill"都可能：某步走 **MCP 工具**（查 ERP），另一步"抓取报价 URL"走的是**网页抓取 skill**——skill 与 tool 都能被 todo 驱动。
- 出错即**自我修正**：某步执行不了就重新生成新的任务项，并做意图识别。
- 抗遗忘是重点：任务清单**固化在 state 里且不允许被摘要、剪裁**——它占 token 很少，但能防止长任务"忘了做到第几步"。反证：Claude Code / Codex 的 `compact` 摘要后确实会"遗忘"。
- 关键实现：清单**不写进 `messages`**（messages 会被压缩），而是写进 state 的另一个固定 key；写入方式是 `Command(update=...)`（全量替换 `state["todos"]`，并附一条 `ToolMessage("Updated todo list")`）。

---

### P19 Harness 架构的文件后端解析（13m13）

**一句话定位**：文件后端不是一个目录，而是"可插拔的抽象层 + 按路径路由"——本项目用 `CompositeBackend` 把 `/memories/`、`/skills/` 和其余路径分给两个不同的后端。

**要点**
- 文件后端 = 文件的全套操作：增、删、改、查、**执行**。
- 文件后端写在**主智能体**里，不在子智能体里；因为后端**不做智能体间隔离**，所有智能体共享同一套文件后端（隔离交给沙箱）。
- 项目实现是一个 `CompositeBackend`（复合/路由后端），内部真正挂了 3 个后端：`sandbox_backend`（default）+ `store_backend`（两条路由）。
- 路由规则一句话：`/memories/` 开头 → `store_backend`；`/skills/` 开头 → 也走 `store_backend`；**其余全部 → default → sandbox_backend**。两条路由必须显式拆分，否则与 default 冲突。
- 实例验证：`/analysis/xxx.md` 不属两条路由 → 落到沙箱；`docker exec` 进容器，根目录下 `/analysis/` 果然有那个 md。
- `store_backend` 的数据落在哪由 **LangGraph 的 store** 决定；项目为图省事用默认 `InMemoryStore`，换成 Redis/MongoDB/Postgres 就落到对应库。
- **抽象层意义**：文件后端不代表真有文件系统——它可能是容器，也可能是 KV / Redis / MongoDB；本地 OS、内存字典都能当文件后端，只要按路径逻辑组织即可。
- 文档族谱：`StateBackend`（仅一次执行线程内有效）/ `FilesystemBackend`（本地磁盘）/ `LocalShellBackend` / `StoreBackend` / `CompositeBackend` / 自定义后端。

---

### P20 Harness 架构的 Multi-Agent 解析（18m12）

**一句话定位**：多智能体的难点不是"拆几个 Agent"，而是**上下文隔离下的任务委派**；本项目把委派压缩成"提示词定格式 + 大模型抽取 + `task()` 转交"，并把子智能体做成 **yaml 零代码弹性加载**。

**要点**
- 多智能体天然是**父子/主从**结构，且不止两层——子智能体本身还能当主；多层要靠**预编译子图**实现。
- 核心前提：**所有子智能体之间上下文完全隔离**，A 不知道 B、B 不知道 A——这才是委派存在的理由。
- 委派 = 从 A 的上下文里"截取"一部分数据传给 B；载体是一个叫 `task` 的工具。
- 工程化改造：把"要抽哪些字段"**写进提示词**，再由大模型从 A 的上下文抽取成结构化文本。
- **抽取 5 项**：任务目标、用户编号、分析需求正文、输出要求、重要提醒；`task` 的 `description` 参数就是抽取后的成果。
- 反向（B 返回 A）同理：返回格式写在 **B 自己的配置**里——谁提供数据，格式就定义在谁那边。
- **SubAgent 弹性加载**：全项目 1 主 + 2 子（analyst＝供应商比价/行情分析/策略建议/市场调研；order＝创建修改采购单/订单查询/数据补充），两个子 Agent **一行代码都没有**，只有 yaml。
- yaml 字段：`name`、`description`、可调用 `tools` 列表、`skills` 目录列表、`system_prompt`，另有需**人工确认**的工具列表（P21 的 `interrupt_on` 就配在这里）。
- 加载链路：`load_subagent_configs()` 读 `configs/*.yaml` 并校验 4 个必填字段（name/description/system_prompt/tools，此时 tools 还是字符串名）→ `resolve_subagent_tools()` 用子串匹配把字符串映射成实际工具对象、合并 `extra_middleware` → `create_deep_agent(subagents=...)`。
- 扩展方式：新建一个 yaml 丢进 `configs/` 即可，Python 侧零改动；主智能体 reload/热启动生效，不必重启整个 FastAPI。

---

## C. Harness 六大核心能力（P21–P32）

### P21 Harness 架构的人工介入解析（9m54）

**一句话定位**：用一个"采购 700 个电装 DENSO 火花塞"的端到端真实演示，把 Harness 企业项目中 **Human-in-the-Loop 人工介入机制**讲清：第一次中断补齐缺失字段、第二次中断做订单审批，并且整套中断**代码零开发、只靠 YAML 配置**。

**要点**
- 场景起点：主智能体把任务**转交给「采购订单管理」子智能体**（项目有两个子智能体：采购分析 / 采购订单管理）。
- **第一次中断——缺字段**：子智能体调用 `request_order_info` MCP 工具去查 ERP 的订单必填字段，发现用户只给了物料/数量，缺「预计交货日期 / 单价确认 / 订单备注」，触发 `interrupt_on` 中断，前端呈现卡片式人工确认组件。
- 卡片 UI 元素：左列**缺少字段** 3 项 + 右列**已收集数据** 6 项 + 底部自然语言输入框。
- **自然语言回填 + 自动提取**：用户直接输入"预计 2026 年 7 月 30 号交货，协商单价 29 元/个，备注电装 DENSO U27ETR 铱金火花塞采购"，**大模型自行把自然语言解析成结构化 JSON 字段**。
- **第二次中断——审批**：数据补全后，智能体准备真正调 `order_create` MCP 工具写 ERP，触发第二次 `interrupt_on`，卡片变成"需要人工确认以下操作" + `✓同意 / ✗拒绝` 两个按钮。
- **零代码配置**（核心）：`procurement_order.yaml` 里：
  ```yaml
  interrupt_on:
    order_create:
      allowed_decisions: ["approve", "reject"]
    order_update:
      allowed_decisions: ["approve", "reject"]
  ```
- **`interrupt_on` 是讲者自研 DSL 而非框架原生**：讲者自己写的 `loader.py` 把 YAML 翻译成 LangGraph 的 `interrupt_on` 节点配置。
- `allowed_decisions` 是白名单：拒绝后 Agent 不调工具、不写库；同意后才真正调 MCP 工具。

**金句结论**
> "触发人工介入的代码你都不用写，这是最牛的地方。只要在你的 YAML 配置文件里，你需要触发人工介入在哪个地方，你配上去就行了。"

---

### P22 Harness 架构的 Sandbox 解析（一）（20m46）

**一句话定位**：把 Harness 企业项目的**最大亮点——基于 OpenSandbox 的安全边界**，从"为什么必须有沙箱"讲到"沙箱防护哪三件事 + 用户作用域隔离 + 预热机制"，并现场把 `MCP Server / FastAPI / OpenSandbox Server` 三件套启动起来，用日志证明沙箱预热与认领的时序。

**要点**
- 问题引入：Skill 要么项目预置，要么从网上下载（**魔搭社区 Skills 中心** 与 **ClawHub**），企业项目免不了用外部 Skill，工信部 2026 年 3 月持续发文提醒安全风险。
- 两类安全风险：脚本含恶意代码（Python / Node.js / Go / Java 都可能有）；多用户文件必须隔离。
- **为什么不只靠权限判断**：权限判断只能解决读写权限问题，**系统命令的安全性很难判断**（普通命令本质可能运行恶意脚本），所以干脆把所有风险行为放进"铜墙铁壁的盒子"里运行。
- **OpenSandbox 是什么**：阿里云 **2025 年 12 月开源**的容器管理项目，本项目用它做所有 Skill 执行、命令执行、文件操作的**安全边界兜底**。
- **OpenSandbox 防护三件事**：
  - **宿主机文件系统不可见** —— 容器内 `/skills/`、`/data/` 都是容器自己的文件系统，与宿主机物理隔离；
  - **进程隔离** —— `execute()` 启动的进程在容器内运行，无法直接操作宿主机进程；
  - **资源限制** —— `cpu: "2"`、`memory: "4Gi"` 防止容器耗尽宿主机资源。
- **沙箱内的运行环境**：Python / Go / Java / Node.js 四种语言环境；所有 Skill 脚本、系统命令、HTTP 请求（web-scraper 工具）、web 抓取都在这里运行。
- **墙内 / 墙外**：
  - **墙外（宿主机 Windows）**：FastAPI（Agent 服务器）、MongoDB、MCP Server
  - **墙内（OpenSandbox 容器 Linux）**：`/skills/`、`/data/`、`/analysis/`、`/memories/`、`/AGENTS.md`、`/workspace/`；四语言运行时；`execute("任意命令")→在这里运行`
- **两个附加机制**：① **用户作用域的沙箱隔离**——每个用户一个沙箱，张三/李四互不可见；② **沙箱预热机制**——不是用户提问时才创建（那样用户要等半天），而是登录时就把空闲沙箱准备好，被占用后**立刻补建下一个**。
- **兜底哲学的金句**：
  > "OpenSandbox 在这里扮演的角色：它是**最后的兜底线**。即使 Skills 全部失守——恶意技能被下载、解压、恶意代码、文件操作——第 5 阶段执行时，恶意代码仍然只能造成多大的外部影响。你把整个沙箱攻陷了都没关系，我把这个沙箱重启起来就可以。"

**沙箱架构 ASCII 图**：
```
┌──────────────────────────────────────────────────┐
│  宿主机（Windows）                                 │
│                                                    │
│   FastAPI（Agent服务器）   MongoDB    MCP Server   │
│                                                    │
│   ┌─────────────────────────────────────────────┐ │
│   │  OpenSandbox容器（Linux）                      │ │
│   │                                               │ │
│   │   /skills/    /data/    /analysis/            │ │
│   │   /memories/  /AGENTS.md  /workspace/         │ │
│   │   Python, Go, Java, Nodejs 环境                │ │
│   │   execute（"任意命令"）→在这里运行              │ │
│   │   web-scraper→从这里发出HTTP请求                │ │
│   │   技能脚本→在这里被调用                          │ │
│   │   网络出口                                      │ │
│   └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

---

### P23 Harness 架构的 Sandbox 解析（二）：五个 py 文件如何拼成一个沙箱（19m45）

**一句话定位**：从**代码层面**解析沙箱创建链路、命令执行链路、故障热替换恢复、预热-认领-补充时序、用户作用域隔离的实现。

**要点**
- 核心结论：**沙箱就是 5 个 py 文件层层包装出来的**——底层直接怼 Docker、中层把 SDK 翻译成框架要的协议、外层只做"一个永远不变的引用"，旁边两个管生命周期与监控。**用户手里拿的永远是 proxy，容器可以在背后被换掉。**

| 组件 | 文件 | 层级 | 职责 |
|---|---|---|---|
| `SandboxSync` | opensandbox 外部 SDK | 基础设施层 | Docker 容器 CRUD（异步） |
| `OpenSandboxBackend` | `custom_opensandbox.py` | 协议适配层 | 把 SandboxSync 包装为 `SandboxBackendProtocol` 文件后端接口 |
| `SandboxBackendProxy` | `sandbox_proxy.py` | 代理层 | 稳定句柄 + 透明代理 + **热替换** |
| `sandbox_manager` | `sandbox_manager.py` | 生命周期编排层 | 用户级沙箱生命周期、预热池 |
| `SandboxHealthMiddleware` | `sandbox_health.py` | 监控层 | `before_agent` 前 ping，挂了自动重建 |

- 创建链路：`sandbox_setup.py → setup_sandbox(config, sandbox_id=None, image=None)` → `SandboxSync.create(image, entrypoint=["/opt/opensandbox/code-interpreter.sh"], env={"PYTHON_VERSION":"3.11"}, resource={"cpu":"2","memory":"4Gi"}, timeout=timedelta(hours=2), connection_config=config)` → 返回 `OpenSandboxBackend`。`entrypoint` 决定容器里有哪些语言环境；`timeout` 定了生命周期上限（超时自动回收）。
- 镜像必须**预先放在服务器本地镜像库**（可以多个，名字不同即可）。
- 文件后端：`OpenSandboxBackend` 是"文件后端"，把 SDK 的容器文件/命令能力翻译成框架统一协议；`SandboxBackendProxy` 持有它，热替换时对外引用不变。
- 健康与故障：`SandboxHealthMiddleware` 每次 `before_agent` ping；失败则重建，连续失败交给熔断中间件（见 P32 的 #1/#7 双保险）。
- 预热-认领-补位时序：服务启动建空闲沙箱#1 → 张三登录认领#1 → 日志"正在创建新沙箱"→ 空闲#2 就绪 → 李四登录认领#2 → 再补#3……（企业可一次预热 5/6/10 个）。
- 用户作用域隔离：每个用户一个沙箱，张三/李四互不可见。
- 结果印证：创建沙箱时上传**13 个基础文件**；`/analysis/` 等目录都在容器内。

---

### P24 Harness 架构中自我进化的 Skills（一）（19m44）

**一句话定位**：用一个"一句话让智能体去下载并装配新 Skill、立刻可用、自动持久化"的完整演示，引出 Skill 的**四阶段生命周期**：同步→渐进式发现→运行时创建/下载→分配与持久化，并把"执行与存储分离"的核心工程动机讲清。

**要点**
- Skill 的两类来源：① 项目预置（开发期写好，称"预置 Skill"），② 运行时新增（用户下载或 Agent 生成）。
- **执行与存储的分离**：所有 Skill 都在 OpenSandbox 中执行（安全），都持久化到 MongoDB/StoreBackend（永久）。动机：沙箱可能被回收（用户用完即销毁），Docker 容器一回收，里面所有文件全没。
- **四阶段流程**：
  - **阶段 1：同步到沙箱** —— 把本地预置 Skill 上传到沙箱（增量 + `_seed_files` 首次）；
  - **阶段 2：渐进式发现** —— 每个智能体有独立的 Skill 目录，通过中间件做发现；
  - **阶段 3：运行时自动创建/下载新 Skill** —— 母 Skill（`skill-management`）负责；
  - **阶段 4：分配与持久化** —— 把下载或新建的 Skill 分配给任意子智能体（复制到对应 scope 目录），并持久化到 StoreBackend。
- **演示：下载一个网络 Skill 给采购分析子智能体**：复制 Skill URL → 自然语言"帮我下载这个 Skill 地址，分配给采购分析" → 主智能体调 skill-management 母 Skill → 自动下载、结构校验、功能测试、分配、清理临时文件 → 立刻可用。
- **演示：Agent 自主创建 Skill**：用户描述需求（"读取并解析 Excel 文件"） → 母 Skill 自动创建 SKILL.md + 脚本 → 安装依赖、语法检查、生成模拟测试数据、功能测试 → 测试通过询问分配到哪个子智能体。
- **企业定制化的真正价值**：对企业来说"功能增加/需求改变 = 增删 Skill"，Skill 甚至不需要人写，描述需求让母 Skill 生成。
- **母 Skill 的内部结构**：自带 R2T（ReAct + Task Planning）四步规划：① 编写 SKILL.md 与脚本 ② 安装依赖并测试 ③ 分配与持久化 ④ 清理临时文件。
- **文件后端 StoreBackend**：主智能体配置时显式指定 `StoreBackend`，决定 Skill 持久化到哪里；StoreBackend 可切换（MongoDB/Redis/其他）。

**金句结论**
> "Skill 不但是渐进式披露，这个是最基本的功能……重点是要解决在实际应用场景中，Skill 的持久化问题、安全问题、自我进化问题。"

---

### P25 Harness 架构中自我进化的 Skills（二）（11m47）

**一句话定位**：把 P24 演示背后的代码架构讲清：三个中间件（框架自带的 SkillsMiddleware + 自定义 SkillsSyncMiddleware + UserSkillsRestoreMiddleware）+ 母 Skill + assign_skill 工具，并用两张文档图把"渐进式披露时序"和"自我进化流程"完整画出来。

**要点**
- **三个中间件的分工**：
  - `SkillsMiddleware` —— Deep Agents 框架**自带**，负责**渐进式披露**；
  - `SkillsSyncMiddleware` —— 自定义，负责**本地 src/skills/ ↔ 沙箱**同步（增量 + `_seed_files` 首次）；
  - `UserSkillsRestoreMiddleware` —— 自定义，负责**StoreBackend ↔ 沙箱**同步（新沙箱创建时恢复已持久化的 Skill）。
- **渐进式披露的 token 账**：每个 SKILL.md 的 frontmatter（元数据）一般 ≤200 token，最大不超过 2000 token；假设项目有 100 个 Skill × 平均 200 token = **2 万 token**；DeepSeek-V4 上下文百万级，2 万几乎无压力；所以**启动时只加载元数据**，Agent 决策需要某个 Skill 时才 `read_file` 加载完整内容。
- **渐进式披露的分页加载**：完整 SKILL.md 内容较长时采用分页加载，不一次性塞入上下文。
- **assign_skill 工具的实现**：一个自定义工具（`@tool` 装饰器标注），本质是"移动目录"——把 Skill 从 `main/` 移到目标子智能体的 scope 目录，并同步到 StoreBackend。
- **Scope 映射与目录映射**：每个子智能体对应一个 scope，scope 对应沙箱内的 `/skills/{scope}/` 路径；主智能体默认 scope 是 `main`。
- **自我进化的完整流程**：
  - **Step 1：获取**（用户提供 URL 下载 / 用户描述需求 Agent 创建）
  - **Step 2：沙箱内测试**（脚本功能测试 + SKILL.md 完整性校验）
  - **Step 3：测试通过则分配+持久化；不通过则自动修复 SKILL.md 再测试**
  - **Step 4：分配到指定 scope 目录 → 通过 SkillsMiddleware 自动发现**。
- **自动修复能力**：讲者特意试过让 Agent 生成更复杂的 Skill、故意让测试不通过，Agent 会**自己修复 SKILL.md 内容**直到通过。
- **本项目的教学定位**：不是教"如何用 Skill"（OpenHands / OpenClaw / Claude Code 个人装一个就能用），而是教**如何在企业级定制化项目中管 Skill 的全生命周期**——下载、分配、新建、测试、持久化。

**自我进化流程图**：
```
用户提供 URL ──→ 母 Skill 下载 ZIP ──→ 沙箱内解压
                                              │
用户描述需求 ──→ 母 Skill 创建 SKILL.md + 脚本 ──→ 沙箱内测试
                                                    │
                                              ┌─────┴─────┐
                                          测试通过     测试不通过
                                              │             │
                                    assign_skill      自动修复 SKILL.md
                                              │             │
                                    复制到 /skills/{scope}/ │
                                    + StoreBackend 持久化    回到测试
```

---

### P26 Harness 架构的 Context-Engineering（一）（14m21）

**一句话定位**：从"上下文工程 ≠ 提示词工程"切入，讲 Harness 上下文工程的**四流程**（输入 → 压缩 → 隔离 → 长期记忆）与**压缩的三种机制**（自动摘要 85% 阈值 / 手动 compact / 子智能体隔离），并用 `CompositeBackend` 路由代码演示 `/memories/` 的落点。

**要点**
- **提示词工程 vs 上下文工程**：前者只关注"怎么写好 system prompt"；后者关注"怎么把正确的信息在正确的时机送到 Agent"——包括**输入组装、压缩、隔离、长期记忆**四个流程。
- **四流程的 Harness 实现**：
  - **a. Input Context** —— 提示词 + 工具描述 + Skills 元数据 + 用户偏好；
  - **b. Compression** —— 三层压缩机制（自动 85% 阈值 / 手动 compact / 子智能体隔离）；
  - **c. Isolation** —— 多智能体之间上下文完全隔离（天然降低单次调用的上下文体积）；
  - **d. Long-term Memory** —— `/memories/{user_id}/preferences.md` + StoreBackend 持久化。
- **自动摘要 85% 阈值**：上下文达到 max_input_tokens 的 85% 时触发；触发时 ① 把完整历史写入文件做持久化，② 调大模型对历史做总结，用总结替代原历史。
- **手动 compact**：通过 Deep Agents 的 `create_summarization` 得到一个"摘要工具"，Agent 可**自主决策**在合适时机调用——因为自动摘要在"正在处理重要数据"时强行触发会丢语义。
- 提示词里写明调用时机：讲者在 `AGENTS.md` 中显式写"在收到子智能体长篇报告时主动调 compact"。
- **子智能体隔离 = 天然压缩**：就算不做摘要，只要做了子智能体隔离，最终调大模型时收到的上下文也天然变小；交接什么格式的数据写在系统提示词里。
- `CompositeBackend` 路由实证：`/memories/` 路由到 `StoreBackend`，命名空间由 `runtime.context['user_id']` 决定（`namespace=lambda rt: (rt.runtime.context.user_id,)`），底层用 LangGraph 的 store 存数据。
- 启动日志可见：MCP 工具加载、"工具分组完成：分析类 5 个 / 订单类 3 个 / 图表类 27 个"、两个子 Agent 配置加载、沙箱就绪 ID、`Waiting... (18s / 180s)`。

---

### P27 Harness 架构的 Context-Engineering（二）（6m20）

**一句话定位**：把压缩机制落到 `config.py` 的具体配置——主模型参数、摘要专用模型、备用模型、沙箱连接配置。

**要点**
- **主模型参数**：`model_kwargs` 显式设 `max_tokens=25600`，并关闭 thinking（`"thinking": {"type": "disabled"}`）；还可设最大输入/输出 token 数。
- **摘要专用模型 `SUMMARY_MODEL`**：`deepseek-v4-flash` + `temperature=0.3`（摘要要稳定输出，温度取低值）+ `max_tokens=25600` + 关闭 thinking——用小模型做摘要，**既省钱又稳定**，不用主模型。
- **备用模型 `FALLBACK_MODEL`**：`init_chat_model(model="glm-5.1", model_provider="openai", base_url=ZHIPU_BASE_URL, profile={"max_input_tokens":12800,"max_output_tokens":8192,"tool_calling":True,"structured_output":True})`——主模型故障时自动切智谱 GLM-5.1，保证服务不中断。
- **沙箱连接配置 `SANDBOX_CONFIG`**：`ConnectionConfigSync(domain="http://39.100.100.28:8080", use_server_proxy=True, request_timeout=timedelta(seconds=60), transport=httpx.HTTPTransport(limits=httpx.Limits(max_connections=20)))`——`use_server_proxy=True` 走代理，`max_connections=20` 控并发。
- 文件里还有各类路径常量（项目根目录、Skill 目录、`AGENTS.md` 路径等）。
- 下集预告：用户偏好记忆。

---

### P28 用户偏好解析（一）（12m41）

**一句话定位**：划清短期/长期记忆边界，给出 `preferences.md` 用户偏好记忆文件的生命周期与"文件即抽象"的存储观。

**要点**
- 短期记忆 = 剪裁 + 摘要 + 调用专用摘要工具；长期记忆 = `preferences.md` 用户偏好文件。
- 短期记忆还要**持久化**：主智能体第 271/281 行设 `checkpoint`，用 `mongosave`（Mongo 版 Saver），传 client + db 名。
- `checkpoint` 是 LangChain 内置持久化机制；`checkpoint` 集合存 BSON blob 长文本，需解析才能看。
- `preferences.md` 的生命周期：不存在则创建，存在则读取。
- **文件名只是抽象**，真正要存的是文本字符串；可直接存库，返回时再包装成 .md 文件。
- 虚拟文件系统后端支持 Redis / MongoDB / PostgreSQL，甚至内存；不必落物理磁盘。
- 创建时的**默认值写在系统提示词**里（提示 Agent 用 `write_file` 建文件），改格式只改 MD、不改代码。

**`preferences.md` 生命周期图**：
```
新用户首次使用
   ├─ 不存在 → Agent调用 write_file → 写入6个字段默认值 → 创建默认
   └─ 已存在 → Agent调用 read_file  → 读取偏好
                        │
        ContextInjectionMiddleware 注入 → Agent将偏好注入子Agent
                        │
        MemoryUpdateMiddleware → 自动更新历史 / 更新偏好字段
                        │
                        ▼         MongoDBStore（持久存储）
```

**金句结论**
> "文件名只是抽象，存哪里无所谓——虚拟文件系统可以是数据库，也可以是内存，不必原封不动落到磁盘。"

---

### P29 用户偏好解析（二）（15m54）

**一句话定位**：用"中间件矩阵 + 文件后端路径路由"落地偏好全链路，并给出 8 步更新时序与运行时改写演示。

**要点**
- 专门中间件负责找偏好文件；文件**基于 `user_id` 用户作用域**，故必须先从运行环境取到 `user_id`。
- runtime 里 `get` 出 `context`，判断有无 `user_id`，取到 ID/用户名后注入上下文。
- 注入效果可见：第 35 行拿到 `user_id`，第 4 行"用户偏好文件路径 `/memories/{user_id}/preferences.md`"中的变量被替换成实际用户名。
- 演示：文件不存在 → "偏好文件暂时不存在，首次使用，按默认值创建" → `edit_file` 创建成功并回显 6 字段（图表类型柱状图 / 货币人民币 / 语言中文 / 最近供应商 / 最近查询）。
- 演示：只说"我用折线图"，Agent 自行判定为改偏好，调 `edit_file` **只改图表类型**，其余字段不动。
- 中间件挂在 **`before_agent`** 钩子（每次 Agent 生效即触发），所以每轮都重新找文件、重新注入。
- 另一个中间件 `MemoryUpdateMiddleware` 后台默默工作：自动提取对话中的供应商名称与查询摘要，用于更新偏好文件。
- 传递链：前端请求带 user_id → `APIView` 从 `request` 取 → 传入 `create_main_agent()` → 写进 `runtime.context` → 每次 `stream` 调用携带 context 传给 Agent。
- `read_file` / `edit_file` / `write_file` / `find` 由文件后端父类 `BackendProtocol` 定义，子类（`SandboxBackendProxy`、`StoreBackend`）必须重写，最终暴露成工具给 Agent。
- **偏好转发子智能体**：任务委派时传 5 部分数据（任务目标、任务偏好…）；偏好字段**不会被摘要**，每轮靠中间件重新注入。

---

### P30 人工介入详解（18m07）

**一句话定位**：Harness 第六个核心能力 Human-in-the-Loop 的**两层中断**（代码级 `interrupt()` + 配置级 `interrupt_on`）与 SSE 恢复闭环。

**要点**
- 本项目只在**下采购单**时触发；**触发点由程序员决定**，写在代码或配置里，不是任何地方都拦。
- **两层中断**：
  1. **第 1 层——数据完整性补全**：自写工具 `request_order_info` 内部第 33 行调 `interrupt()`，把"缺失字段 + 已收集数据"抛给前端；可收任意补充信息，灵活。何时调它由 ReAct 意图决策按提示词（提取已有 → schema 校验 → 循环补缺）决定。
  2. **第 2 层——最终审批**：`interrupt_on: order_create / order_update`，`allowed_decisions: ["approve","reject"]`，执行前暂停，只能同意/拒绝，克制。
- **两层互补**：自写工具用 `interrupt()`（灵活）；调他人工具用 `interrupt_on`（克制——多只能填太多反而易错）。
- `chat.py` 第 300+ 行遍历流式 chunk 的 `interrupts`，按类型 `yield` 一条 `type="interrupt"` 的 SSE 消息：`action_requests` → `hitl_approval`；`order_info_request` → 数据补充。
- 前端只有收到 `type=interrupt` 才渲染黄色横幅 `InterruptBanner.vue`（"订单数据不完整，请补充以下数据"），不是固定展示。
- **恢复闭环**：前端点"提交补充 / 同意"（不是发送按钮）→ 新请求打到 `chat.py` 第 601 行的恢复端点 → 把输入封装成 `Command(resume=...)` → 再调 `agent.astream` → Agent 续跑。

---

### P31 Harness 架构的 SSE 事件流（17m59）

**一句话定位**：用 FastAPI + `StreamingResponse` + Python 生成器实现 SSE 事件流，把智能体的流式输出、工具调用、人工介入中断三类事件统一封装成前端可消费的 `text/event-stream`。

**要点**
- **77 个核心能力回顾**：本节是 Harness 项目总结收尾，从头梳理 77 个核心能力。
- **6 大核心能力复盘**：① Plan 任务规划；② 安全与动态路由的文件后端（`ls`/`read`/`write`/`edit`/`glob`/`grep`/`execute`，仅沙箱与 `local shell` 支持命令执行）；③ Multi-Agent 多智能体委派；④ 上下文管理；⑤ Skills 渐进式披露与自我进化；⑥ Human-in-the-Loop 人工介入。
- **文件后端边界**：普通文件后端 / 数据库文件后端不能执行命令，**只有 `OpenSandbox` 沙箱和 `local shell`（本地）能做 Skills 的文件后端**——Claude Code / OpenClaw / Harness 默认用 `local shell`。
- **为什么是 SSE**：前端 Vue + 后端 FastAPI，企业级智能体项目必须采用流式输出；可勾选/取消"显示工具调用"，只看 AI 最终回复与推理过程。
- **FastAPI 是主流**：VLLM / SGLang 等大模型推理框架内置 FastAPI 对外暴露 API；项目启动文件加载 CORS 中间件解决跨域。
- **`chat.py` 三大视图函数**：`chat_stream`（流式对话）、`chat/{thread_id}/resume`（中断恢复）、`get_chat_history`（历史聊天列表，普通 JSON 响应，查 MongoDB）。
- **`StreamingResponse` 的响应头**：`media_type="text/event-stream"`，`headers={"Cache-Control":"no-cache","Connection":"keep-alive","X-Accel-Buffering":"no"}`。
- **SSE vs WebSocket**：都用 `StreamingResponse`，但 SSE 是单向流（服务端 → 客户端），比 WebSocket 轻量，足够智能体场景。
- **生成器 + `yield`**：`stream_chat_response` 是 Python 生成器，每次 `yield` 即向前端推一帧数据；大量 `yield` 调用构成流式输出。
- **`for chunk` 循环**：遍历智能体流式输出的 chunk（不一定是单个 token，可能是多个 token 或完整消息），按 `chunk_type` 分支处理。
- **chunk 类型判断**：区分 `interrupt`（人工介入中断）、`messages`（普通消息）、`tool`（工具调用）；工具 chunk 与 AI chunk 在前端用不同图标/边框颜色（黄=工具，蓝=AI），可过滤显示。
- **双流模式**：流 A `messages`（消息内容流）+ 流 B `values`（中断检测流），**中断检测必须在 messages 处理之前执行**。
- **飞书文档 77 步完整请求链路**：从 `user` 输入 → `stream_chat_response` → `get_display_messages` → `Command(resume=...)` → `agent.astream` → 子 Agent 恢复 / 中断触发 / HITL 审批 / 订单创建 / 消息保存。

**代码提取：`chat.py` SSE 入口**：
```python
async def chat_stream(request: ChatRequest):
    thread_id = request.thread_id or str(uuid.uuid4())
    user_id = request.user_id
    return StreamingResponse(
        stream_chat_response(
            message=request.message,
            thread_id=thread_id,
            user_id=user_id
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
```

**金句结论**
> "SSE 不是 WebSocket 的平替，而是智能体流式输出的最佳抽象——每次 `yield` 就是一帧事件，`chunk_type` 决定前端渲染成 AI、工具还是中断。"

---

### P32 Harness 架构的中间件解析（19m20）

**一句话定位**：9 个用户绑定中间件 + 8 个框架自动注入中间件，形成"健康守护 → 上下文注入 → 技能同步 → 摘要压缩 → 记忆更新 → 熔断保护 → 调用限制"的完整生命周期管线，覆盖 10 种故障场景。

**要点**
- **中间件矩阵是 Harness 项目最大亮点**：上下文剪裁、保底摘要（85% 阈值）、沙箱健康检查、人工介入——全部靠中间件。
- **完全做到故障全场景覆盖**：表里含项目所需全部中间件，总数超过 15 个；绑定方式是在 `create_main_agent()` 时传 `middleware=[...]` 列表参数（代码第 278 行），列表内恰好 9 项。
- **两大类中间件**：① 框架内置（DeepAgents / LangChain 团队提供，`create_deep_agent()` 自动添加）；② 用户自定义（程序员开发智能体时手写）。
- **框架内置 8 个中间件职责**：
  - `TodoListMiddleware`（任务规划工具 `write_todos`）
  - `MemoryMiddleware`（`AGENTS.md` 注入 system prompt）
  - `SkillsMiddleware`（技能渐进式披露）
  - `FilesystemMiddleware`（`ls`/`read`/`write`/`edit`/`glob`/`grep`/`execute` 工具）
  - `SubAgentMiddleware`（`task` 子 Agent 调度工具）
  - `SummarizationMiddleware`（85% 自动摘要保底）
  - `AnthropicPromptCachingMiddleware`（提示缓存）
  - `PatchToolCallsMiddleware`（孤儿 `tool_call` 修复）
- **摘要双保险的两个抓手**：`SummarizationMiddleware` 是保底（85% 阈值）；程序员应在关键节点**主动调 `compact_conversation`**（写在主智能体 system prompt 的触发条件：收到子 AI 长篇报告必须调、完成对比分析后、对话超 6 轮且距上次压缩超 3 轮）。
- **9 个用户绑定中间件 = 7 自定义 + 2 LangChain 内置**：第 8、9 个（`ModelCallLimitMiddleware` / `ToolCallLimitMiddleware`）由 LangChain 提供，但**默认不生效**，必须手动绑定；绑定方式是在 `create_main_agent()` 传 `middleware=[...]`（代码第 278 行）。
- **关键数字口径**：`SandboxCircuitBreakerMiddleware` 沙箱**连续报错 2 次**即熔断、终止本次会话等重启；`ModelCallLimitMiddleware` 每轮模型调用 **> 50** 强制终止（防死循环）；`ToolCallLimitMiddleware` 每轮工具调用 **> 200** 强制终止（防工具风暴）。
- **`MemoryUpdateMiddleware` 实现细节**：`after_agent` 里取 `state["messages"]`，从后往前找最后一条 `HumanMessage`，判断是否 ERP 对话，用 `SUMMARY_MODEL` 提取供应商 / 查询摘要，合并后写回 `/memories/{user_id}/preferences.md`。
- **钩子体系**：至少 5 种常用钩子（`before_agent` / `after_agent` / `before_model` / `after_model` / `wrap_tool_call`）。

**中间件总览表**：

| # | 中间件 | 来源 | 使用的钩子 | 职责 |
|---|---|---|---|---|
| 1 | SandboxHealthMiddleware | 自定义 | before_agent | ping 沙箱 → 失败自动重建 → 继续 |
| 2 | ContextInjectionMiddleware | 自定义 | before_agent, abefore_agent | 注入 user_id/username 到 SystemMessage |
| 3 | SkillsSyncMiddleware | 自定义 | before_agent, abefore_agent | 本地 skills 增量同步到沙箱 |
| 4 | UserSkillsRestoreMiddleware | 自定义 | abefore_agent | StoreBackend 持久化技能恢复到沙箱 |
| 5 | SummarizationToolMiddleware | DeepAgents 内置（手动启用） | wrap_model_call | 提供 compact_conversation 工具 + 自动摘要 |
| 6 | MemoryUpdateMiddleware | 自定义 | after_agent | 每次对话后自动写回 /memories/ 偏好文件 |
| 7 | SandboxCircuitBreakerMiddleware | 自定义 | before_agent | 沙箱连续失败 → 熔断 |
| 8 | ModelCallLimitMiddleware | LangChain 内置 | before_model, after_model | 模型调用次数 > 50 → 终止 |
| 9 | ToolCallLimitMiddleware | LangChain 内置 | before_model, after_model, wrap_tool_call | 工具调用次数 > 200 → 终止 |

**故障场景覆盖矩阵**：

| # | 故障场景 | 处理中间件 | 行为 |
|---|---|---|---|
| 1 | 沙箱超时 / 容器被销毁 | #1 SandboxHealth | ping 检测 → 自动重建 → 继续 |
| 2 | 沙箱服务宕机（重建也失败） | #1 → #7 SandboxBreaker | 重建尝试 → 连续失败 → 熔断 |
| 3 | 工具调用抛异常 | ToolNode（框架内置） | 捕获 → ToolMessage(status="error") → Agent 自我纠正 |
| 4 | 上下文溢出 | #5 SummarizationTool + 框架 | 自动摘要 → Agent 自动判断摘要必要性 |
| 5 | LLM 陷入循环（50+ 次调用） | #8 ModelCallLimit | 强制终止 |
| 6 | 工具调用风暴（200+ 次） | #9 ToolCallLimit | 强制终止 |
| 7 | 用户记忆丢失 | #6 MemoryUpdate | 每次对话后自动写回 StoreBackend |
| 8 | 沙箱丢失技能文件 | #3 SkillsSync + #4 UserSkillsRestore | 启动时自动恢复 |
| 9 | 用户身份未注入 | #2 ContextInjection | 首次 step 注入 SystemMessage |

**总结**：9 个中间件形成"健康守护 → 上下文注入 → 技能同步 → 摘要压缩 → 记忆更新 → 熔断保护 → 调用限制"的完整生命周期管线。其中 #1 和 #7 协作形成沙箱健康的双重保险（自愈 + 熔断）。

---

## D. AsyncSubAgent 异步子代理（P33–P36）

### P33 Harness 架构的 AsyncSubAgent 解析（一）（22m38）

**一句话定位**：从一个真实体验缺陷出发——采购分析要 1 分钟、按钮变灰、用户被迫等待——把需求翻译成三条工程约束（后台跑 / 主 Agent 立即恢复 / 可凭 task_id 查询与取结果），并引出 AsyncSubAgent 的概念澄清。

**要点**
- **问题域收敛**：采购分析要 1 分钟、按钮变灰、用户被迫等待——这是同步子代理的体验缺陷。
- **AsyncSubAgent 的"异步"与 Python 协程无关**，本质是**生命周期解耦**；同步 `subagent` 像函数调用（阻塞、返回结果），异步则立即返回 job/task ID，主 Agent 以 supervisor 身份继续服务用户，并保留 send/update、cancel、list、跨轮状态、长任务、并行、中途干预等能力。
- **机制落点**：所有能力都收敛到 **Agent Protocol Server**（= LangGraph 本地服务，`langgraph dev --host 127.0.0.1 --port 2024`）。它内部以 **thread（会话容器）/ run（一次执行）/ state（当前状态）** 三元组管理后台任务，状态机取值 `running / success / error / cancelled`；主 Agent 通过 5 个工具操纵它。

---

### P34 Harness 架构的 AsyncSubAgent 解析（二）（20m52）

**一句话定位**：从代码层面讲解 AsyncSubAgent 的改造路径——服务侧 `langgraph.json` 用**自定义 graph_id** 注册异步图；主 Agent 侧用 `AsyncSubAgent(name/description/graph_id/url)` 声明。

**要点**
- `langgraph dev` 只需要两个必需文件：`langgraph.json` + `pyproject.toml`。
- **改造路径（逐文件）**：
  - 服务侧 `langgraph.json`：原来主智能体的键**写死为 `"agent"`**（不可改名）；新增异步条目改成**自定义 graph_id**（讲者口述"采购异步分析"，画面可辨 `procurement_analyst_async`）；
  - `graph_id` 就是异步子智能体的唯一 ID，**必须与主智能体侧完全一致**（讲者专门截图对比两处）；
  - `main_agent.py` 三处改动：定义同一个 `ASYNC_ANALYST_GRAPH_ID`、加环境变量 `ASYNC_ANALYST_URL`（服务自己起在 `127.0.0.1:2024`）、`import AsyncSubAgent`；
  - 子智能体拆成**两个列表**：`sync_subagents = resolve_subagent_tools(...)`（只留订单管理那个）+ `async_subagents: list[AsyncSubAgent]`，最后 `subagents = sync_subagents + async_subagents` 一起交给主智能体；
  - loader 里加**排除判断**：采购分析的 YAML 文件**没删但不读**，否则会被同步列表重复加载；
  - 异步子智能体不能靠 YAML 样本配置，单独写 `async_procurement_analyst.py`（核心是一行 `create_deep_agent(...)`）。
- **异步条目只有四个字段**：`name`（`procurement-analyst`）/ `description`（"耗时采购分析专家……后台运行，适合长任务"）/ `graph_id` / `url`。
- **5 个工具由 `AsyncSubAgentMiddleware` 提供**（配置了 async subagents 就自动进默认中间件栈）：`start_async_task`（立即返回 Task ID）、`check_async_task`（状态 + 结果）、`update_async_task`（发新指令）、`cancel_async_task`（停止）、`list_async_tasks`（列出全部任务与实时状态）。
- **易踩的坑（官方文档生命周期）**：
  - `update` 走同一 thread 的 interrupt 策略——**旧 run 被打断、带完整历史 + 新指令重启，task ID 不变**；
  - `cancel` 在服务端调 `runs.cancel()` 并标记 `cancelled`；`list` 对非终态任务**并行**去服务端取实时状态，终态（`success`/`error`/`cancelled`）从缓存返回；
  - 任务元数据必须放在 supervisor graph 的**专用 state channel `async_tasks`**，与 message history 分离——否则 deep agents 压缩消息历史后，只存在 tool message 里的 task ID 就丢了；
  - checkpoint 不指定就落在 **in-memory**（生产要换 MongoDB 等持久 checkpointer）。
- **主智能体提示词（`AGENTS.md`）加路由规则**：采购分析 → `start_async_task`（procurement-analyst）；操作采购单 → `task`（procurement-order）；简单问候/功能询问 → 直接应答不委派；通用知识 → `web_search` 后直答；新偏好 → 更新 `/memories/{user_id}/preferences.md`。
- **组件架构图读法**：主 Agent 在 FastAPI 进程内；异步子 Agent 在**另一个进程**（LangGraph / Agent Protocol Server）里，靠 `start_async_task` + URL 跨进程调用；沙箱是**全局共享**的（子 Agent 用同一套 OpenSandbox），所以才有"健康检查 / 不可用重建"这一支；前端另起"每 5 秒轮询 `/api/async-tasks/{task_id}`"的轮询器。
- `create_deep_agent` **只是函数名**：产出物是主还是子，由**代码位置**决定（写在主文件 = 主，写在子文件 = 子）。
- 部署拓扑/传输可选：ASGI transport（同进程共部署）或 HTTP transport（远程），拓扑分 Single / Split / Hybrid。

---

### P35 Harness 架构的 AsyncSubAgent 解析（三）（7m29）

**一句话定位**：运行闭环——前端 POST `/api/chat/stream` → 主 Agent `start_async_task` → 服务建 thread/run 并立刻返 task_id → SSE 把"任务已启动"推给前端 → 子 Agent 在全局 OpenSandbox 里跑 → **前端每 5 秒轮询 `/api/async-tasks/{task_id}`** → 完成后 state 落盘、页面自动展示结果。

**要点**
- 运行闭环（写侧异步 + 读侧轮询）：前端 POST `/api/chat/stream` → 主 Agent `start_async_task` → 服务建 thread/run 并立刻返 task_id → SSE 把"任务已启动"推给前端 → 子 Agent 在全局 OpenSandbox 里跑 → 前端每 5 秒轮询 `/api/async-tasks/{task_id}` → 完成后 state 落盘、页面自动展示结果。
- **启动编排（现场日志顺序，可直接当部署检查表）**：MCP Server → 初始化沙箱 → 通过 Docker 创建容器 → 连接 MCP Server → 加载子智能体 → 启动 Agent 服务 `127.0.0.1:2024`。
- **异步回执原文**："采购分析任务已经启动……任务编号是 xxx……任务在后台运行，完成后页面会自动展示结果，**您可以继续处理其他事务**"。
- **界面级差别**：同步时那个位置是**停止按钮**、不能再问别的；异步后可以立刻让它"调用技能 / 编写新 Skill / 下载 Skill"。
- **查状态与取消都是自然语言**：说"后台任务执行情况"→ 主 Agent 自主调 `check_async_task`；说"这个后台任务我不想运行了，强制杀掉"→ 调 `cancel_async_task`。**5 个工具全暴露给主智能体，由模型做意图识别自主选择**。
- 结果自动落地：任务完成后页面推送"任务已完成，以下为分析结果"，与同步版结果基本一致，唯一区别是执行者从同步子智能体换成异步子智能体。

**贯穿全组的一句话**：AsyncSubAgent 不是"更快的子代理"，而是**把子代理的生命周期从一次请求里剥离出去**，用"任务 ID + 服务 + 轮询"三件套换取主 Agent 的持续可用。

---

### P36 AI 大模型如何基于 Harness 去找工作（12m21）

**一句话定位**：借 DeepSeek 新开的"Agent Harness 研发工程师"岗位，倒推 Harness 方向的能力清单、技术栈取舍与简历写法（求职建议集，客观压缩）。

**要点**
- **岗位信号**：讲者称"今年 5 月中旬"（口述 5 月 20 号左右）DeepSeek 官方开始面向社会+校招发布 **Agent Harness 研发工程师**，此前主要招算法/模型训练/算子优化方向；讲者引"小道消息"称其首轮（A 轮）估值约 400 亿美金（未证实，仅转述）。
- **企业侧风向**：早期用 Dify 之类搭"内容智能体"，特征是**大量系统提示词、只解决单一任务、只解决简单任务、灵活度不够**；随着 OpenHands/Codex 这一类 Harness 架构智能体走红，企业定制复杂业务智能体也倾向选 Harness 架构。
- **可投的岗位名**：大模型应用工程师、大模型应用算法工程师、**AI Agent 工程师**（DeepSeek 该岗位属此类）、大模型工程师。
- **能力主干（Harness 必会）**：上下文工程 + 驾驭工程（Harness）、Skills（尤其是 **Skill 管理**）、Sandbox（解决安全）、任务规划。
- **RAG 定位被下调但要学透**：RAG 只是智能体里的一个检索工具/小环节，不会独立存在，所以讲的是 **Agentic RAG**（智能体与 RAG 结合）；Skill 只能放少量知识，海量知识库仍必须上企业级向量库——Elasticsearch、PostgreSQL（+向量插件）、Milvus 等；配套要会多路召回、**切片优化**、**两轮以上重排**（粗粒度 + 精细化）、评估、query 重写。
- **推理与部署**：了解大模型推理部署、vLLM 与 SGLang 的推理核心源码；Agent 后端部署走 **FastAPI → ASGI 服务 → Docker 多实例 → 反向代理/负载均衡**。
- **模型层基本功**：神经网络与 Transformer 全流程、各类微调算法、PyTorch（微调/预训练/推理都要用）。
- **框架取舍（明确建议）**：**LangChain / LangGraph / Deep Agents 为主**；**LlamaIndex 不建议再花精力**——理由是它目前还没支持 Harness 架构，正在淡出视野（讲者声明是个人建议）。时间充裕可再看阿里 AgentScope（Java 版，疑似）。
- **Web Coding 与成品智能体**：Codex / Claude Code 至少会一个；会基于 Hermes/OpenHands 类成熟 Harness 智能体做 **Skill 定制与下载**，落到企业具体业务场景。
- **RAG 必学，微调"有概率但要会"**：意图识别环节很多公司在用 **8B 级小模型做定制微调，只干单一场景的意图判别**（讲者举例字节），这类"该走全文检索还是走智能体"的判断最适合小模型微调；会 RAG + 会微调，可投岗位数量明显变多。
- **简历硬门槛（面试官视角）**：简历里**必须有多智能体（Multi-Agent）**，LangGraph supervisor 老架构或 Harness 新架构都行，没有就"投 50 家也不会有电话"；RAG 若写进简历，必须有**切片优化 + 双层/多层索引 + 两层以上重排 + 多层评估**。
- **可抄的简历条目模板**（讲者给的正例，恰好就是本项目）：任务规划、虚拟文件系统、**子智能体委派**、上下文管理、**可插拔 Skills 技能系统**、全生命周期记忆管理、安全沙箱、链路追踪。

**金句结论**
> "现在这个智能体开发一定是偏向于处理那种复杂任务的……耗时就耗时吧，你不能让我在这人也在这等着。"——复杂任务 + 后台执行，正是 AsyncSubAgent 这类岗位能力的由来。
> 简历筛的是**架构词汇的证据**：多智能体、切片优化、多层重排、沙箱、Skills、记忆管理，少一个就少一轮面试。

---

## E. 短问答集（P37–P46）：10 个高频问题

### P37 Harness 是什么？（2m06）

**一句话回答**：Harness 是模型之外那一整套工程系统——模型负责判断，它负责其余一切。

---

### P38 为什么同一个模型在 A 工具好用、在 B 工具就变笨？（2m17）

**一句话回答**：因为你面对的不是裸模型，而是"模型 + Harness"；模型只保下限，Harness 决定上限。

---

### P39 DeepSeek Harness 是模型还是客户端？（3m58）

**一句话回答**：两者都不是——它是一套用来构建、运行、扩展 Agent 的开源框架。

---

### P40 核心设计哲学是什么？Cordis 是什么？（2m26）

**一句话回答**：哲学就五个字"一切皆插件"；Cordis 是只做装载、不承载能力的分层内核，于是系统里没有一个写死的内核。

---

### P41 四种开箱即用模式各自用途？（3m57）

**一句话回答**：标准 / PTC / 极简 / 创造四种 Agent 预设，差别不在"能力多少"，而在这一会话要装哪套插件、朝哪个方向偏。

---

### P42 DeepSeek Harness 的透明体现在哪里？（2m12）

**一句话回答**：模型"能看到的一切"——系统提示词、思维链路、每次工具调用、每次上下文注入——全部写进一份**只增不改的会话日志**，于是整条执行轨迹逐条可查、可恢复、可分叉。

**要点**
- 透明 = "全量留痕 + 只追加"，不是给结果摘要：Agent 每一步的输入（上下文注入）与动作（工具调用）都落盘，事后不改写。
- 现场演示：提问"帮我写一个贪吃蛇"，先 think、再深度搜索，思考全过程直接摊开给用户看。
- 思考里在做方案抉择：桌面版 / Python 命令行版 / HTML 版三条路，最终选 HTML 版（最快），生成单文件代码；完成后自报"已创建 + 怎么玩 + 怎么部署 + 有哪些功能"。
- 日志衍生三种操作：**逐条可查**（整条编程轨迹）、**可恢复**、**可分叉**——从某一步另走一条路线（如改走纯 Python 命令行），也可把分支复制出来继续对话。
- 定位能力升级：过去只知"结果错了"，现在能指出**哪一步、哪个工具、哪段上下文**出错。
- 三个收益可当工程指标用：可调试性、可复现性、信任度。

**金句**
> "让这个 Agent 从原来的黑盒子变成了一个玻璃盒子。"

---

### P43 DeepSeek 的开源生态策略有什么独特之处？（3m11）

**一句话回答**：不是"发布后再慢慢建生态"，而是**发布前**就把需求（卡脖子）、姿态（主动开源）、门槛（低费用）、社区（提前招募 + 全栈接入只认一个标签）四件事铺完。

**要点**
- **卡脖子是需求前提**：讲者称 Claude Code 及若干国外工具会针对中国用户、或员工中含中国人的海外公司"卡脖子"（未给具体手段），这是国产 Harness 的第一层理由。
- **开源姿态**：国外模型多不开源，或只是"迫于压力"开放一部分；DeepSeek 是主动开源。
- **费用**：生态费用做得很低，"可以放心大胆、大量地用"。
- **提前铺社区**：25–26 年就开始筹备；还没发海报、没有 demo 时，几天内近千位开发者带项目报名，社区戏称"开源 Agent 的春晚"。
- **公开招募 + 官方样例**：8 月初团队负责人在 GitHub 公开招募内测开发者，只需留 GitHub ID 与代表作；随后官方放出一批内测插件。
- **接入面全摊开**：Skills、MCP、UI 等全栈"来者不拒"；仓库打上 **DSH** 标签即可运行、并被生态发现。
- 结果只给定性：GitHub 上"昨天发布的东西"star 涨得"非常恐怖"，**未给数字**。

**金句**
> "他不是说在发布之后慢慢建立生态，他是在发布之前就已经把开放社区的生态给铺开了。"

---

### P44 和 Claude Code 对比，商业逻辑有什么不同？（2m14）

**一句话回答**：Claude Code 证明 Harness 是门**年化几十亿美元**的产品生意；DeepSeek Harness 证明同一件事可以"光明正大用开源做"——MIT、模型可插拔、免费、靠生态共建增值，核心资产从"产品"换成"生态和框架"。

**对比表**：

| 维度 | Claude Code | DeepSeek Harness |
|---|---|---|
| 源码 | 闭源 | MIT 开源 |
| 模型 | 锁 Claude | 一切皆插件，可换 |
| 商业模式 | 订阅收费 | 生态共建 + 能力增值 |
| 核心资产 | 产品本身 | 生态和框架 |

**要点**
- 幻灯片首行即给量级："ClaudeCode 证明了 Harness 是一门年化几十亿美元的生意"（口播为"一年几十个亿"，未给出处）。
- 开源史被点明：Claude Code 当年"出了错误、泄露了一部分源码"，但**本质上仍属闭源**。
- MIT 被讲成"底座属于所有人"：约束的是 Harness 这层框架，不是模型权重；"模型可以插拔，不锁定任何一家"。
- 可插拔是产品级事实而非口号：设置里能直接改模型、填自定义接入；默认只在首次安装时推荐 DeepSeek，删掉换别家"没有任何问题"。

---

### P45 为什么说模型在变成水电煤，Harness 成为新主战场？（1m45）

**一句话回答**：模型（Kimi、智谱、GLM 等）能力与价格双双趋同、退化成水电煤之后，差异化整体上移到模型之外那一层——工具调用、沙箱、记忆、编排、错误恢复、透明性与生态，Harness 于是成了"模型之上的操作系统"。

---

### P46 个人观点之 Harness 与新二八原则（3m34）

**一句话回答**：AI 把 80% 很快做完，剩下的 20% 是"能跑→好用"的落地活、成本指数上升且必须由人做；**Harness 的本质就是让这 20% 做得更快、更高效**。

---

## 核心概念速查表

| 概念 | 定义 | 首次出现 |
|---|---|---|
| **Harness** | 模型之外那一整套工程系统——模型负责判断，它负责其余一切 | P37 |
| **Cordis** | 只做装载、不承载能力的分层内核；插件的加载、卸载、依赖关系 | P40 |
| **Agent = Model + Harness** | 公式：Agent 由模型与 Harness 两部分组成 | P16 |
| **驾驭工程** | 驾驭工程 ⊃ 上下文工程 ⊃ 提示词工程 | P16 |
| **一切皆插件** | 所有带 Agent 能力的东西都是插件——模型、工具、Skills、会话、沙箱、存储、循环、调度、UI 本身 | P02 |
| **插件 ≠ 工具** | 插件是"注册了什么能力"，工具是"某次会话实际挂上去、model 能调的" | P02 |
| **模块三问** | 它声明了什么 `ctx.*` 服务？它发出 / 监听什么事件？它注册了什么 effect？ | P02 |
| **三层插件树** | 内置 → profile → 用户，永远后者覆盖前者 | P03 |
| **session.append(...)** | 一切状态变化都落成事件 | P04 |
| **tools/pre-execute / tools/execute / tools/post-execute** | 工具调用的三层 AOP 式拦截，@mode waterfall | P05 |
| **agent vs agent-loop** | agent 定义"智能体是什么"（静态描述层），agent-loop 负责"把这个智能体跑起来"（运行时驱动层） | P06 |
| **turn vs step** | turn 在外、while 在内；一个回合内可跑 N 个 step | P08 |
| **waterfall** | Cordis 的事件模式之一：按注册顺序依次执行，上一环可以把结果传给下一环 | P08 |
| **ReactLoopAgent.turn()** | 一次对话的"回合"，246 行 `private async turn(): Promise<boolean>` | P08 |
| **Agentic RAG** | RAG 不是独立系统，是智能体里的一个检索工具/小环节 | P09 |
| **插件四件套** | 固定引入（`Context` / `defineTool`）+ 插件 `name` + `inject` 硬依赖 + `apply(ctx, config?)` 挂载入口；外挂 `cordis.yml` 声明 | P10 |
| **五问分派表** | CRUD / Agent / RAG / Harness / vibe coding 五个去处 | P11 |
| **ERP_OPENCLAW** | 摩托车零部件采购 ERP + 智能采购助手，Harness 架构 | P14 |
| **write_todos** | Planning 工具，既做拆解，也做状态追踪；清单写进 graph state 的独立字段，不被摘要、不被裁剪 | P17 |
| **CompositeBackend** | 文件后端的路径路由：`/memories/`、`/skills/` 走 `StoreBackend`，其余全走 default（沙箱后端） | P19 |
| **interrupt_on** | 讲者自研 DSL，YAML 配置触发人工介入，`loader.py` 翻译成 LangGraph 的 `interrupt_on` 节点 | P21 |
| **OpenSandbox** | 阿里云 2025 年 12 月开源的容器管理项目，做所有 Skill 执行、命令执行、文件操作的安全边界兜底 | P22 |
| **沙箱防护三件事** | 宿主机文件系统不可见、进程隔离、资源限制 | P22 |
| **Skill 四阶段生命周期** | 同步到沙箱 → 渐进式发现 → 运行时创建/下载 → 分配与持久化 | P24 |
| **执行与存储分离** | 所有 Skill 都在 OpenSandbox 中执行（安全），都持久化到 MongoDB/StoreBackend（永久） | P24 |
| **母 Skill（skill-management）** | 负责 Skill 的全生命周期：下载、创建、测试、分配、清理 | P24 |
| **渐进式披露** | 启动时只加载 SKILL.md 的 frontmatter（元数据），Agent 决策需要某个 Skill 时才 `read_file` 加载完整内容 | P25 |
| **摘要双保险** | `SummarizationMiddleware` 是保底（85% 阈值）；程序员应主动调用 `compact_conversation` 工具做手动摘要 | P26 |
| **文件名只是抽象** | 真正要存的是文本字符串；可直接存库，返回时再包装成 .md 文件 | P28 |
| **两层中断** | ① 自写工具内部调 `interrupt()` 补缺失字段（灵活）；② YAML 里 `interrupt_on: order_create` 做最终审批（克制，只能同意/拒绝） | P30 |
| **上下文工程四流程** | 输入组装（Input）→ 压缩（Compression）→ 隔离（Isolation）→ 长期记忆（Long-term Memory） | P26 |
| **沙箱 5 件套** | `SandboxSync`（SDK）→ `OpenSandboxBackend`（协议适配）→ `SandboxBackendProxy`（稳定句柄 + 热替换）→ `sandbox_manager`（生命周期 + 预热池）→ `SandboxHealthMiddleware`（健康监控） | P23 |
| **AsyncSubAgent 的 4 字段 + 5 工具** | 字段 `name/description/graph_id/url` 决定"找不找得到"；工具 `start/check/update/cancel/list_async_tasks` 决定"能不能操纵" | P34 |
| **SSE 事件流** | FastAPI + `StreamingResponse` + Python 生成器，把流式输出、工具调用、人工介入中断三类事件统一封装成 `text/event-stream` | P31 |
| **9 用户中间件 + 8 框架中间件** | 形成"健康守护 → 上下文注入 → 技能同步 → 摘要压缩 → 记忆更新 → 熔断保护 → 调用限制"的完整生命周期管线 | P32 |
| **AsyncSubAgent** | 把子代理的生命周期从一次请求里剥离出去，用"任务 ID + 服务 + 轮询"三件套换取主 Agent 的持续可用 | P33 |
| **Agent Protocol Server** | = LangGraph 本地服务，`langgraph dev --host 127.0.0.1 --port 2024`；内部以 thread / run / state 三元组管理后台任务 | P33 |
| **新二八原则** | AI 把 80% 很快做完，剩下的 20% 是"能跑→好用"的落地活、成本指数上升且必须由人做；Harness 的本质就是让这 20% 做得更快、更高效 | P46 |

---

## 附录：技术栈速查

| 层 | 技术选型 |
|---|---|
| **前端** | Vue + Vite |
| **后端** | FastAPI + ASGI（uvicorn） |
| **智能体框架** | LangChain / LangGraph / Deep Agents |
| **模型** | DeepSeek-V4 / 智谱 / Ollama（可插拔） |
| **MCP 网关** | FastMCP |
| **沙箱** | OpenSandbox（阿里云 2025 年 12 月开源） |
| **持久化** | MongoDB / StoreBackend / Redis / PostgreSQL |
| **事件流** | SSE（Server-Sent Events） |
| **推理部署** | vLLM / SGLang |
| **容器化** | Docker 多实例 + 反向代理/负载均衡 |
| **插件内核** | Cordis（分层内核，只做装载、不承载能力） |

---

**整理完成。**
