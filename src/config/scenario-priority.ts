// 场景优先级配置
export interface ScenarioPriorityConfig {
  scenario: string;
  priorityType: 'expiry_first' | 'speed_first' | 'capability_first' | 'cost_first';
  modelRanking: string[]; // 模型优先级列表
  freeTierWillingness: number; // 免费意愿度 0-1，越高越倾向使用免费模型
  description: string;
}

// 场景优先级映射
export const scenarioPriorities: ScenarioPriorityConfig[] = [
  {
    scenario: 'code',
    priorityType: 'speed_first',
    modelRanking: ['groq/llama-3.1-8b-instant', 'groq/mixtral-8x7b-32768', 'siliconflow/Qwen2.5-7B-Instruct'],
    freeTierWillingness: 0.9, // 代码场景非常愿意使用免费模型（省钱）
    description: '代码生成优先使用免费模型（省钱，Groq速度够快）'
  },
  {
    scenario: 'math',
    priorityType: 'capability_first',
    modelRanking: ['groq/mixtral-8x7b-32768', 'siliconflow/Qwen2.5-7B-Instruct', 'groq/llama-3.1-8b-instant'],
    freeTierWillingness: 0.8, // 数学场景较愿意使用免费模型
    description: '数学推理优先使用免费模型'
  },
  {
    scenario: 'long_context',
    priorityType: 'capability_first',
    modelRanking: ['siliconflow/Qwen2.5-7B-Instruct', 'groq/mixtral-8x7b-32768'],
    freeTierWillingness: 0.7, // 长文本场景中等意愿
    description: '长文本优先使用免费模型（Qwen支持128K）'
  },
  {
    scenario: 'creative',
    priorityType: 'expiry_first',
    modelRanking: [],
    freeTierWillingness: 0.5, // 创意写作中等意愿
    description: '创意写作平衡使用'
  },
  {
    scenario: 'translation',
    priorityType: 'expiry_first',
    modelRanking: [],
    freeTierWillingness: 0.8, // 翻译较愿意使用免费模型
    description: '翻译优先使用免费模型'
  },
  {
    scenario: 'analysis',
    priorityType: 'capability_first',
    modelRanking: ['groq/mixtral-8x7b-32768', 'siliconflow/Qwen2.5-7B-Instruct'],
    freeTierWillingness: 0.6, // 分析任务中等意愿
    description: '分析任务平衡使用'
  },
  {
    scenario: 'general',
    priorityType: 'expiry_first',
    modelRanking: [],
    freeTierWillingness: 0.3, // 通用对话不太愿意使用免费模型（体验优先）
    description: '通用对话优先使用付费模型（体验更好）'
  }
];

// 根据免费意愿度判断是否使用免费模型
export function shouldUseFreeTier(
  willingness: number, 
  userPreference?: { preferFreeTier?: boolean; priority?: string }
): boolean {
  // 用户明确指定优先免费
  if (userPreference?.preferFreeTier === true) return true;
  
  // 用户明确指定质量优先
  if (userPreference?.priority === 'quality') return false;
  
  // 用户明确指定成本优先
  if (userPreference?.priority === 'cost') return true;
  
  // 根据场景意愿度和随机数决定（模拟"犹豫"过程）
  // 意愿度 0.9 = 90% 概率使用免费模型
  // 意愿度 0.3 = 30% 概率使用免费模型
  const random = Math.random();
  return random < willingness;
}

// 获取场景的免费意愿度描述
export function getWillingnessDescription(willingness: number): string {
  if (willingness >= 0.8) return '非常愿意使用免费模型';
  if (willingness >= 0.6) return '较愿意使用免费模型';
  if (willingness >= 0.4) return '平衡使用';
  if (willingness >= 0.2) return '较倾向付费模型';
  return '优先使用付费模型（体验优先）';
}
