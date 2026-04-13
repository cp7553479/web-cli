import { z } from "zod";

export const modelConfigSchema = z.object({
  provider: z.string().min(1),
  api_token: z.string().optional(),
  base_url: z.string().optional(),
  enabled: z.boolean().default(true),
});

export const groupConfigSchema = z.object({
  account: z.record(z.string().min(1), modelConfigSchema),
  inject_before: z.string().optional(),
  inject_after: z.string().optional(),
});

export const webConfigSchema = z.object({
  search: groupConfigSchema,
  fetch: groupConfigSchema,
  research: groupConfigSchema,
  answer: groupConfigSchema,
  runtime: z
    .object({
      logging: z.boolean().optional(),
    })
    .optional(),
});
