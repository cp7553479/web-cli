/**
 * 产品边界场景测试：模拟新用户从安装到使用的各种极端路径。
 *
 * 每个用例都用 tmpdir 隔离 HOME + cwd，不依赖真实 ~/.web 或 ./.web。
 * 全部只验证 exit code + stderr/stdout 中的关键文本。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CLI = path.resolve(__dirname, "../../dist/index.js");
const NODE = process.execPath;

/** 在完全隔离的环境中执行 web CLI（隔离 HOME 和 cwd） */
function runWeb(args: string[], opts: { env?: Record<string, string>; home: string }): { status: number; stdout: string; stderr: string } {
  const cleanEnv: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: opts.home,
    ...opts.env,
  };
  try {
    const stdout = execFileSync(NODE, [CLI, ...args], {
      cwd: opts.home, // cwd 也指向 tmpdir，避免项目级 .web 合并
      env: cleanEnv,
      timeout: 15_000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err: any) {
    return {
      status: err.status ?? 1,
      stdout: (err.stdout ?? "") as string,
      stderr: (err.stderr ?? "") as string,
    };
  }
}

/** 创建隔离临时 HOME 并可选写入 config.toml */
function makeIsolatedHome(configContent?: string): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "web-edge-"));
  const webDir = path.join(home, ".web");
  fs.mkdirSync(webDir, { recursive: true });
  if (configContent !== undefined) {
    fs.writeFileSync(path.join(webDir, "config.toml"), configContent, "utf8");
  }
  return home;
}

