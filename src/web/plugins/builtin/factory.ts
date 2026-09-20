import type {
  AccountCredentials,
  ProviderBinding,
  ProviderFactory,
  ProviderHooks,
  ProviderInstance,
} from "../../../core";

/**
 * Builds a typed {@link ProviderInstance} from a binding + hooks. The returned
 * instance is erased to `unknown,unknown` so it fits the factory contract; the
 * domain's materialize step narrows it back per segment.
 */
export function makeInstance<Req, Res>(
  binding: ProviderBinding,
  hooks: ProviderHooks<Req, Res>,
): ProviderInstance<unknown, unknown> {
  const account: AccountCredentials = {
    alias: binding.alias,
    apiToken: binding.apiToken,
    baseUrl: binding.baseUrl,
  };
  return {
    id: binding.alias,
    providerName: binding.providerName,
    account,
    hooks: hooks as unknown as ProviderHooks<unknown, unknown>,
  };
}

/**
 * Builds a {@link ProviderFactory} from per-segment instance builders. Each
 * factory declares which capability segments it can build and dispatches
 * `create(capability, binding)` to the segment-specific builder.
 */
export function makeFactory(
  capabilities: string[],
  builders: Record<string, (binding: ProviderBinding) => ProviderInstance<unknown, unknown>>,
): ProviderFactory {
  return {
    capabilities,
    create(capability, binding) {
      const builder = builders[capability];
      if (!builder) {
        throw new Error(`Provider does not implement capability '${capability}'.`);
      }
      return builder(binding);
    },
  };
}
