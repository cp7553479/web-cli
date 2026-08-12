import { describe, expect, it } from "vitest";

import { ProviderError } from "../../src/core";
import { ensureSuccess } from "../../src/web/providers/_http";
import type { TransportResult } from "../../src/core";

function result(statusCode: number, bodyText: string): TransportResult {
  return { statusCode, headers: {}, bodyText };
}

describe("ensureSuccess (single-path, status-based)", () => {
  it("is a no-op on 2xx", () => {
    expect(() => ensureSuccess("X", result(200, "{}"))).not.toThrow();
    expect(() => ensureSuccess("X", result(204, ""))).not.toThrow();
  });

  it("classifies 401/403 as retryable-credential and embeds the raw body", () => {
    // Real Tavily shape (verified): {"detail":{"error":"..."}}
    try {
      ensureSuccess("Tavily", result(401, '{"detail":{"error":"Unauthorized"}}'));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      expect((e as ProviderError).classification).toBe("retryable-credential");
      expect((e as ProviderError).message).toContain("Tavily HTTP 401");
      // the raw body is preserved verbatim — no provider-specific parsing
      expect((e as ProviderError).message).toContain('{"detail":{"error":"Unauthorized"}}');
    }
  });

  it("classifies 429/5xx as retryable-transport", () => {
    try {
      ensureSuccess("X", result(429, "rate limited"));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ProviderError);
      expect((e as ProviderError).classification).toBe("retryable-transport");
    }
    try {
      ensureSuccess("X", result(503, "down"));
    } catch (e) {
      expect((e as ProviderError).classification).toBe("retryable-transport");
    }
  });

  it("classifies other 4xx as non-retryable-request (stops failover)", () => {
    // Real Brave shape: 422 validation for missing token
    try {
      ensureSuccess("Brave", result(422, '{"error":{"code":"VALIDATION"}}'));
    } catch (e) {
      expect((e as ProviderError).classification).toBe("non-retryable-request");
    }
  });

  it("handles empty body without throwing inside the classifier", () => {
    expect(() => ensureSuccess("X", result(500, ""))).toThrow(/HTTP 500/);
  });
});
