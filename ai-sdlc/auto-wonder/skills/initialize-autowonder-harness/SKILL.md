---
name: initialize-autowonder-harness
description: Use when initializing an AutoWonder workspace from a local harness template containing a squad, digital workers, and their SDLC flows.
---

# Initialize AutoWonder Harness

将本 Skill 同目录的 `harness-config.json` 中的一份或全部模板初始化到用户指定的 AutoWonder 工作空间。只处理小队、数字人、数字人的默认 SDLC；不要扩展到仓库、记忆、能力或工作空间创建。

## 参数与卡片选择

- `workspaceName`：AutoWonder 工作空间名称，也称项目或组织名称。
- `templateName`：值必须与 `template.name` 完全一致；或为“所有模板”，即按配置数组顺序逐一初始化全部模板。

`workspaceName` 或 `templateName` 缺失时，不写纯文本追问，改用宿主环境的卡片式提问（如 AskUserQuestion 或等价交互能力）让用户点选，选择前不执行任何写操作：

- 工作空间卡片：调用 AutoWonder MCP 的 `list_projects` 读取全部空间，每个空间一张卡片，`name` 作选项标签，`description`、访问级别（`accessLevel`）与 `id` 写入描述；只把访问级别为 `READ_WRITE` 或 `ADMIN` 的空间列入卡片，没有可写空间时停止。
- 模板卡片：读取同目录 `harness-config.json` 的全部模板，每份模板一张卡片，`template.name` 作标签，`template.description` 与 `squadSize` 写入描述；在末尾追加一张“所有模板”卡片，含义是按配置数组顺序把全部模板逐一初始化到所选空间。配置只有一份模板时同样展示卡片，“所有模板”与该唯一模板等价。
- 用户在回答卡片时直接给出名称，等同于提供了该参数，按提供值走原有精确匹配逻辑。
- 卡片只负责补全参数，不放宽任何校验：选中的模板仍必须通过配置契约校验，多模板时不得根据默认值、数组顺序或工作空间名称替用户选择。

## 配置契约

模板包含 `{{CUSTOMER.DATABASE_CONFIG}}`、`{{CUSTOMER.DEPLOYMENT_CONFIG}}` 或 `{{CUSTOMER.FRONTEND_TEST_URL}}` 项目占位符时，先读取同目录 [var.md](var.md)，收集客户参数并在独立副本中完成替换及残留校验，再执行平台写入；不要把客户值回填模板母版。仅回答问题时不实例化或发布配置。

读取本文件所在目录的 `harness-config.json`。顶层必须是非空数组，每项结构为：

```text
template + squad + agents[].sdlc?.steps[]
```

执行前一次性校验：

- `template.name`、`template.description`、`squad.name`、`agents` 存在。
- `template.squadSize === agents.length`。
- 数字人的 `name` 和 `roleCode` 在模板内唯一。
- `sdlc` 可以是 `null`；非空时必须有 `name` 和非空 `steps`。
- 步骤按 `order` 严格升序排列，且 `order` 不重复；数组第一项就是入口步骤。
- `checklist` 必须是数组或 `null`，`gatePolicy` 必须是对象或 `null`。
- `isDefault` 仅用于保留来源定义；当前 MCP 没有设置全局默认 SDLC 的接口。值为 `true` 时停止并报告暂不支持，值为 `false` 时不传递。

任何校验失败都在平台写入前停止。配置中的平台 ID、租户、审计、版本字段不参与初始化。

## 调用通道

优先使用内置 MCP 客户端。但客户端会按 output schema 校验响应，空 SDLC 列表和步骤里的 `null` 字段都可能被判为非法并返回 `-32602`，读接口因此拿不到已创建对象的 ID。遇到 `-32602` 时不要改写配置去迁就校验，也不要跳过回读，直接对该调用降级为原始 JSON-RPC：

- 端点 `POST <publicBaseUrl>/api/mcp`，认证头 `Authorization: Bearer <token>`。
- 请求体是标准 JSON-RPC，工具调用用 `method: "tools/call"`，参数放在 `params.arguments`。
- 从响应里自行解析对象 ID，作为后续写入的输入。

所有请求体必须先写入临时文件再以 `--data @<file>` 形式发送。含中文的大请求体（约 8KB 起）经命令行内联传参会被 shell 静默截断或改写，表现为接口返回成功但数据未落库，因此禁止内联 `--data`。

## 执行流程

