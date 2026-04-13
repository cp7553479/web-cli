import { AppError } from "../core/errors";
import type { GroupConfig, GroupName } from "./types";

export type ResolveForcedAccountOpts = {
  vendorOrAlias?: string;
  accountId?: string;
};

function availableList(group: GroupConfig): string[] {
  const order = Object.keys(group.account);
  const providerTypes = [...new Set(Object.values(group.account).map((m) => m.provider))];
  return [...order, ...providerTypes.filter((t) => !order.includes(t))];
}

/**
 * 解析本组内应尝试的 account id 顺序。
 * - 无 vendor、无 account：全量按 [group.account.*] 声明顺序。
 * - 仅 accountId：单条；若同时传 vendorOrAlias，校验该账号的 provider 与厂商名一致。
 * - 仅 vendorOrAlias：若与某账号 id 完全同名则单条；否则按声明顺序筛出 provider 匹配的子序列。
 */
export function resolveForcedAccountOrder(
  group: GroupConfig,
  groupName: GroupName,
  opts: ResolveForcedAccountOpts,
): string[] {
  const order = Object.keys(group.account);
  const { vendorOrAlias, accountId } = opts;
  const hint = () => availableList(group).join(", ");

  if (!vendorOrAlias && !accountId) {
    return order;
  }

  if (accountId) {
    const model = group.account[accountId];
    if (!model) {
      throw new AppError(
        `Account id '${accountId}' not found. Available for ${groupName}: ${hint()}`,
        "CONFIG_MODEL_NOT_FOUND",
      );
    }
    if (vendorOrAlias && model.provider !== vendorOrAlias) {
      throw new AppError(
        `Account '${accountId}' uses provider '${model.provider}', not '${vendorOrAlias}'.`,
        "ACCOUNT_PROVIDER_MISMATCH",
      );
    }
    return [accountId];
  }

  const v = vendorOrAlias as string;
  if (group.account[v]) {
    return [v];
  }

  const filtered = order.filter((id) => group.account[id]?.provider === v);
  if (filtered.length === 0) {
    throw new AppError(
      `Unsupported provider '${v}'. Available for ${groupName}: ${hint()}`,
      "PROVIDER_NOT_FOUND",
    );
  }
  return filtered;
}
