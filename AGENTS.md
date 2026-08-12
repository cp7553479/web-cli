# AGENTS.md

> This file is a **rules index + global rules**. Detailed requirements live in
> [`SPEC.md`](./SPEC.md); design in [`docs/architecture.md`](./docs/architecture.md);
> provider contracts in [`docs/provider-apis.md`](./docs/provider-apis.md);
> plugin contract in [`docs/plugin-protocol.md`](./docs/plugin-protocol.md);
> error contract in [`docs/error-handling.md`](./docs/error-handling.md).

## Project

`web` is one CLI that turns **web search** and **web fetch** into reusable
infrastructure, built on a portable abstraction layer (`src/core/`) so the same
architecture can be lifted into other domains (e.g. image generation).

## THE core boundary (most important rule)

- `src/core/**` is the **portable abstraction layer**. It MUST NOT import from
  anything outside `src/core/` except external npm packages (`commander`).
  Concretely: never import from `src/web/**`, never import domain request types
  or provider implementations into core.
- Dependency direction is **one-way**: `src/web/**` imports from `src/core/`,
  never the reverse.
- Core is generic over `<Req, Res>`. It never hardcodes capability names
  ("search"/"fetch") — domains instantiate typed pools per capability.
- Porting `src/core/` to another project = copy the folder. If a change would
  require core to know a domain concept, that change belongs in the domain
  layer, not core.

If you are unsure whether code belongs in core, the test is: *"Could image-cli
use this without modification?"* If yes → core. If no → domain.

## Global rules

### Provider & API

1. Only official APIs / official public endpoints. No scraping of proprietary
   frontends. Before adding or changing a provider, verify the live contract
   against official docs (record findings in `docs/provider-apis.md`).
2. HTTP goes through `curl` via `core`'s `Transport`. No official SDKs. No
   `undici`/`fetch` for provider calls.
3. Do not write fallback / defensive logic. Code a single, simple path that
   matches the verified shape — do not invent branches that try multiple
   response-field shapes, or silent defaults that mask a failure. Only add a
   fallback when there is a concrete, evidenced reason it is truly necessary.
4. Provider request/response handling must be grounded in **actual evidence**,
   not guesses:
   - Obtain the **real request body and response body** by testing against the
     live API (e.g. observe the real error envelope by calling the endpoint
     with and without a key).
   - If no test environment or credentials are available, consult the
     **official API docs** and record the findings in `docs/provider-apis.md`.
   - Never guess a response shape; implement only what the test or docs confirm.
5. Every failover step must be a classified `FailureClass` decision recorded in
   the log (see SPEC §7.1).
6. Provider implementations register **hooks** (`buildRequest` /
   `parseResponse` / `classifyFailure`) with the coordinator; they do not call
   the transport or other providers directly.

### Config & secrets

7. Config is JSON: `~/.web/config.json` (global) + `./.web/config.json`
   (project overlay). `api_token` is either a literal or `{$ENV_VAR}`.
8. The active-account pointer lives in the **separate** `current.json`, never
   in `config.json`.
9. Secrets never reach logs or default stdout. Auth headers
   (`authorization`, `x-subscription-token`, `x-api-key`, `x-goog-api-key`)
   are masked in logs.

### Output & errors

10. Default output is bounded and agent-friendly. Raw requests/responses go to
    logs, not stdout. Validation runs before transport.
11. Errors print a concise message + scoped help to stderr and exit non-zero.
    Stack traces are never normal CLI output.

### Dependencies

12. Minimize dependencies. Admit a library only when a Node built-in or `curl`
    cannot do the job. Current allowed: `commander`, `linkedom` (html2markdown
    DOM), `playwright` (optional browser fetch). Vendor JS (`Readability`,
    `turndown`) is permitted in `src/vendor/`.

### Testing & delivery

13. Tests live only in `tests/`. `tests/unit/` = pure logic (core pool/config/
    classification/transport/renderer). `tests/integration/` = subprocess CLI
    tests against `dist/index.js`. Live network tests must be **gated** by an
    env flag and skipped by default.
14. Delivery gate: any substantive change must keep `npm test` green (it
    includes the build). State the result honestly in the change description.
15. When changing commands, flags, config shape, or provider behavior, update
    **all of**: `SPEC.md`, `docs/provider-apis.md`, `README.md`,
    `README_CN.md`, the **skill copies** (see the Skills section below), and
    the relevant tests — in the same change.

## Skills (Agent 技能文档)

### 位置（三处，内容必须一致）

| 位置 | 角色 |
|---|---|
| `init/skills/web-cli/` | **发布源**（随 npm 包 `files` 发布；改动只在这里写） |
| `.claude/skills/web-cli/` | 仓库内 Agent 读取的副本，与发布源逐字节一致 |
| `~/.web/skills/web-cli/` | 用户机上的安装副本（v2 无 onboard，改完手动同步） |

### SKILL 要求

1. 只写**当前存在**的命令 / flag / provider。写或改之前对照
   `src/web/cli/commands/*` 与 `src/web/providers/catalog.ts` 核实，
   不凭记忆、不从旧版本继承。
2. 示例必须可直接运行：真实命令、真实 flag、真实 provider id；密钥一律写
   `{$ENV_VAR}` 引用，绝不写真实 key。
3. `SKILL.md` frontmatter 的 `description` 必须反映当前实际能力（能力增删
   时同步改）。
4. 命令 / flag / 配置结构 / provider 行为变更时，三处副本在**同一提交**内
   同步（规则 15）。
5. 同步后抽查 `web <cmd> --help` 输出与文档一致。
6. 模板镜像同步：`init/config.json` 与 `init/.env.example` 必须和
   `src/web/config/defaults.ts` 的内置默认值一致。

## Layer map (where things live)

| Concern | Location |
|---|---|
| Portable abstraction | `src/core/` |
| web domain types (Search/Fetch/ResultItem) | `src/web/protocol/` |
| web config schema, defaults, materialize | `src/web/config/` |
| Provider implementations | `src/web/providers/` |
| CLI commands | `src/web/cli/commands/` |
| Output rendering | `src/web/output/` |
| External plugins | `~/.web/plugins/<id>/` (loaded by `src/web/plugins/`) |

Local (per-directory) `AGENTS.md` files may be added later for directory-
specific rules; they must not contradict this file.
