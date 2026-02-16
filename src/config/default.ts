import { GatewayConfig } from '../types/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const defaultConfig: GatewayConfig = {
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  
  providers: [
    // {
    //   name: 'openai',
    //   apiKey: process.env.OPENAI_API_KEY || '',
    //   baseUrl: 'https://api.openai.com/v1',
    //   enabled: !!process.env.OPENAI_API_KEY,
    //   rateLimit: {
    //     requestsPerMinute: 60,
    //     tokensPerMinute: 150000
    //   },
    //   models: ['gpt-4o', 'gpt-4o-mini', 'o1-mini']
    // },
    {
      name: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '',
      baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
      enabled: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
      rateLimit: {
        requestsPerMinute: 50,
        tokensPerMinute: 100000
      },
      models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-sonnet-4-20250514']
    },
    {
      name: 'moonshot',
      apiKey: process.env.MOONSHOT_API_KEY || '',
      baseUrl: 'https://api.moonshot.cn/v1',
      enabled: !!process.env.MOONSHOT_API_KEY,
      models: ['kimi-k2.5', 'moonshot-v1-8k']
    },
    // {
    //   name: 'groq',
    //   apiKey: process.env.GROQ_API_KEY || '',
    //   baseUrl: 'https://api.groq.com/openai/v1',
    //   enabled: !!process.env.GROQ_API_KEY,
    //   models: ['llama-3.1-8b-instant', 'mixtral-8x7b-32768']
    // },
    {
      name: 'siliconflow',
      apiKey: process.env.SILICONFLOW_API_KEY || '',
      baseUrl: 'https://api.siliconflow.cn/v1',
      enabled: !!process.env.SILICONFLOW_API_KEY,
      models: ['Qwen2.5-7B-Instruct']
    },
    {
      name: 'aliyun',
      apiKey: process.env.ALIYUN_API_KEY || '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      enabled: !!process.env.ALIYUN_API_KEY,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 200000
      },
      models: [
        // 'deepseek-v3.2',
        // 'kimi-k2.5',
        'qwen3-max-preview',
        'qwen3-max-2026-01-23',
        'glm-4.7',
        'qwen3-vl-plus-2025-12-19',
        'qwen-mt-lite',
        'qwen3-vl-flash-2026-01-22',
        'tongyi-xiaomi-analysis-pro',
        'tongyi-xiaomi-analysis-flash',
        'qwen-plus-2025-12-01',
        'qwen-vl-ocr-2025-11-20',
        'qwen-vl-ocr-2025-08-28',
        'qwen2.5-1.5b-instruct',
        'qwen2.5-0.5b-instruct',
        'deepseek-r1-distill-llama-70b',
        'llama-4-maverick-17b-128e-instruct',
        'llama-4-scout-17b-16e-instruct',
        'MiniMax-M2.1',
        'qwen-flash-character'
      ]
    },
    {
      name: 'minimax',
      apiKey: process.env.MINIMAX_API_KEY || '',
      baseUrl: 'https://api.minimaxi.com/v1',
      enabled: !!process.env.MINIMAX_API_KEY,
      models: ['MiniMax-M2.5', 'MiniMax-M2']
    }
  ],
  
  models: [
    // 免费模型
    // {
    //   id: 'llama-3.1-8b-instant',
    //   name: 'Llama 3.1 8B (Groq)',
    //   provider: 'groq',
    //   contextWindow: 128000,
    //   costPer1KInput: 0,
    //   costPer1KOutput: 0,
    //   capabilities: ['text', 'code'],
    //   priority: 1,
    //   enabled: true
    // },
    // {
    //   id: 'mixtral-8x7b-32768',
    //   name: 'Mixtral 8x7B (Groq)',
    //   provider: 'groq',
    //   contextWindow: 32768,
    //   costPer1KInput: 0,
    //   costPer1KOutput: 0,
    //   capabilities: ['text', 'code'],
    //   priority: 2,
    //   enabled: true
    // },
    {
      id: 'Qwen2.5-7B-Instruct',
      name: 'Qwen2.5 7B (SiliconFlow)',
      provider: 'siliconflow',
      contextWindow: 128000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'long_context'],
      priority: 1,
      enabled: true
    },
    // 付费模型
    // {
    //   id: 'gpt-4o-mini',
    //   name: 'GPT-4o Mini',
    //   provider: 'openai',
    //   contextWindow: 128000,
    //   costPer1KInput: 0.00015,
    //   costPer1KOutput: 0.0006,
    //   capabilities: ['text', 'image'],
    //   priority: 3,
    //   enabled: true
    // },
    // {
    //   id: 'gpt-4o',
    //   name: 'GPT-4o',
    //   provider: 'openai',
    //   contextWindow: 128000,
    //   costPer1KInput: 0.005,
    //   costPer1KOutput: 0.015,
    //   capabilities: ['text', 'image', 'code'],
    //   priority: 4,
    //   enabled: true
    // },
    // {
    //   id: 'o1-mini',
    //   name: 'o1-mini',
    //   provider: 'openai',
    //   contextWindow: 128000,
    //   costPer1KInput: 0.003,
    //   costPer1KOutput: 0.012,
    //   capabilities: ['text', 'reasoning', 'code'],
    //   priority: 5,
    //   enabled: true
    // },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1KInput: 0.003,
      costPer1KOutput: 0.015,
      capabilities: ['text', 'image', 'code'],
      priority: 4,
      enabled: true
    },
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1KInput: 0.003,
      costPer1KOutput: 0.015,
      capabilities: ['text', 'code', 'reasoning', 'long_context'],
      priority: 4,
      enabled: true
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      contextWindow: 200000,
      costPer1KInput: 0.00025,
      costPer1KOutput: 0.00125,
      capabilities: ['text', 'code'],
      priority: 3,
      enabled: true
    },
    {
      id: 'kimi-k2.5',
      name: 'Kimi K2.5',
      provider: 'moonshot',
      contextWindow: 128000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'long_context', 'code', 'reasoning'],
      priority: 1,
      enabled: true
    },
    {
      id: 'moonshot-v1-8k',
      name: 'Moonshot V1 8K',
      provider: 'moonshot',
      contextWindow: 8000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code'],
      priority: 2,
      enabled: true
    },
    // Aliyun 阿里云百炼模型（免费额度）
    // {
    //   id: 'deepseek-v3.2',
    //   name: 'DeepSeek V3.2 (Aliyun)',
    //   provider: 'aliyun',
    //   contextWindow: 128000,
    //   costPer1KInput: 0,
    //   costPer1KOutput: 0,
    //   capabilities: ['text', 'code', 'reasoning', 'long_context'],
    //   priority: 1,
    //   enabled: true
    // },
    {
      id: 'qwen3-max-preview',
      name: 'Qwen3 Max Preview (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code', 'reasoning'],
      priority: 1,
      enabled: true
    },
    {
      id: 'qwen3-max-2026-01-23',
      name: 'Qwen3 Max (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code', 'reasoning'],
      priority: 1,
      enabled: true
    },
    {
      id: 'glm-4.7',
      name: 'GLM 4.7 (Aliyun)',
      provider: 'aliyun',
      contextWindow: 128000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code', 'reasoning'],
      priority: 1,
      enabled: true
    },
    {
      id: 'qwen3-vl-plus-2025-12-19',
      name: 'Qwen3 VL Plus (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'image'],
      priority: 1,
      enabled: true
    },
    {
      id: 'qwen-mt-lite',
      name: 'Qwen MT Lite (Aliyun)',
      provider: 'aliyun',
      contextWindow: 8000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text'],
      priority: 2,
      enabled: true
    },
    {
      id: 'qwen3-vl-flash-2026-01-22',
      name: 'Qwen3 VL Flash (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'image'],
      priority: 1,
      enabled: true
    },
    {
      id: 'tongyi-xiaomi-analysis-pro',
      name: 'Tongyi Xiaomi Analysis Pro (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'reasoning'],
      priority: 1,
      enabled: true
    },
    {
      id: 'tongyi-xiaomi-analysis-flash',
      name: 'Tongyi Xiaomi Analysis Flash (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'reasoning'],
      priority: 2,
      enabled: true
    },
    {
      id: 'qwen-plus-2025-12-01',
      name: 'Qwen Plus (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code', 'reasoning'],
      priority: 1,
      enabled: true
    },
    {
      id: 'qwen-vl-ocr-2025-11-20',
      name: 'Qwen VL OCR (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'image'],
      priority: 1,
      enabled: true
    },
    {
      id: 'qwen-vl-ocr-2025-08-28',
      name: 'Qwen VL OCR Legacy (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'image'],
      priority: 2,
      enabled: true
    },
    {
      id: 'qwen2.5-1.5b-instruct',
      name: 'Qwen2.5 1.5B (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text'],
      priority: 3,
      enabled: true
    },
    {
      id: 'qwen2.5-0.5b-instruct',
      name: 'Qwen2.5 0.5B (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text'],
      priority: 3,
      enabled: true
    },
    {
      id: 'deepseek-r1-distill-llama-70b',
      name: 'DeepSeek R1 Distill Llama 70B (Aliyun)',
      provider: 'aliyun',
      contextWindow: 64000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code', 'reasoning'],
      priority: 1,
      enabled: true
    },
    {
      id: 'llama-4-maverick-17b-128e-instruct',
      name: 'Llama 4 Maverick 17B (Aliyun)',
      provider: 'aliyun',
      contextWindow: 128000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code'],
      priority: 1,
      enabled: true
    },
    {
      id: 'llama-4-scout-17b-16e-instruct',
      name: 'Llama 4 Scout 17B (Aliyun)',
      provider: 'aliyun',
      contextWindow: 128000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code'],
      priority: 1,
      enabled: true
    },
    {
      id: 'MiniMax-M2.1',
      name: 'MiniMax M2.1 (Aliyun)',
      provider: 'aliyun',
      contextWindow: 32000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code'],
      priority: 1,
      enabled: true
    },
    {
      id: 'qwen-flash-character',
      name: 'Qwen Flash Character (Aliyun)',
      provider: 'aliyun',
      contextWindow: 8000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text'],
      priority: 2,
      enabled: true
    },
    // MiniMax 模型
    {
      id: 'MiniMax-M2.5',
      name: 'MiniMax M2.5',
      provider: 'minimax',
      contextWindow: 128000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code', 'reasoning'],
      priority: 1,
      enabled: true
    },
    {
      id: 'MiniMax-M2',
      name: 'MiniMax M2',
      provider: 'minimax',
      contextWindow: 128000,
      costPer1KInput: 0,
      costPer1KOutput: 0,
      capabilities: ['text', 'code'],
      priority: 2,
      enabled: true
    }
  ],
  
  routing: {
    defaultModel: 'gpt-4o-mini',
    enableFallback: true,
    cacheEnabled: true,
    rules: [
      {
        name: '长文本处理',
        condition: {
          type: 'input_length',
          value: { min: 50000 }
        },
        targetModels: ['kimi-k2.5'],
        fallbackModels: ['claude-3-5-sonnet-20241022']
      },
      {
        name: '代码生成',
        condition: {
          type: 'task_type',
          value: ['code', 'programming', 'debug', 'review']
        },
        targetModels: ['claude-3-5-sonnet-20241022', 'gpt-4o'],
        fallbackModels: ['gpt-4o-mini']
      },
      {
        name: '数学推理',
        condition: {
          type: 'task_type',
          value: ['math', 'reasoning', 'logic', 'analysis']
        },
        targetModels: ['o1-mini', 'claude-3-5-sonnet-20241022'],
        fallbackModels: ['gpt-4o']
      },
      {
        name: '经济模式',
        condition: {
          type: 'cost_priority',
          value: 'high'
        },
        targetModels: ['gpt-4o-mini', 'claude-3-haiku-20240307'],
        fallbackModels: ['gpt-4o']
      }
    ]
  },

  // 场景优先级配置（用户可自定义）
  scenarioPriorities: [
    {
      scenario: 'code',
      priorityType: 'speed_first',
      modelRanking: ['groq/llama-3.1-8b-instant', 'groq/mixtral-8x7b-32768', 'siliconflow/Qwen2.5-7B-Instruct'],
      freeTierWillingness: 0.9,
      description: '代码生成优先使用免费模型（省钱，Groq速度够快）'
    },
    {
      scenario: 'math',
      priorityType: 'capability_first',
      modelRanking: ['groq/mixtral-8x7b-32768', 'siliconflow/Qwen2.5-7B-Instruct', 'groq/llama-3.1-8b-instant'],
      freeTierWillingness: 0.8,
      description: '数学推理优先使用免费模型'
    },
    {
      scenario: 'long_context',
      priorityType: 'capability_first',
      modelRanking: ['siliconflow/Qwen2.5-7B-Instruct', 'groq/mixtral-8x7b-32768'],
      freeTierWillingness: 0.7,
      description: '长文本优先使用免费模型（Qwen支持128K）'
    },
    {
      scenario: 'creative',
      priorityType: 'expiry_first',
      modelRanking: [],
      freeTierWillingness: 0.5,
      description: '创意写作平衡使用'
    },
    {
      scenario: 'translation',
      priorityType: 'expiry_first',
      modelRanking: [],
      freeTierWillingness: 0.8,
      description: '翻译优先使用免费模型'
    },
    {
      scenario: 'analysis',
      priorityType: 'capability_first',
      modelRanking: ['groq/mixtral-8x7b-32768', 'siliconflow/Qwen2.5-7B-Instruct'],
      freeTierWillingness: 0.6,
      description: '分析任务平衡使用'
    },
    {
      scenario: 'general',
      priorityType: 'expiry_first',
      modelRanking: [],
      freeTierWillingness: 0.3,
      description: '通用对话优先使用付费模型（体验更好）'
    }
  ],

  user: {
    defaultPriority: 'balanced',
    monthlyBudget: 50,
    preferredProviders: ['groq', 'siliconflow', 'openai', 'anthropic', 'moonshot']
  },
  
  monitoring: {
    enabled: true,
    logLevel: 'info',
    metricsRetention: 30
  }
};

// 加载用户自定义配置
export function loadConfig(): GatewayConfig {
  // 尝试从 config.json 加载用户自定义配置
  try {
    const configPath = path.join(process.cwd(), 'config.json');

    if (fs.existsSync(configPath)) {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      // 合并用户配置和默认配置
      return {
        ...defaultConfig,
        ...userConfig,
        // 如果用户提供了场景优先级配置，使用用户的配置
        scenarioPriorities: userConfig.scenarioPriorities || defaultConfig.scenarioPriorities
      };
    }
  } catch (error) {
    console.warn('加载用户配置失败，使用默认配置:', error);
  }

  return defaultConfig;
}