1. 确定目标工作空间。用户提供了 `workspaceName` 时，调用 AutoWonder MCP 的 `list_projects` 精确匹配：必须唯一，且访问级别为 `READ_WRITE` 或 `ADMIN`；否则停止。不要模糊匹配，也不要创建工作空间。工作空间来自卡片选择时，其名称与访问级别已取自同一次 `list_projects` 结果，直接进入下一步。
2. 读取 `list_squads`、`list_agents`、`list_sdlcs` 完成预检。名称完全相同且配置可确认一致的对象可以复用；同名但关键字段不同、同名多条或无法完整确认时停止并报告冲突。不要覆盖或删除既有对象。
3. 先创建每个非空 `sdlc`：
   - `name`、`description`、`workType` 传给 `create_sdlc`。
   - 按数组顺序调用 `add_sdlc_step`。映射：`order -> stepOrder`、`instruction -> instructionMd`；`checklist` 和 `gatePolicy` 分别序列化为 `checklistJson`、`gatePolicyJson`；其余工具支持的同名步骤字段完整传递，包括已读取的未改值和 `null`，避免省略字段导致数据丢失。
   - 当配置 `status` 为 `ENABLED` 时调用 `enable_sdlc`。不要虚构全局默认 SDLC 或状态模板绑定。
4. 创建数字人：`name`、`roleCode`、`roleName`、`responsibilities -> agentMd`、`businessBackground -> soulMd` 传给 `create_agent`。
5. 对每个新数字人调用 `update_agent_config`，发送工具支持的完整配置，包括未改值和 `null`；若其 `sdlc` 非空，使用步骤 3 得到的 SDLC ID；若为空则显式发送 `sdlcId: null`。传递 `evolutionMode`（如配置存在）。
6. 调用 `submit_agent_for_review`，成功后调用 `publish_agent`。平台只有数字人版本需要评审和发布；不要虚构小队发布操作。
7. 创建小队并调用 `add_agent_to_squad` 加入全部数字人。若小队已被安全复用，只补齐缺失成员；不要自动移除额外成员。
8. 用 `get_sdlc`、`get_agent`/`get_agent_version`、`get_squad` 回读验证名称、角色、正文、默认 SDLC、步骤顺序和成员关系。写入可能静默失败，所以回读要做逐项断言：每个 SDLC 的步骤数量必须与配置中 `steps` 的长度完全相等，并按 `stepOrder` 逐个核对 `instructionMd`；数量不足、顺序不符或正文被截断都判定为写入失败，不得因接口曾返回成功而认定通过。
9. 用户选择“所有模板”时，按 `harness-config.json` 数组顺序对每份模板完整执行步骤 2-8，模板之间互不共享预检与回读结论；任一模板失败即停止后续模板的全部写入，在最终报告中按模板分组列出结果。

平台不提供跨对象事务。任一步失败后停止后续写入，列出已创建、已复用、已发布和未完成对象；不要承诺回滚，不要自动删除已创建对象。结果不确定的超时先回读确认，再决定是否重试。

## 结果格式

返回工作空间、模板名称（或“所有模板”及其展开的每份模板名），以及小队、数字人、SDLC 的 `创建 / 复用 / 发布 / 冲突 / 未完成` 清单。只有回读验证全部通过时才报告初始化成功。

## 常见错误

| 错误 | 正确处理 |
|---|---|
| 多模板时选择第一项或 `default` | 未提供时用卡片让用户选择，含“所有模板”选项；不替用户挑选 |
| 缺参数时只发纯文本追问 | 用卡片式选项：空间来自 `list_projects`，模板来自 `harness-config.json` |
| 把 SQL 中的数据库 ID 带到新工作空间 | 只使用模板业务字段，记录 MCP 返回的新 ID |
| 先创建数字人再猜测 SDLC ID | 先创建并启用 SDLC，再配置数字人默认 SDLC |
| 假设平台能事务回滚 | 失败即停止、回读并报告部分结果 |
| 发布小队或绑定小队级 SDLC | 平台没有这些操作；只发布数字人版本 |
| 读接口返回 `-32602` 就认定对象不存在 | 那是客户端 output schema 校验失败；降级为原始 JSON-RPC 直连 `/api/mcp` 重新读取 |
| 把含中文的大请求体内联传给命令行 | 会静默不落库；请求体一律写入文件后用 `--data @<file>` 发送，并按步骤数量回读确认 |