// ---------------------------------------------------------------------------
// 1. --help / --version 基础可用性
// ---------------------------------------------------------------------------
describe("CLI 基础可用性", () => {
  const home = makeIsolatedHome();

  it("--version 返回版本号", () => {
    const r = runWeb(["--version"], { home });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it("--help 包含 onboard 命令", () => {
    const r = runWeb(["--help"], { home });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("onboard");
  });

  it("各子命令 --help 输出包含示例", () => {
    for (const cmd of ["search", "fetch", "research", "answer"]) {
      const r = runWeb([cmd, "--help"], { home });
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/示例|example/i);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. 配置文件边界
// ---------------------------------------------------------------------------
describe("配置文件边界", () => {
  it("config.toml 不存在时自动创建默认配置，但因默认模板引用 {$JINA_API_KEY} 等环境变量，无 env 时报错", () => {
    const home = makeIsolatedHome(); // 不写 config.toml
    const r = runWeb(["config", "list"], { home });
    // 默认配置写入成功，但 api_token = {$JINA_API_KEY} 在无 env 时解析失败
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/JINA_API_KEY|env/i);
  });

  it("config.toml 为空文件时报配置校验错误", () => {
    const home = makeIsolatedHome(""); // 空文件
    const r = runWeb(["config", "list"], { home });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Config file validation failed");
  });

  it("config.toml 格式损坏时报 TOML 解析错误", () => {
    const home = makeIsolatedHome("totally invalid toml [[[[");
    const r = runWeb(["config", "list"], { home });
    expect(r.status).toBe(1);
    expect((r.stderr + r.stdout)).toMatch(/invalid|error/i);
  });

  it("config.toml 有 group 但无 account 时正常通过（不报错）", () => {
    const home = makeIsolatedHome(`
[search]
[fetch]
[research]
[answer]
`);
    const r = runWeb(["config", "list"], { home });
    expect(r.status).toBe(0);
    // 输出应包含各 group，account 为空对象
    expect(r.stdout).toContain("search");
    expect(r.stdout).toContain("account");
  });

  it("config.toml 只有部分 group 时报错并指明缺失项", () => {
    const home = makeIsolatedHome(`
[search]
[fetch]
`);
    const r = runWeb(["config", "list"], { home });
    expect(r.status).toBe(1);
    const output = r.stderr + r.stdout;
    expect(output).toContain("Config file validation failed");
    // 应指出 research 或 answer 缺失
    expect(output).toMatch(/research|answer/);
  });

  it("api_token 引用的环境变量未设置时报错并给出修复提示", () => {
    const home = makeIsolatedHome(`
[search.account.jina-main]
provider = "jina"
api_token = "{$MISSING_API_KEY}"
enabled = true
[fetch]
[research]
[answer]
`);
    const r = runWeb(["search", "test"], { home });
    expect(r.status).toBe(1);
    const output = r.stderr + r.stdout;
    expect(output).toContain("MISSING_API_KEY");
    expect(output).toContain(".env");
  });

  it("所有 account 都 enabled=false 时提示无可用账号", () => {
    const home = makeIsolatedHome(`
[search.account.jina-main]
provider = "jina"
api_token = "test-key"
enabled = false
[fetch]
[research]
[answer]
`);
    const r = runWeb(["search", "test"], { home });
    expect(r.status).toBe(1);
    const output = r.stderr + r.stdout;
    expect(output).toMatch(/no accounts|all configured accounts failed/i);
  });
});

// ---------------------------------------------------------------------------
// 3. onboard 流程
// ---------------------------------------------------------------------------
describe("onboard 流程边界", () => {
  it("onboard init 在新 HOME 下成功创建配置", () => {
    const home = makeIsolatedHome();
    const r = runWeb(["onboard", "init"], { home });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Initialized:");
    expect(r.stdout).toContain("Config:");
    expect(r.stdout).toContain("Env:");
  });

  it("onboard init 输出包含后续步骤引导", () => {
    const home = makeIsolatedHome();
    const r = runWeb(["onboard", "init"], { home });
    expect(r.status).toBe(0);
    // 应该告诉用户下一步做什么
    expect(r.stdout).toMatch(/下一步|config list|\.env/i);
  });

  it("onboard init 已有配置时不覆盖（不加 --force），exit 1", () => {
    const home = makeIsolatedHome(`
[search.account.jina-main]
provider = "jina"
api_token = "test"
[fetch]
[research]
[answer]
`);
    const r = runWeb(["onboard", "init"], { home });
    expect(r.status).toBe(1);
    const output = r.stderr + r.stdout;
    expect(output).toMatch(/已存在|exist|--force/i);
  });

  it("onboard init --force 覆盖已有配置", () => {
    const home = makeIsolatedHome(`
[search.account.jina-main]
provider = "jina"
api_token = "test"
[fetch]
[research]
[answer]
`);
    const r = runWeb(["onboard", "init", "--force"], { home });
    expect(r.status).toBe(0);
    const configContent = fs.readFileSync(path.join(home, ".web", "config.toml"), "utf8");
    expect(configContent).toContain("jina-main");
  });

  it("onboard（无子命令）在非 TTY 给出 init 提示", () => {
    const home = makeIsolatedHome();
    const r = runWeb(["onboard"], { home });
    const output = r.stderr + r.stdout;
    expect(output).toMatch(/init|非交互|TTY/i);
  });
});

// ---------------------------------------------------------------------------
// 4. 命令参数边界
// ---------------------------------------------------------------------------
describe("命令参数边界", () => {
  const validConfig = `
[search.account.jina-main]
provider = "jina"
api_token = "test-key"
enabled = true
[fetch]
[research]
[answer]
`;

  it("search 不带查询参数时 exit 1", () => {
    const home = makeIsolatedHome(validConfig);
    const r = runWeb(["search"], { home });
    expect(r.status).toBe(1);
  });

  it("fetch 不带 URL 时 exit 1", () => {
    const home = makeIsolatedHome(validConfig);
    const r = runWeb(["fetch"], { home });
    expect(r.status).toBe(1);
  });

  it("--format 无效值时报错并列出有效选项", () => {
    const home = makeIsolatedHome(validConfig);
    const r = runWeb(["search", "test", "-f", "xml"], { home });
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/json|markdown|text/);
  });

  it("--max-length 非数字时报错", () => {
    const home = makeIsolatedHome(validConfig);
    const r = runWeb(["search", "test", "--max-length", "abc"], { home });
    expect(r.status).toBe(1);
  });

  it("指定不存在的 account 时报错并列出可用账号", () => {
    const home = makeIsolatedHome(validConfig);
    const r = runWeb(["search", "test", "--account", "nonexist"], { home });
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/not found|Available/i);
  });

  it("research 无可用 provider 时给出明确提示", () => {
    const home = makeIsolatedHome(validConfig);
    const r = runWeb(["research", "test"], { home });
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/research|provider/i);
  });
});

// ---------------------------------------------------------------------------
// 5. 安全边界
// ---------------------------------------------------------------------------
describe("安全边界", () => {
  it("config list 不泄露完整 API token", () => {
    const home = makeIsolatedHome(`
[search.account.jina-main]
provider = "jina"
api_token = "sk-this-is-a-secret-token-12345"
enabled = true
[fetch]
[research]
[answer]
`);
    const r = runWeb(["config", "list"], { home });
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("sk-this-is-a-secret-token-12345");
    expect(r.stdout).toMatch(/\*{4}/);
  });
});
