import { z } from 'zod';

// 聊天消息
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 模型配置
export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  contextWindow: z.number(),
  costPer1KInput: z.number(),
  costPer1KOutput: z.number(),
  capabilities: z.array(z.enum(['text', 'image', 'code', 'reasoning', 'long_context'])),
  priority: z.number().default(1),
  enabled: z.boolean().default(true)
});

// 供应商配置
export const ProviderSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  enabled: z.boolean().default(true),
  rateLimit: z.object({
    requestsPerMinute: z.number().default(60),
    tokensPerMinute: z.number().default(100000)
  }).optional(),
  models: z.array(z.string())
});

// 路由规则
export const RoutingRuleSchema = z.object({
  name: z.string(),
  condition: z.object({
    type: z.enum(['task_type', 'input_length', 'cost_priority', 'time_based', 'custom']),
    value: z.any()
  }),
  targetModels: z.array(z.string()),
  fallbackModels: z.array(z.string()).optional()
});

// 场景优先级配置
export const ScenarioPrioritySchema = z.object({
  scenario: z.string(),
  priorityType: z.enum(['expiry_first', 'speed_first', 'capability_first', 'cost_first']),
  modelRanking: z.array(z.string()).default([]),
  freeTierWillingness: z.number().min(0).max(1),
  description: z.string().optional()
});

// 用户偏好
export const UserPreferenceSchema = z.object({
  defaultPriority: z.enum(['cost', 'quality', 'speed', 'balanced']).default('balanced'),
  monthlyBudget: z.number().default(50),
  preferredProviders: z.array(z.string()).optional(),
  customRules: z.array(RoutingRuleSchema).optional()
});

// 网关配置
export const GatewayConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
    authToken: z.string().optional()
  }),
  providers: z.array(ProviderSchema),
  models: z.array(ModelSchema),
  routing: z.object({
    defaultModel: z.string(),
    rules: z.array(RoutingRuleSchema),
    enableFallback: z.boolean().default(true),
    cacheEnabled: z.boolean().default(true)
  }),
  scenarioPriorities: z.array(ScenarioPrioritySchema).optional(),
  user: UserPreferenceSchema,
  monitoring: z.object({
    enabled: z.boolean().default(true),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    metricsRetention: z.number().default(30) // days
  })
});

export type ModelConfig = z.infer<typeof ModelSchema>;
export type ProviderConfig = z.infer<typeof ProviderSchema>;
export type RoutingRule = z.infer<typeof RoutingRuleSchema>;
export type UserPreference = z.infer<typeof UserPreferenceSchema>;
export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;
export type ScenarioPriorityConfig = z.infer<typeof ScenarioPrioritySchema>;
