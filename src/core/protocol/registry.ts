import type { ProviderInstance } from "./provider";

/**
 * In-memory registry of materialized provider instances, keyed by capability
 * segment then by account alias. Capability segments are domain-defined strings
 * ("search", "fetch"); core never hardcodes them.
 */
export class ProviderRegistry<Req, Res> {
  private readonly segments = new Map<string, Map<string, ProviderInstance<Req, Res>>>();

  register(segment: string, instance: ProviderInstance<Req, Res>): void {
    let bucket = this.segments.get(segment);
    if (!bucket) {
      bucket = new Map();
      this.segments.set(segment, bucket);
    }
    bucket.set(instance.id, instance);
  }

  list(segment: string): ProviderInstance<Req, Res>[] {
    const bucket = this.segments.get(segment);
    return bucket ? [...bucket.values()] : [];
  }

  get(segment: string, id: string): ProviderInstance<Req, Res> | undefined {
    return this.segments.get(segment)?.get(id);
  }

  segmentsList(): string[] {
    return [...this.segments.keys()];
  }
}
