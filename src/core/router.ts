import { GatewayConfig, ModelConfig, RoutingRule, ChatMessage, ScenarioPriorityConfig } from '../types/config.js';
import { QuotaManager } from './quota.js';
import { scenarioPriorities as defaultScenarioPriorities, shouldUseFreeTier, getWillingnessDescription } from '../config/scenario-priority.js';

export interface RoutingDecision {
  model: string;
  provider: string;
  reason: string;
  estimatedCost: number;
  fallbackModels: string[];
  isFreeTier: boolean;
}

export class RoutingEngine {
  private config: GatewayConfig;
  private modelMap: Map<string, ModelConfig>;
  private quotaManager: QuotaManager;
  private scenarioPriorities: ScenarioPriorityConfig[];

  constructor(config: GatewayConfig, quotaManager?: QuotaManager) {
    this.config = config;
    this.modelMap = new Map(config.models.map(m => [m.id, m]));
    this.quotaManager = quotaManager || new QuotaManager();
    // 使用配置中的场景优先级，如果没有则使用默认值
    this.scenarioPriorities = config.scenarioPriorities || defaultScenarioPriorities;
  }

  // 注册免费额度模型
  registerFreeTierModels(): void {
    const freeModels = [
      // Groq 免费模型
      // {
      //   provider: 'groq',
      //   model: 'llama-3.1-8b-instant',
      //   totalQuota: 1000000,
      //   usedQuota: 0,
      //   resetPeriod: 'monthly' as const,
      //   lastResetAt: new Date(),
      //   enabled: true,
      //   priority: 1
      // },
      // SiliconFlow 免费模型
      {
        provider: 'siliconflow',
        model: 'Qwen2.5-7B-Instruct',
        totalQuota: 500000,
        usedQuota: 0,
        resetPeriod: 'daily' as const,
        lastResetAt: new Date(),
        enabled: true,
        priority: 2
      },
      // Moonshot 免费模型
      {
        provider: 'moonshot',
        model: 'moonshot-v1-8k',
        totalQuota: 500000,
        usedQuota: 0,
        resetPeriod: 'monthly' as const,
        lastResetAt: new Date(),
        enabled: true,
        priority: 2
      },
      // Aliyun 免费模型
      // {
      //   provider: 'aliyun',
      //   model: 'deepseek-v3.2',
      //   totalQuota: 1000000,
      //   usedQuota: 0,
      //   resetPeriod: 'monthly' as const,
      //   lastResetAt: new Date('2026-03-03'),
      //   enabled: true,
      //   priority: 1
      // },
      // {
      //   provider: 'aliyun',
      //   model: 'kimi-k2.5',
      //   totalQuota: 1000000,
      //   usedQuota: 0,
      //   resetPeriod: 'monthly' as const,
      //   lastResetAt: new Date('2026-04-30'),
      //   enabled: true,
      //   priority: 1
      // },
      {
        provider: 'aliyun',
        model: 'qwen3-max-preview',
        totalQuota: 999884,
        usedQuota: 116,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-03-03'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'qwen3-max-2026-01-23',
        totalQuota: 1000000,
        usedQuota: 500914,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-04-23'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'glm-4.7',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-03-25'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'qwen3-vl-plus-2025-12-19',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-03-19'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'qwen-mt-lite',
        totalQuota: 1000000,
        usedQuota: 20,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-02-18'),
        enabled: true,
        priority: 2
      },
      {
        provider: 'aliyun',
        model: 'qwen3-vl-flash-2026-01-22',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-04-22'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'tongyi-xiaomi-analysis-pro',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-04-09'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'tongyi-xiaomi-analysis-flash',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-04-09'),
        enabled: true,
        priority: 2
      },
      {
        provider: 'aliyun',
        model: 'qwen-plus-2025-12-01',
        totalQuota: 1000000,
        usedQuota: 19,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-03-01'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'qwen-vl-ocr-2025-11-20',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-02-18'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'qwen-vl-ocr-2025-08-28',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-03-03'),
        enabled: true,
        priority: 2
      },
      {
        provider: 'aliyun',
        model: 'qwen2.5-1.5b-instruct',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-02-25'),
        enabled: true,
        priority: 3
      },
      {
        provider: 'aliyun',
        model: 'qwen2.5-0.5b-instruct',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-02-25'),
        enabled: true,
        priority: 3
      },
      {
        provider: 'aliyun',
        model: 'deepseek-r1-distill-llama-70b',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-02-25'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'llama-4-maverick-17b-128e-instruct',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-02-25'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'llama-4-scout-17b-16e-instruct',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-02-25'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'MiniMax-M2.1',
        totalQuota: 1000000,
        usedQuota: 0,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-04-23'),
        enabled: true,
        priority: 1
      },
      {
        provider: 'aliyun',
        model: 'qwen-flash-character',
        totalQuota: 1000000,
        usedQuota: 62,
        resetPeriod: 'never' as const,
        lastResetAt: new Date('2026-04-23'),
        enabled: true,
        priority: 2
      }
    ];

    for (const model of freeModels) {
      this.quotaManager.registerFreeTier(model);
    }
  }

