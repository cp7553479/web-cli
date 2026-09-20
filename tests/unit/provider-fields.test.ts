import { describe, expect, it } from "vitest";

import type { ProviderConfigField } from "../../src/core";
import { collectFieldValues, seededIo } from "../../src/web/config/provider-fields";

const ENDPOINT_FIELD: ProviderConfigField = {
  key: "base_url",
  label: "Endpoint",
  default: "https://us.acme.test",
  options: [
    {
      label: "Cloud (US)",
      value: "https://us.acme.test",
      fields: [{ key: "model", label: "Model", default: "lite", options: [
        { label: "acme-lite", value: "lite" },
        { label: "acme-pro", value: "pro" },
      ] }],
    },
    { label: "Self-hosted", value: "https://acme.local:8443" },
  ],
};

describe("collectFieldValues (seeded io)", () => {
  it("writes seeded picks including nested levels", async () => {
    const values = await collectFieldValues(
      [ENDPOINT_FIELD],
      seededIo({ base_url: "https://us.acme.test", model: "pro" }),
    );
    expect(values).toEqual({ base_url: "https://us.acme.test", model: "pro" });
  });

  it("skips unseeded fields entirely (no default noise in config)", async () => {
    const values = await collectFieldValues([ENDPOINT_FIELD], seededIo({}));
    expect(values).toEqual({});
  });

  it("writes seeded free-text answers and skips empty ones", async () => {
    const field: ProviderConfigField = { key: "base_url", label: "Base URL (default https://x)" };
    const values = await collectFieldValues([field], seededIo({ base_url: "https://override" }));
    expect(values).toEqual({ base_url: "https://override" });
    const skipped = await collectFieldValues([field], seededIo({}));
    expect(skipped).toEqual({});
  });
});
