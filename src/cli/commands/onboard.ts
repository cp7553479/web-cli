import { Command } from "commander";

import { getConfigPaths, getProjectConfigPaths } from "../../config";
import { copyInitToWebHome } from "../onboard/init-copy";
import { runOnboardWizard } from "../onboard/wizard";

export function registerOnboardCommand(program: Command): void {
  const cmd = program.command("onboard").description("配置 ~/.web：交互向导或从模板初始化");

  cmd
    .command("init")
    .description("从仓库 init 复制 config.toml、.env.example（→ ~/.web/.env）与 skills，到 ~/.web")
    .option("--force", "覆盖已存在的全局配置")
    .action((opts: { force?: boolean }) => {
      copyInitToWebHome({ force: Boolean(opts.force) });
    });

  cmd
    .action(async () => {
      await runOnboardWizard();
    });

  cmd.addHelpText(
    "after",
    `
示例:
  web onboard              # TUI 向导（仅写入 ~/.web）
  web onboard init         # 无交互复制 init 模板
  web onboard init --force   # 覆盖已有全局配置

说明:
  - 运行时 CLI 会先读 ~/.web，再合并当前目录 ./.web（若存在）。
  - onboard init 会同步 init/skills/web-cli → ~/.web/skills，并在已存在的 ~/.agent/skills、~/.claude/skills 等目录下写入 web-cli。
  - 非 TTY 环境请使用 web onboard init。
`,
  );

  const root = getConfigPaths().rootDir;
  const proj = getProjectConfigPaths(process.cwd());
  cmd.addHelpText("before", `全局配置目录: ${root}\n项目覆写: ${proj?.rootDir ?? "(无)"}\n`);
}