  // 主路由决策
  decideModel(
    messages: ChatMessage[],
    userPreference?: { priority?: string; preferredModel?: string; preferFreeTier?: boolean },
    context?: { excludedModels?: string[]; attemptNumber?: number; previousError?: any }
  ): RoutingDecision {
    const excludedSet = new Set(context?.excludedModels || []);
    // 1. 如果用户明确指定了模型
    if (userPreference?.preferredModel && userPreference.preferredModel !== 'auto') {
      const model = this.modelMap.get(userPreference.preferredModel);
      if (model && model.enabled && !excludedSet.has(model.id)) {
        const isFree = this.quotaManager.hasFreeTier(model.provider, model.id);
        return {
          model: model.id,
          provider: model.provider,
          reason: isFree ? '用户指定（免费额度）' : '用户指定',
          estimatedCost: isFree ? 0 : this.estimateCost(messages, model),
          fallbackModels: this.getFallbackModels(model.id, excludedSet),
          isFreeTier: isFree
        };
      }
    }

    // 2. 计算输入长度
    const inputLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    
    // 3. 识别任务类型
    const taskType = this.detectTaskType(messages);
    
    // 4. 获取场景配置（包含免费意愿度）
    const scenarioConfig = this.getScenarioPriorityConfig(taskType);
    
    // 5. 根据场景免费意愿度决定是否使用免费模型
    const useFreeTier = shouldUseFreeTier(scenarioConfig.freeTierWillingness, userPreference);
    
    if (useFreeTier) {
      const freeModel = this.findBestFreeModel(inputLength, taskType, excludedSet);
      if (freeModel) {
        const hoursUntilExpiry = Math.floor((freeModel.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
        const timeText = hoursUntilExpiry < 24
          ? `${hoursUntilExpiry}小时后过期`
          : `${Math.floor(hoursUntilExpiry / 24)}天后过期`;

        const priorityText = this.getPriorityTypeText(freeModel.priorityType);
        const willingnessText = getWillingnessDescription(scenarioConfig.freeTierWillingness);

        return {
          model: freeModel.model,
          provider: freeModel.provider,
          reason: `场景: ${scenarioConfig.scenario} (${willingnessText}, ${priorityText}, ${freeModel.remaining.toLocaleString()} tokens, ${timeText})`,
          estimatedCost: 0,
          fallbackModels: this.getFallbackModels(freeModel.model, excludedSet),
          isFreeTier: true
        };
      }
    }

    // 5. 应用路由规则
    for (const rule of this.config.routing.rules) {
      if (this.matchesRule(rule, inputLength, taskType, userPreference?.priority)) {
        const targetModel = rule.targetModels[0];
        const model = this.modelMap.get(targetModel);

        if (model && model.enabled && !excludedSet.has(model.id)) {
          // 检查是否有同能力的免费模型（先过期优先）
          const freeAlternative = this.findFreeAlternative(model, inputLength, excludedSet);
          if (freeAlternative && userPreference?.preferFreeTier !== false) {
            const hoursUntilExpiry = Math.floor((freeAlternative.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
            const timeText = hoursUntilExpiry < 24
              ? `${hoursUntilExpiry}小时后过期`
              : `${Math.floor(hoursUntilExpiry / 24)}天后过期`;

            return {
              model: freeAlternative.model,
              provider: freeAlternative.provider,
              reason: `同场景免费替代 (${timeText}): ${rule.name}`,
              estimatedCost: 0,
              fallbackModels: [model.id, ...(rule.fallbackModels || [])].filter(m => !excludedSet.has(m)),
              isFreeTier: true
            };
          }

          const isFree = this.quotaManager.hasFreeTier(model.provider, model.id);
          return {
            model: model.id,
            provider: model.provider,
            reason: `规则匹配: ${rule.name}`,
            estimatedCost: isFree ? 0 : this.estimateCost(messages, model),
            fallbackModels: rule.fallbackModels ? rule.fallbackModels.filter(m => !excludedSet.has(m)) : this.getFallbackModels(model.id, excludedSet),
            isFreeTier: isFree
          };
        }
      }
    }

    // 6. 默认模型
    const defaultModel = this.modelMap.get(this.config.routing.defaultModel)!;
    const freeAlternative = this.findFreeAlternative(defaultModel, inputLength, excludedSet);

    if (freeAlternative && userPreference?.preferFreeTier !== false) {
      const hoursUntilExpiry = Math.floor((freeAlternative.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
      const timeText = hoursUntilExpiry < 24
        ? `${hoursUntilExpiry}小时后过期`
        : `${Math.floor(hoursUntilExpiry / 24)}天后过期`;

      return {
        model: freeAlternative.model,
        provider: freeAlternative.provider,
        reason: `默认模型（免费替代，${timeText}）`,
        estimatedCost: 0,
        fallbackModels: excludedSet.has(defaultModel.id) ? [] : [defaultModel.id],
        isFreeTier: true
      };
    }

    const isFree = this.quotaManager.hasFreeTier(defaultModel.provider, defaultModel.id);
    return {
      model: defaultModel.id,
      provider: defaultModel.provider,
      reason: '默认模型',
      estimatedCost: isFree ? 0 : this.estimateCost(messages, defaultModel),
      fallbackModels: this.getFallbackModels(defaultModel.id, excludedSet),
      isFreeTier: isFree
    };
  }

  // 查找最佳免费模型（支持场景优先级）
  private findBestFreeModel(
    inputLength: number,
    taskTypes: string[],
    excludedSet: Set<string> = new Set()
  ): {
    provider: string;
    model: string;
    remaining: number;
    expiresAt: Date;
    priorityType: string;
  } | null {
    const freeModels = this.quotaManager.getAvailableFreeTiers();
    if (freeModels.length === 0) return null;

    // 获取场景优先级配置
    const scenarioConfig = this.getScenarioPriorityConfig(taskTypes);

    // 过滤符合条件的模型
    const candidates = freeModels.filter(freeModel => {
      const modelConfig = this.modelMap.get(freeModel.model);
      if (!modelConfig) return false;

      // 排除已失败的模型
      if (excludedSet.has(freeModel.model)) return false;

      // 检查上下文长度是否满足
      if (modelConfig.contextWindow < inputLength * 4) return false;

      // 检查能力是否匹配
      const canHandleTask = this.canModelHandleTask(modelConfig, taskTypes);
      if (!canHandleTask) return false;

      return true;
    });
    
    if (candidates.length === 0) return null;
    
    // 根据场景优先级类型排序
    let sortedCandidates = candidates;
    
    switch (scenarioConfig.priorityType) {
      case 'speed_first':
        // 速度优先：Groq 排前面
        sortedCandidates = this.sortBySpeedPriority(candidates);
        break;
        
      case 'capability_first':
        // 能力优先：按配置的模型排名
        sortedCandidates = this.sortByCapabilityPriority(candidates, scenarioConfig.modelRanking);
        break;
        
      case 'expiry_first':
      default:
        // 先过期优先（默认）
        sortedCandidates = candidates.sort((a, b) => 
          a.expiresAt.getTime() - b.expiresAt.getTime()
        );
        break;
    }
    
    const selected = sortedCandidates[0];
    return {
      ...selected,
      priorityType: scenarioConfig.priorityType
    };
  }

  // 获取场景优先级配置
  private getScenarioPriorityConfig(taskTypes: string[]): ScenarioPriorityConfig {
    for (const taskType of taskTypes) {
      const config = this.scenarioPriorities.find(sp => sp.scenario === taskType);
      if (config) return config;
    }
    // 默认返回通用配置
    return this.scenarioPriorities.find(sp => sp.scenario === 'general')!;
  }

  // 按速度优先级排序（Groq 优先）
  private sortBySpeedPriority(candidates: any[]): any[] {
    const speedRanking: Record<string, number> = {
      'groq': 1,
      'siliconflow': 2
    };
    
    return candidates.sort((a, b) => {
      const aSpeed = speedRanking[a.provider] || 99;
      const bSpeed = speedRanking[b.provider] || 99;
      return aSpeed - bSpeed;
    });
  }

  // 按能力优先级排序
  private sortByCapabilityPriority(candidates: any[], modelRanking: string[]): any[] {
    if (modelRanking.length === 0) {
      // 没有配置排名，使用默认的先过期优先
      return candidates.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
    }
    
    // 按配置的模型排名排序
    return candidates.sort((a, b) => {
      const aRank = modelRanking.indexOf(`${a.provider}/${a.model}`);
      const bRank = modelRanking.indexOf(`${b.provider}/${b.model}`);
      
      // 如果都不在排名列表中，按过期时间排序
      if (aRank === -1 && bRank === -1) {
        return a.expiresAt.getTime() - b.expiresAt.getTime();
      }
      
      // 在排名中的优先
      if (aRank === -1) return 1;
      if (bRank === -1) return -1;
      
      return aRank - bRank;
    });
  }

  // 获取优先级类型中文描述
  private getPriorityTypeText(priorityType: string): string {
    const textMap: Record<string, string> = {
      'expiry_first': '先过期优先',
      'speed_first': '速度优先',
      'capability_first': '能力优先',
      'cost_first': '成本优先'
    };
    return textMap[priorityType] || '智能优先';
  }

  // 查找免费替代方案（先过期优先）
  private findFreeAlternative(targetModel: ModelConfig, inputLength: number, excludedSet: Set<string> = new Set()): {
    provider: string;
    model: string;
    remaining: number;
    expiresAt: Date;
  } | null {
    const freeModels = this.quotaManager.getAvailableFreeTiers();

    for (const freeModel of freeModels) {
      const modelConfig = this.modelMap.get(freeModel.model);
      if (!modelConfig) continue;

      // 排除已失败的模型
      if (excludedSet.has(freeModel.model)) continue;

      // 检查能力是否匹配或接近
      const capabilitiesMatch = this.compareCapabilities(targetModel, modelConfig);
      if (!capabilitiesMatch) continue;

      // 检查上下文长度
      if (modelConfig.contextWindow < inputLength * 4) continue;

      return freeModel;
    }
    
    return null;
  }

  // 检查模型是否能处理任务类型
  private canModelHandleTask(model: ModelConfig, taskTypes: string[]): boolean {
    const capabilities = model.capabilities;
    
    for (const task of taskTypes) {
      switch (task) {
        case 'code':
          if (!capabilities.includes('code')) return false;
          break;
        case 'math':
        case 'reasoning':
          if (!capabilities.includes('reasoning')) return false;
          break;
        case 'long_context':
          if (!capabilities.includes('long_context')) return false;
          break;
        default:
          // 通用任务，基本都能处理
          break;
      }
    }
    
    return true;
  }

  // 比较两个模型的能力匹配度
  private compareCapabilities(target: ModelConfig, alternative: ModelConfig): boolean {
    // 检查替代模型是否具备目标模型的核心能力
    const coreCapabilities = target.capabilities;
    const altCapabilities = alternative.capabilities;
    
    // 至少具备 60% 的核心能力
    const matchingCapabilities = coreCapabilities.filter(c => altCapabilities.includes(c));
    return matchingCapabilities.length >= coreCapabilities.length * 0.6;
  }

  // 检测任务类型
  private detectTaskType(messages: ChatMessage[]): string[] {
    const content = messages.map(m => m.content.toLowerCase()).join(' ');
    const types: string[] = [];
    
    // 代码相关
    if (/\b(code|programming|debug|function|class|api|bug|error|python|javascript|java|cpp|go|rust)\b/.test(content)) {
      types.push('code');
    }
    
    // 数学/推理
    if (/\b(math|calculate|solve|equation|logic|reasoning|proof|algorithm|compute)\b/.test(content)) {
      types.push('math');
    }
    
    // 创意写作
    if (/\b(write|story|creative|poem|essay|blog|article|novel|fiction)\b/.test(content)) {
      types.push('creative');
    }
    
    // 分析
    if (/\b(analyze|analysis|compare|evaluate|assess|review|summarize|explain)\b/.test(content)) {
      types.push('analysis');
    }
    
    // 翻译
    if (/\b(translate|translation|中文|英文|日语|法语|german|spanish)\b/.test(content)) {
      types.push('translation');
    }
    
    // 长文本
    if (content.length > 10000) {
      types.push('long_context');
    }
    
    return types.length > 0 ? types : ['general'];
  }

  // 匹配路由规则
  private matchesRule(
    rule: RoutingRule,
    inputLength: number,
    taskTypes: string[],
    priority?: string
  ): boolean {
    const { type, value } = rule.condition;
    
    switch (type) {
      case 'input_length':
        if (value.min && inputLength < value.min) return false;
        if (value.max && inputLength > value.max) return false;
        return true;
        
      case 'task_type':
        return taskTypes.some(t => value.includes(t));
        
      case 'cost_priority':
        return priority === value;
        
      case 'time_based':
        const hour = new Date().getHours();
        if (value.peakHours) {
          const [start, end] = value.peakHours;
          return hour >= start && hour <= end;
        }
        return false;
        
      default:
        return false;
    }
  }

  // 估算成本
  private estimateCost(messages: ChatMessage[], model: ModelConfig): number {
    const inputTokens = Math.ceil(
      messages.reduce((sum, m) => sum + m.content.length, 0) / 4
    );
    const estimatedOutputTokens = Math.min(inputTokens * 0.5, 2000);
    
    const inputCost = (inputTokens / 1000) * model.costPer1KInput;
    const outputCost = (estimatedOutputTokens / 1000) * model.costPer1KOutput;
    
    return Number((inputCost + outputCost).toFixed(6));
  }

  // 获取备选模型
  private getFallbackModels(modelId: string, excludedSet: Set<string> = new Set()): string[] {
    const currentModel = this.modelMap.get(modelId);
    if (!currentModel) return [];

    // 优先选择有免费额度的备选
    const freeModels = this.quotaManager.getAvailableFreeTiers();
    const freeFallbacks = freeModels
      .filter(fm => fm.model !== modelId && !excludedSet.has(fm.model))
      .map(fm => fm.model);

    // 选择同类型的其他付费模型
    const paidModels = this.config.models
      .filter(m =>
        m.id !== modelId &&
        m.enabled &&
        !excludedSet.has(m.id) &&
        !this.quotaManager.hasFreeTier(m.provider, m.id)
      )
      .sort((a, b) => a.priority - b.priority)
      .map(m => m.id);

    return [...freeFallbacks, ...paidModels].slice(0, 3);
  }

  // 获取所有可用模型
  getAvailableModels(): ModelConfig[] {
    return this.config.models.filter(m => m.enabled);
  }

  // 获取额度管理器
  getQuotaManager(): QuotaManager {
    return this.quotaManager;
  }

  // 获取额度状态
  getQuotaStatus() {
    return this.quotaManager.getAllQuotaStatus();
  }

  // 获取额度预警
  getLowQuotaAlerts(threshold?: number, expiryWarningHours?: number) {
    return this.quotaManager.getLowQuotaAlerts(threshold, expiryWarningHours);
  }
}
