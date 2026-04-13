export type GroupName = "search" | "fetch" | "research" | "answer";

export interface ModelConfig {
  provider: string;
  api_token?: string;
  base_url?: string;
  enabled?: boolean;
}

export interface GroupConfig {
  account: Record<string, ModelConfig>;
  inject_before?: string;
  inject_after?: string;
}

export interface WebConfig {
  search: GroupConfig;
  fetch: GroupConfig;
  research: GroupConfig;
  answer: GroupConfig;
  runtime?: {
    logging?: boolean;
  };
}
