import { z } from 'zod';

// 免费额度配置
export const FreeTierSchema = z.object({
  provider: z.string(),
  model: z.string(),
  totalQuota: z.number(), // 总免费额度（token数或请求数）
  usedQuota: z.number().default(0),
  resetPeriod: z.enum(['daily', 'weekly', 'monthly', 'never']).default('monthly'),
  lastResetAt: z.date().default(() => new Date()),
  enabled: z.boolean().default(true),
  priority: z.number().default(1) // 优先级，数字越小越优先
});

// 额度追踪
export const QuotaTrackerSchema = z.object({
  provider: z.string(),
  model: z.string(),
  remainingTokens: z.number(),
  remainingRequests: z.number().optional(),
  expiresAt: z.date().optional(),
  lastCheckedAt: z.date()
});

export type FreeTierConfig = z.infer<typeof FreeTierSchema>;
export type QuotaTracker = z.infer<typeof QuotaTrackerSchema>;
