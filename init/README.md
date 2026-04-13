[中文文档](README_CN.md)

# Init templates

`web onboard init` copies `config.toml` and `.env.example` from this directory into `~/.web/` (the env template becomes `~/.web/.env`; use `--force` to overwrite existing files). At runtime, `./.web/config.toml` and `./.web/.env` under a project **deep-merge** over the global home config.

## Multi-account and same-vendor failover

Under each capability (`[search]`, `[fetch]`, `[answer]`, `[research]`) you can define multiple `[*.account.accountId]` blocks. **Declaration order is try order**: failures fall through silently until one succeeds or all fail.

Multiple blocks with the same `provider` but different account ids (e.g. two Tavily keys) implement a key pool / rotation.

## CLI vs config

- `web search|fetch|answer|research … --provider <accountId or vendor>`: narrow to one account, or to all accounts for that vendor in file order.
- `web … --account <accountId>`: pin exactly one account; optional `--provider` checks the vendor.
- `web search|answer|research … --providers a b` is **multi concurrent**; **cannot** be combined with `--account`.
- `web answer` takes the question as a **positional** argument (`web answer "question"`), not `--query`.

Full manual: repository root [README.md](../README.md) / [README_CN.md](../README_CN.md).
