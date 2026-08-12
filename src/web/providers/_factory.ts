import type {
  AccountCredentials,
  ProviderBinding,
  ProviderHooks,
  ProviderInstance,
} from "../../core";

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
