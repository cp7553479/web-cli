# Provider 插件协议

## 分层

1. **协议层**（`src/plugins/protocol.ts`）
   定义 `PluginRegistrationApi`：以厂商名注册 `ProviderFactory`，每个 factory 可声明 `createSearch` / `createFetch` / `createAnswer` 三类子组件。

2. **宿主**（`src/plugins/host.ts`）
   `PluginHost` 维护一个 `Map<厂商名, ProviderFactory>`。`materialize(config)` 时，遍历 config 各能力段的 `account`，根据 `provider`（厂商名）查找 factory，按当前能力段上下文调用对应的 `createSearch` / `createFetch` / `createAnswer`，生成 `InMemoryProviderRegistry`。

3. **内置插件**（`src/plugins/builtin.ts`）
   当前所有官方对接的 provider 以厂商为单位注册，**不**放在 `~/.web/plugins`。

4. **外部插件加载器**（`src/plugins/loader.ts`）
   扫描全局配置根下的 `plugins/<name>/web-plugin.json`（默认 `~/.web/plugins`；若设置环境变量 **`WEB_HOME`** 则为 `$WEB_HOME/plugins`），`require` 入口模块并调用 `activate(api)`。

## 配置如何映射到实例

全局 `config.toml`（默认 `~/.web/config.toml`；若设置 **`WEB_HOME`** 则为 `$WEB_HOME/config.toml`）中每条 model：

```toml
[search.account.my-alias]
provider = "tavily"
api_token = "{$TAVILY_API_KEY}"
```

`provider` 字段写**厂商名**，必须与某插件注册的 factory 名一致。`PluginHost` 根据当前能力段（search / fetch / answer）为每个启用的 `(alias, model)` 调用 factory 对应的 `createSearch` / `createFetch` / `createAnswer`，得到 provider 实例；实例的 `id` 为 **alias**（与 orchestrator 查找一致）。

如果某厂商未提供当前能力段所需的子组件（如在 `[fetch]` 段配了 `provider = "tavily"` 但 tavily factory 没有 `createFetch`），该 model 会被跳过并输出 debug 日志。

## 外部插件目录布局

```
<全局配置根>/plugins/   # 默认 ~/.web/plugins；WEB_HOME 时为 $WEB_HOME/plugins
  my-vendor/
    web-plugin.json
    index.cjs
```

### web-plugin.json

```json
{
  "id": "my-vendor",
  "main": "index.cjs",
  "version": "1.0.0"
}
```

- `main`：相对插件目录的入口文件，**当前仅支持 CommonJS**（`.cjs` 或可被 `require` 的 `.js`）。
- 入口须导出 `WebPlugin`：`default` 或 `webPlugin` 字段。

### index.cjs 示例

```javascript
function activate(api) {
  api.registerProvider("acme", {
    createSearch(binding) {
      return {
        id: binding.alias,
        async search(request, context) {
          return { provider: binding.alias, items: [], raw: null };
        },
      };
    },
    createFetch(binding) {
      return {
        id: binding.alias,
        async fetch(request, context) {
          return { provider: binding.alias, items: [], raw: null };
        },
      };
    },
  });
}

module.exports = {
  default: { id: "my-vendor", version: "1.0.0", activate },
};
```

将 `provider = "acme"` 写入 config 对应能力段即可使用（需自行实现 HTTP 调用与错误处理）。

## 覆盖内置 provider

后加载的外部插件若对同一厂商名再次 `registerProvider`，会覆盖先前 factory（内置先注册，外部后加载时可覆盖）。覆盖行为无单独 CLI 开关；可在 `<cwd>/.web/logs/` 中查看已记录的外部插件加载与请求日志（`runtime.logging` 未关闭时）。

## CLI

- `web plugins list`：列出已发现的外部插件 manifest。

## 安全说明

外部插件为**用户本机任意代码**，执行等同于在 Node 中 `require` 用户脚本。仅从可信来源安装插件。
