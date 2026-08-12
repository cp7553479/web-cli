import type { ProviderFactory } from "./provider";

/**
 * Registry of provider factories keyed by provider name (e.g. "tavily").
 * Built-in factories register first; external plugins register later and may
 * override a same-named factory (project plugins override user plugins
 * override built-in). The domain's materialize step turns factories + config
 * into a {@link ProviderRegistry} of bound instances.
 */
export class PluginHost {
  private readonly factories = new Map<string, ProviderFactory>();

  registerFactory(name: string, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  getFactory(name: string): ProviderFactory | undefined {
    return this.factories.get(name);
  }

  hasFactory(name: string): boolean {
    return this.factories.has(name);
  }

  listFactories(): string[] {
    return [...this.factories.keys()];
  }
}
