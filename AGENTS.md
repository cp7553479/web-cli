# AGENTS.md

> This file is a **rules index + global rules**. Detailed requirements live in
> [`SPEC.md`](./SPEC.md); design in [`docs/architecture.md`](./docs/architecture.md);
> provider contracts in [`docs/provider-apis.md`](./docs/provider-apis.md);
> plugin contract in [`docs/plugin-protocol.md`](./docs/plugin-protocol.md);
> error contract in [`docs/error-handling.md`](./docs/error-handling.md).

## Project

`web` is one CLI that turns **web search** and **web fetch** into reusable
infrastructure, built on a portable abstraction layer (`src/core/`).

## THE core boundary (most important rule)

- `src/core/**` is the **portable abstraction layer**. It MUST NOT import from
  anything outside `src/core/` except external npm packages (`commander`).
  Concretely: never import from `src/web/**`, never import domain request types
  or provider implementations into core.
- Dependency direction is **one-way**: `src/web/**` imports from `src/core/`,
  never the reverse.
- Core is generic over `<Req, Res>`. It never hardcodes capability names
  ("search"/"fetch") — domains instantiate typed pools per capability.
- If a change would require core to know a domain concept, that change
  belongs in the domain layer, not core.

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

7. Config is JSON with fallback order: `./.web/config.json` (project) wins
   when present, else `~/.web/config.json` (auto-initialized with agent
   skills on first run). `api_token` is either a literal or `{$ENV_VAR}`.
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
    DOM), `playwright` (browser fetch). Vendor JS (`Readability`,
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
    `README_CN.md`, and the relevant tests — in the same change.
16. Docs record behavior, decisions, and non-obvious constraints — nothing
    else. No environment trivia ("curl ships with macOS"), no manual setup
    steps: anything a user would have to install belongs in `package.json`.

## Layer map (where things live)

| Concern | Location |
|---|---|
| Portable abstraction | `src/core/` |
| web domain types (Search/Fetch/Image/Ask/ResultItem) | `src/web/protocol/` |
| web config schema, defaults, materialize | `src/web/config/` |
| Provider plugins (all providers, incl. built-ins) | `src/web/plugins/builtin/` + `~/.web/plugins/<id>/` |
| CLI commands | `src/web/cli/commands/` |
| Output rendering | `src/web/output/` |
| Plugin loading (built-in + external) | `src/web/plugins/` (`loadPlugins`) |

Local (per-directory) `AGENTS.md` files may be added later for directory-
specific rules; they must not contradict this file.
