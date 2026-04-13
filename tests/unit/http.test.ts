import { describe, expect, it } from "vitest";

import { httpJson } from "../../src/core/http";

describe("httpJson", () => {
  it("正常 JSON API 返回 parsed 对象", async () => {
    const result = await httpJson("https://httpbin.org/get", { timeoutMs: 10000 });
    expect(result).toHaveProperty("url");
    expect((result as any).url).toContain("httpbin.org");
  }, 15000);

  it("HTTP 4xx 抛出 AppError（HTTP_STATUS_ERROR）", async () => {
    await expect(
      httpJson("https://httpbin.org/status/403", { timeoutMs: 10000 }),
    ).rejects.toThrow(/HTTP 403/);
  }, 15000);

  it("HTTP 2xx 非 JSON 响应抛出 HTTP_INVALID_JSON", async () => {
    await expect(
      httpJson("https://httpbin.org/html", { timeoutMs: 10000 }),
    ).rejects.toThrow(/not valid JSON/);
  }, 15000);

  it("日志中不泄露完整 Authorization header", async () => {
    const logs: unknown[] = [];
    const fakeLogger = { log: (_label: string, payload: unknown) => logs.push(payload), close: () => {}, filePath: "" };
    await httpJson("https://httpbin.org/get", {
      timeoutMs: 10000,
      headers: { Authorization: "Bearer sk-test-secret-key-12345" },
      fileLogger: fakeLogger as any,
    });
    const reqLog = logs[0] as any;
    expect(reqLog.headers.Authorization).toContain("****");
    expect(reqLog.headers.Authorization).not.toContain("sk-test-secret-key-12345");
  }, 15000);
});
