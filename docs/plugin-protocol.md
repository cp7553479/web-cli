# Plugin protocol

How providers plug into `web`. ALL providers — shipped built-ins and external
dirs — are plugins with the same `WebPlugin` contract. The mechanism lives in
core (`PluginHost`); loading is web-domain (`src/web/plugins/`).

## Layering

1. **PluginHost** (`src/core/protocol/plugin-host.ts`) — a `Map<providerName,
   ProviderFactory>`. There is no separate built-in registry: the CLI reaches
   providers ONLY through the host.
2. **ProviderFactory** (`src/core/protocol/provider.ts`) — declares
   `capabilities: string[]` and `create(capability, binding) → ProviderInstance`.
3. **Loader** (`src/web/plugins/index.ts` → `loadPlugins(host)`) — activates
   the built-in plugin modules, then scans external plugin dirs and calls
   `activate(host)` for each.

## Discovery order

1. built-in plugins (`src/web/plugins/builtin/<name>.ts`, shipped in the
   package)
2. `~/.web/plugins/<id>/plugin.json`
3. `./.web/plugins/<id>/plugin.json` (project; overrides user on name collision)

Later registrations override same-named factories, so a project plugin can
override a user plugin, and either can override a built-in.

## Layout

```
src/web/plugins/            built-in plugins (compiled into the package)
  brave.ts … playwright.ts  each exports activate(host)
~/.web/plugins/
  my-vendor/
    plugin.json     { "id": "my-vendor", "main": "index.cjs", "version": "1.0.0" }
    index.cjs       exports a WebPlugin (default or `webPlugin`)
```

- External `main` MUST be a CommonJS module (`.cjs` or require-able `.js`).
- The export is `{ id, version?, activate(host) }`; `activate` receives the
  `PluginHost` and calls `host.registerFactory(name, factory)` — the same
  shape built-ins use. A factory may carry `config` (provider config schema,
  see below).

## Disabling a provider

`providers.<name>.enabled: false` in config disables a provider everywhere;
materialize skips its accounts and `web provider list` / `web doctor` show
`enabled=false`.

## Example

```javascript
// ~/.web/plugins/acme/index.cjs
function activate(host) {
  host.registerFactory("acme", {
    capabilities: ["search"],
    create(capability, binding) {
      // binding = { alias, providerName, apiToken, baseUrl }
      return {
        id: binding.alias,
        providerName: binding.providerName,
        account: { alias: binding.alias, apiToken: binding.apiToken, baseUrl: binding.baseUrl },
        hooks: {
          buildRequest(req, ctx) {
            return {
              method: "POST",
              url: "https://api.acme.test/search",
              headers: { Authorization: `Bearer ${ctx.account.apiToken}`, "Content-Type": "application/json" },
              json: { q: req.query, n: req.limit },
            };
          },
          parseResponse(result, req) {
            const parsed = JSON.parse(result.bodyText);
            return {
              provider: binding.alias,
              items: (parsed.hits || []).map((h) => ({ title: h.title, url: h.url, snippet: h.snippet, source: "acme" })),
              raw: parsed,
            };
          },
        },
      };
    },
  });
}

module.exports = { default: { id: "acme", version: "1.0.0", activate } };
```

Then add to `~/.web/config.json`:

```json
{ "search": { "account": { "acme-main": { "provider": "acme", "api_token": "{$ACME_KEY}" } } } }
```

## Provider config schema (menu → config.json)

A provider — built-in or external — can declare the account fields it
understands by attaching `config` to its factory. ONE schema type serves both
sides, so there is nothing to keep in sync:

- **Menu time** (`web config add`): `label` + `options` render the menu; the
  picked option's `value` (or a free-text answer) becomes the value.
- **Runtime**: the value is written FLAT onto the account entry under `key`
  and handed to the factory via `binding.fields[key]`.

```ts
// inside activate(host), before/after registerFactory
factory.config = [
  {
    key: "base_url",              // account key in config.json (flat string)
    label: "Endpoint",
    default: "https://us.acme.test",
    options: [                    // absent → free-text prompt
      { label: "Cloud (US)", value: "https://us.acme.test", fields: [
        { key: "model", label: "Model", default: "lite", options: [
          { label: "acme-lite", value: "lite" },
          { label: "acme-pro", value: "pro" },
        ]},                       // nested fields open when the parent is picked
      ]},
      { label: "Self-hosted", value: "https://acme.local:8443" },
    ],
  },
];
```

- Values land flat in config.json — `{ "provider": "acme", "base_url": "…",
  "model": "pro" }` — and reach the factory as `binding.fields.model`. The
  runtime reads exactly what the menu wrote; no wrapper, no duplicate fields.
- Unanswered fields are NOT written (no default noise in config.json).
- `web config add <group> <alias> --provider <id> [--token <t>] [--field
  <k=v>]…` drives the schema: numbered menus in a TTY, `--field` pre-answers
  in scripts/agents. Providers without a declared schema get a plain base-URL
  prompt (the catalog default is shown when one exists).

## Hooks (lifecycle)

A provider declares EITHER:
- `buildRequest(req, ctx)` + `parseResponse(result, req, ctx)` (HTTP providers —
  the pool runs the transport between them), OR
- `execute(req, ctx)` (self-contained providers that bypass the HTTP transport,
  e.g. a browser-driven fetch).

Optionally `classifyFailure(error, ctx) → FailureClass`. See
[`error-handling.md`](./error-handling.md).

## CLI

- `web provider list` includes plugin-registered provider ids.
- `web plugins` is intentionally not a command (discovery is via
  `web provider list`).

## Security

External plugins are **in-process `require`** = arbitrary code with full
privileges. Install only trusted plugins. (A sandboxed subprocess runtime is
reserved for the future; the factory interface already accommodates it.)
