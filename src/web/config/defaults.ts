/**
 * Default `config.json` written on first run / `web config init`. Accounts start
 * empty — the user adds providers via `web config set` or by editing the file.
 * Kept as a stable JSON string (not built from objects) so the on-disk file is
 * diff-friendly and self-documenting.
 */
export const DEFAULT_CONFIG_JSON = `{
  "runtime": {
    "logging": true
  },
  "search": {
    "inject_before": "",
    "inject_after": "",
    "account": {}
  },
  "fetch": {
    "inject_before": "",
    "inject_after": "",
    "account": {}
  }
}
`;

export const DEFAULT_ENV_EXAMPLE = `# web-cli environment variables for {\$ENV} token references in config.json
# Example: set TAVILY_API_KEY below, then in config.json use "api_token": "{\$TAVILY_API_KEY}"
# TAVILY_API_KEY=
# BRAVE_API_KEY=
# JINA_API_KEY=
# FIRECRAWL_API_KEY=
# PERPLEXITY_API_KEY=
`;
