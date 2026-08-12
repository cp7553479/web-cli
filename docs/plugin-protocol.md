# Plugin protocol

How external providers plug into `web`. The mechanism lives in core
(`PluginHost`); discovery + loading is web-domain (`src/web/plugins/external.ts`).

## Layering

1. **PluginHost** (`src/core/protocol/plugin-host.ts`) — a `Map<providerName,
   ProviderFactory>`. Built-in factories register first; external plugins
   register later and may override a same-named factory.
2. **ProviderFactory** (`src/core/protocol/provider.ts`) — declares
   `capabilities: string[]` and `create(capability, binding) → ProviderInstance`.
3. **External loader** (`src/web/plugins/external.ts`) — scans
   `~/.web/plugins/<id>/plugin.json`, `require`s the entry, and calls
   `activate(host)`.

## Discovery order

1. `~/.web/plugins/<id>/plugin.json`
2. `./.web/plugins/<id>/plugin.json` (project; overrides user on name collision)
3. built-in factories (registered first, so plugins override them)

## Layout

```
~/.web/plugins/
  my-vendor/
    plugin.json     { "id": "my-vendor", "main": "index.cjs", "version": "1.0.0" }
    index.cjs       exports a WebPlugin (default or `webPlugin`)
```

- `main` MUST be a CommonJS module (`.cjs` or require-able `.js`).
- The export is `{ id, version?, activate(api) }`; `activate` receives the
  `PluginHost` and calls `api.registerProvider(name, factory)`.

## Example

```javascript
// ~/.web/plugins/acme/index.cjs
function activate(api) {
  api.registerProvider("acme", {
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
- `web plugins` is intentionally not a command in v1 (discovery is via
  `web provider list`).

## Security

External plugins are **in-process `require`** = arbitrary code with full
privileges. Install only trusted plugins. (A sandboxed subprocess runtime is
reserved for a future revision; the factory interface already accommodates it.)
