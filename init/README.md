[中文文档](README_CN.md)

# Init templates & skills

This directory ships with the npm package and holds the user-facing templates:

- `config.json` — template mirror of the built-in default written by
  `web config init` (the runtime source of truth is
  `src/web/config/defaults.ts`; keep the two in sync).
- `.env.example` — template for `~/.web/.env` API keys.
- `skills/web-cli/` — **publish source** of the Agent skill (SKILL.md +
  examples.md + troubleshooting.md). The `.claude/skills/web-cli/` copy in the
  repo and `~/.web/skills/web-cli/` on a user machine must mirror it.

## Config model

- `~/.web/config.json` is the global config; `./.web/config.json` in a project
  directory is **deep-merged over** it.
- API tokens are plaintext or `{$ENV_VAR}` references, resolved from the
  process environment ← `~/.web/.env` ← `./.web/.env` (later wins).
- The active-account pointer lives in the separate `current.json`, managed by
  `web config use <group> <alias>` — never edit `config.json` for it.

## Multi-account failover

Each capability group (`search`, `fetch`) holds an `account` map. The active
account is tried first, then the rest in declaration order; every failure is
classified and logged before rotating to the next. Multiple accounts with the
same `provider` but different keys form a key pool.

## CLI vs config

- `web search|fetch … --account <alias>`: pin exactly one account.
- `web search|fetch … --provider <nameOrAlias>`: pin one provider type or
  account alias.
- `web search|fetch … --vendor k=v`: provider-native params
  (allowlist-filtered per provider).

Full manual: repository root [README.md](../README.md) /
[README_CN.md](../README_CN.md); authoritative spec: `SPEC.md`.
