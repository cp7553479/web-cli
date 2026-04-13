import type { WebConfig } from "../config/types";
import { InMemoryProviderRegistry } from "../providers/registry";
import type { PluginRegistrationApi, ProviderFactory } from "./protocol";

export class PluginHost implements PluginRegistrationApi {
  private factories = new Map<string, ProviderFactory>();

  registerProvider(name: string, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  materialize(config: WebConfig): InMemoryProviderRegistry {
    const registry = new InMemoryProviderRegistry();

    for (const [alias, model] of Object.entries(config.search.account)) {
      if (model.enabled === false) continue;
      const factory = this.factories.get(model.provider);
      if (!factory?.createSearch) {
        continue;
      }
      registry.registerSearch(factory.createSearch({ alias, model }));
    }

    for (const [alias, model] of Object.entries(config.fetch.account)) {
      if (model.enabled === false) continue;
      const factory = this.factories.get(model.provider);
      if (!factory?.createFetch) {
        continue;
      }
      registry.registerFetch(factory.createFetch({ alias, model }));
    }

    for (const [alias, model] of Object.entries(config.answer.account)) {
      if (model.enabled === false) continue;
      const factory = this.factories.get(model.provider);
      if (!factory?.createAnswer) {
        continue;
      }
      registry.registerAnswer(factory.createAnswer({ alias, model }));
    }

    for (const [alias, model] of Object.entries(config.research.account)) {
      if (model.enabled === false) continue;
      const factory = this.factories.get(model.provider);
      if (!factory?.createResearch) {
        continue;
      }
      registry.registerResearch(factory.createResearch({ alias, model }));
    }

    return registry;
  }
}
