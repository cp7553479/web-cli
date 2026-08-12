# Error handling

How `web` classifies, retries, reports, and records failures. Companion to
`SPEC.md` §7.1 (FailureClass) and §11.

## CLI boundary

Owned by `src/core/cli/program.ts` (`runCliProgram`):

- `AppError` (and ordinary `Error`s) print a concise message to stderr and set
  `process.exitCode = 1`. Stack traces are never part of normal output.
- commander usage/help errors keep their default behavior (exit non-zero, scoped
  help).

## Validation (protocol layer)

Owned by `src/web/protocol/requests.ts` + `global-flags.ts`. Validation runs
**before** any transport call. Failures are flag-specific (`Invalid value 'x'
for --flag. Expected …`).

## Provider failure classification

Owned by `src/core/protocol/classification.ts` + each provider's hooks. Every
provider failure is mapped to a `FailureClass` for **diagnostics only**
(logged per attempt, included in `ALL_FAILED` details):

| Class | Meaning |
|---|---|
| `retryable-credential` | auth/quota tied to this key (401/403) |
| `retryable-transport` | transient network/5xx (429/5xx, curl errors) |
| `non-retryable-request` | 4xx request error (400/404/422/…) |
| `unsupported` | provider cannot serve this request shape |
| `unknown` | unclassified |

**Rotation rule (single, simple):** on any failure, advance to the next
configured account. The class is recorded but does not gate rotation. We do not
short-circuit on `non-retryable-request` because HTTP status is unreliable —
Brave returns 422 for invalid-token auth errors, which are account-specific and
must rotate.

Precedence for assigning the class (see `classifyFailure` in `pool.ts`):

1. `ProviderError` carries its own class → use it.
2. provider's `classifyFailure` hook (if present) → use it.
3. core transport error (`code` starts with `TRANSPORT_`) → `retryable-transport`.
4. otherwise → `unknown`.

`ensureSuccess` (in `src/web/providers/_http.ts`) inspects `result.statusCode`
and throws `new ProviderError(classifyHttpStatus(statusCode), msg)` for ≥400.
The message carries the **raw response body excerpt verbatim** — every
provider's error envelope is shaped differently, and the raw body is the most
informative detail, so we do not parse a provider-specific error field.

## Logging

`runtime.logging` defaults to `true`. `FileLogger` writes to
`<effective-.web>/logs/<date>-<id>.log`. Each pool attempt records
`(id, provider, classification, message)` as `pool.attempt`; HTTP requests log
masked auth headers; responses log status + length. Secrets never reach logs.

## Self-check

`web config doctor` reports: config parses, curl on PATH, every account's
provider has a registered factory, `{$ENV}` references resolve.
