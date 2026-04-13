import path from "node:path";

/** 包内 `init/` 模板目录（随 dist 相对定位到仓库根下的 init）。 */
export function resolvePackageInitDir(): string {
  return path.resolve(__dirname, "../../../init");
}
