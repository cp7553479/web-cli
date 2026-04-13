import { fetchWithPlaywright } from "../fetch/playwright";
import type { FetchRequest, ProviderContext, ProviderResponse } from "../core/types";
import type { ProviderModelOptions } from "./options";
import type { FetchProvider } from "./types";

export class PlaywrightFetchProvider implements FetchProvider {
  readonly id: string;

  constructor(private readonly model: ProviderModelOptions) {
    this.id = model.alias;
  }

  async fetch(request: FetchRequest, context: ProviderContext): Promise<ProviderResponse> {
    const out = await fetchWithPlaywright(request, context);
    return { ...out, provider: this.id };
  }
}
