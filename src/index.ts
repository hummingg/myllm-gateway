import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { loadConfig } from './config/default.js';
import { RoutingEngine } from './core/router.js';
import { Monitor, RequestLog, FullRequestLog } from './core/monitor.js';
import { QuotaManager } from './core/quota.js';
import { BaseProvider, ProviderBalance, OpenAIProvider, AnthropicProvider, MoonshotProvider, GroqProvider, SiliconFlowProvider, AliyunProvider, MinimaxProvider, NvidiaProvider, IflowProvider, DeepSeekProvider, OllamaProvider, ChatCompletionRequest } from './providers/base.js';
import { GatewayConfig, ModelConfig, ProviderConfig, RetryConfig } from './types/config.js';
import { RetryManager } from './core/retry.js';
import { ErrorType } from './types/error.js';
import { PiiDetector } from './core/pii-detector.js';
import { SemanticCache } from './core/semantic-cache.js';

class LLMGateway {
  private app: express.Application;
  private config: GatewayConfig;
  private router: RoutingEngine;
  private monitor: Monitor;
  private quotaManager: QuotaManager;
  private providers: Map<string, BaseProvider> = new Map();
  private retryManager: RetryManager;
  private piiDetector: PiiDetector;
  private semanticCache: SemanticCache;

  constructor() {
    this.app = express();
    this.config = loadConfig();
    this.quotaManager = new QuotaManager('./data');
    this.router = new RoutingEngine(this.config, this.quotaManager);
    this.monitor = new Monitor(
      this.config.monitoring.logLevel,
      this.config.monitoring.metricsRetention
    );

    this.initializeProviders();
    this.router.registerFreeTierModels();

    // 初始化重试管理器
    const retryConfig: RetryConfig = this.config.retry || {
      maxAttempts: 3,
      enableRerouting: true,
      exponentialBackoff: true,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      retryableErrors: [
        'network_error',
        'rate_limit',
        'server_error',
        'quota_exceeded'
      ]
    };
    this.retryManager = new RetryManager(retryConfig, this.router, this.providers);

    this.piiDetector = new PiiDetector(
      process.env.OLLAMA_HOST || 'http://localhost:11434/v1',
      process.env.PII_DETECTION_ENABLED === 'true'
    );

    // 初始化语义缓存（使用 Ollama 本地 embedding）
    this.semanticCache = new SemanticCache({
      enabled: process.env.SEMANTIC_CACHE_ENABLED === 'true',
      similarityThreshold: parseFloat(process.env.SEMANTIC_CACHE_THRESHOLD || '0.95'),
      maxEntries: parseInt(process.env.SEMANTIC_CACHE_MAX_ENTRIES || '1000'),
      ttlMs: parseInt(process.env.SEMANTIC_CACHE_TTL_MS || '3600000'),
      dataDir: process.env.SEMANTIC_CACHE_DIR || './data/cache'
    });

    this.setupMiddleware();
    this.setupRoutes();

    // 确保 config.json 存在，首次运行时初始化
    const configPath = path.join(process.cwd(), 'config.json');
    if (!fs.existsSync(configPath)) {
      this.saveConfig();
      console.log('📄 已初始化 config.json');
    }
  }

  private initializeProviders(): void {
    for (const providerConfig of this.config.providers) {
      if (!providerConfig.enabled || !providerConfig.apiKey) {
        console.log(`⚠️  跳过 ${providerConfig.name}: 未启用或缺少 API Key`);
        continue;
      }

      const models = this.config.models.filter(m => 
        providerConfig.models.includes(m.id)
      );

      if (models.length === 0) {
        console.log(`⚠️  跳过 ${providerConfig.name}: 没有可用模型`);
        continue;
      }

      let provider: BaseProvider;
      
      switch (providerConfig.name) {
        case 'openai':
          provider = new OpenAIProvider(providerConfig, models);
          break;
        case 'anthropic':
          provider = new AnthropicProvider(providerConfig, models);
          break;
        case 'moonshot':
          provider = new MoonshotProvider(providerConfig, models);
          break;
        case 'groq':
          provider = new GroqProvider(providerConfig, models);
          break;
        case 'siliconflow':
          provider = new SiliconFlowProvider(providerConfig, models);
          break;
        case 'aliyun':
          provider = new AliyunProvider(providerConfig, models);
          break;
        case 'minimax':
          provider = new MinimaxProvider(providerConfig, models);
          break;
        case 'nvidia':
          provider = new NvidiaProvider(providerConfig, models);
          break;
        case 'iflow':
          provider = new IflowProvider(providerConfig, models);
          break;
        case 'deepseek':
          provider = new DeepSeekProvider(providerConfig, models);
          break;
        case 'ollama':
          provider = new OllamaProvider(providerConfig, models);
          break;
        default:
          console.log(`⚠️  未知供应商: ${providerConfig.name}`);
          continue;
      }

      this.providers.set(providerConfig.name, provider);
      console.log(`✅ 初始化供应商: ${providerConfig.name} (${models.length} 个模型)`);
    }

    console.log(`\n📊 共初始化 ${this.providers.size} 个供应商\n`);
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(morgan('combined'));

    // API 认证
    if (this.config.server.authToken) {
      this.app.use((req, res, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token !== this.config.server.authToken) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Web UI 静态文件服务
    this.app.use('/webui', express.static('./webui'));
    this.app.get('/', (req, res) => {
      res.redirect('/webui/index.html');
    });

    // 健康检查
    this.app.get('/health', (req, res) => {
      const quotaStatus = this.router.getQuotaStatus();
      res.json({
        status: 'ok',
        providers: Array.from(this.providers.keys()),
        models: this.router.getAvailableModels().map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          contextWindow: m.contextWindow,
          costPer1KInput: m.costPer1KInput,
          costPer1KOutput: m.costPer1KOutput,
          capabilities: m.capabilities,
          tags: m.tags,
          enabled: m.enabled
        })),
        freeTier: {
          total: quotaStatus.length,
          available: quotaStatus.filter(q => q.remaining > 0).length,
          models: quotaStatus.filter(q => q.remaining > 0).map(q => ({
            model: q.model,
            remaining: q.remaining,
            nextReset: q.nextReset
          }))
        }
      });
    });

    // 获取可用模型列表
    this.app.get('/v1/models', (req, res) => {
      const models = this.router.getAvailableModels().map(m => {
        const remainingQuota = this.quotaManager.getRemainingQuota(m.provider, m.id);
        return {
          id: m.id,
          name: m.name,
          provider: m.provider,
          capabilities: m.capabilities,
          costPer1KInput: m.costPer1KInput,
          costPer1KOutput: m.costPer1KOutput,
          freeTierRemaining: remainingQuota > 0 ? remainingQuota : undefined
        };
      });
      res.json({ object: 'list', data: models });
    });

    // 获取额度状态
    this.app.get('/quota', (req, res) => {
      const status = this.router.getQuotaStatus();
      res.json({ data: status });
    });

    // 获取额度预警（包含即将过期提醒）
    this.app.get('/quota/alerts', (req, res) => {
      const threshold = parseInt(req.query.threshold as string) || 1000;
      const expiryWarningHours = parseInt(req.query.expiry_hours as string) || 24;
      const alerts = this.router.getLowQuotaAlerts(threshold, expiryWarningHours);
      
      // 按原因分类
      const lowQuotaAlerts = alerts.filter(a => a.reason === 'low_quota');
      const expiringSoonAlerts = alerts.filter(a => a.reason === 'expiring_soon');
      
      res.json({ 
        threshold,
        expiry_warning_hours: expiryWarningHours,
        total_alerts: alerts.length,
        low_quota: {
          count: lowQuotaAlerts.length,
          alerts: lowQuotaAlerts
        },
        expiring_soon: {
          count: expiringSoonAlerts.length,
          alerts: expiringSoonAlerts
        },
        all_alerts: alerts
      });
    });

    // 手动注册免费额度模型
    this.app.post('/quota/register', (req, res) => {
      const { provider, model, totalQuota, resetPeriod, priority } = req.body;

      this.quotaManager.registerFreeTier({
        provider,
        model,
        totalQuota,
        resetPeriod: resetPeriod || 'monthly',
        priority: priority || 1,
        usedQuota: 0,
        enabled: true,
        lastResetAt: new Date()
      });
      
      res.json({ 
        success: true, 
        message: `已注册免费额度: ${provider}:${model}` 
      });
    });

    // 查询所有支持余额查询的 provider 余额
    this.app.get('/balance', async (req, res) => {
      const balances: ProviderBalance[] = [];
      for (const [name, provider] of this.providers) {
        const balance = await provider.checkBalance();
        if (balance) balances.push(balance);
      }
      res.json({ balances });
    });

    // 查询指定 provider 的余额
    this.app.get('/balance/:provider', async (req, res) => {
      const provider = this.providers.get(req.params.provider);
      if (!provider) {
        return res.status(404).json({ error: `供应商 ${req.params.provider} 不存在` });
      }
      const balance = await provider.checkBalance();
      if (!balance) {
        return res.json({ balance: null, message: '该供应商不支持余额查询' });
      }
      res.json({ balance });
    });

    // 获取统计数据
    this.app.get('/stats', (req, res) => {
      const stats = this.monitor.getRealtimeMetrics();
      const quotaStatus = this.router.getQuotaStatus();
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const detailedStats = this.monitor.getStats({ start: since24h, end: new Date() });

      res.json({
        ...stats,
        hourlyRequests: detailedStats.hourlyRequests,
        modelDistribution: detailedStats.modelDistribution,
        freeTier: {
          total: quotaStatus.length,
          available: quotaStatus.filter(q => q.remaining > 0).length,
          models: quotaStatus.filter(q => q.remaining > 0).map(q => ({
            model: q.model,
            remaining: q.remaining,
            nextReset: q.nextReset
          }))
        }
      });
    });

    // 生成报告
    this.app.get('/report/:period', (req, res) => {
      const period = req.params.period as 'day' | 'week' | 'month';
      const report = this.monitor.generateReport(period);
      res.setHeader('Content-Type', 'text/markdown');
      res.send(report);
    });

    // 查询完整请求日志 - 通过 requestId
    this.app.get('/logs/:requestId', (req, res) => {
      const { requestId } = req.params;
      const { date } = req.query;

      const log = this.monitor.getFullRequestLog(requestId, date as string);

      if (!log) {
        return res.status(404).json({ error: 'Request log not found' });
      }

      res.json(log);
    });

    // 查询某天的所有请求日志
    this.app.get('/logs', (req, res) => {
      const { date, limit } = req.query;

      if (date) {
        // 查询指定日期
        const logs = this.monitor.getRequestLogsByDate(date as string);
        res.json({
          date,
          total: logs.length,
          logs
        });
      } else {
        // 查询最近的请求
        const limitNum = limit ? parseInt(limit as string) : 50;
        const logs = this.monitor.getRecentRequestLogs(limitNum);
        res.json({
          total: logs.length,
          logs
        });
      }
    });

    // 聊天完成 - OpenAI 兼容接口
    this.app.post('/v1/chat/completions', async (req, res) => {
      const startTime = Date.now();
      const requestId = crypto.randomUUID();

      try {
        const { messages, model: rawModel, temperature, max_tokens, stream } = req.body;

        // 支持 "provider::model" 格式，兼容 OpenAI 规范
        const separatorIdx = typeof rawModel === 'string' ? rawModel.indexOf('::') : -1;
        const provider = separatorIdx !== -1 ? rawModel.slice(0, separatorIdx) : undefined;
        const model = separatorIdx !== -1 ? rawModel.slice(separatorIdx + 2) : rawModel;

        if (!messages || !Array.isArray(messages)) {
          return res.status(400).json({ error: 'Messages are required' });
        }

        // 检查语义缓存（仅非流式请求）
        let cacheHit = false;
        let cacheSimilarity: number | undefined;
        if (!stream && process.env.SEMANTIC_CACHE_ENABLED === 'true') {
          const cacheResult = await this.semanticCache.get(messages, model);
          if (cacheResult.hit && cacheResult.entry) {
            cacheHit = true;
            cacheSimilarity = cacheResult.similarity;
            const cached = cacheResult.entry;
            const latency = Date.now() - startTime;
            const matchType = cacheResult.exactMatch ? 'exact' : 'semantic';

            console.log(`[${requestId}] Cache hit! (${matchType}, similarity: ${(cacheSimilarity! * 100).toFixed(1)}%, ${latency}ms)`);

            // 返回缓存的响应
            res.json({
              id: requestId,
              object: 'chat.completion',
              created: Math.floor(Date.now() / 1000),
              model: cached.response.model,
              provider: 'cache',
              choices: [{
                index: 0,
                message: {
                  role: 'assistant',
                  content: cached.response.content
                },
                finish_reason: 'stop'
              }],
              usage: cached.response.usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
              },
              cached: true,
              cache_similarity: cacheSimilarity
            });

            // 记录日志
            this.logRequest(requestId, {
              model: cached.response.model,
              provider: 'cache',
              reason: `semantic cache hit (${(cacheSimilarity! * 100).toFixed(1)}% similar)`,
              estimatedCost: 0,
              fallbackModels: [],
              isFreeTier: true
            }, {
              content: cached.response.content,
              finishReason: 'stop',
              usage: cached.response.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
            }, startTime, req.body);

            return;
          }
        }

        // PII 检测：如有隐私信息则强制路由到本地 Ollama
        // X-Skip-PII-Detection 头用于 PiiDetector 自身的请求，避免无限递归
        let effectiveModel = model;
        let effectiveProvider = provider;
        let hasPiiForcedOllama = false;
        if (!req.headers['x-skip-pii-detection']) {
          const piiResult = await this.piiDetector.detect(messages);
          if (piiResult.hasPii) {
            console.log(`[${requestId}] PII detected (${piiResult.latencyMs}ms), forcing ollama/qwen2.5:7b`);
            effectiveModel = 'qwen2.5:7b';
            effectiveProvider = undefined;  // PII 强制路由时忽略用户指定的 provider
            hasPiiForcedOllama = true;
          } else if (piiResult.skipped) {
            console.warn(`[${requestId}] PII detection skipped (${piiResult.latencyMs}ms), using normal routing`);
          }
        }

        // 初始路由决策
        const initialDecision = this.router.decideModel(messages, {
          preferredModel: effectiveModel,
          preferredProvider: effectiveProvider,
          priority: req.body.priority || this.config.user.defaultPriority,
          preferFreeTier: req.body.prefer_free_tier !== false
        });

        console.log(`[${requestId}] 初始路由: ${initialDecision.model} (${initialDecision.reason}) ${initialDecision.isFreeTier ? '🆓' : '💰'}`);

        // 检查并使用额度
        if (initialDecision.isFreeTier) {
          const estimatedTokens = messages.reduce((sum, m) => sum + m.content.length, 0) / 4 + 1000;
          const hasQuota = await this.quotaManager.useQuota(initialDecision.provider, initialDecision.model, estimatedTokens);

          if (!hasQuota) {
            console.log(`[${requestId}] 免费额度不足，尝试备选模型`);
            const fallback = initialDecision.fallbackModels[0];
            if (fallback) {
              const fallbackModel = this.router.getAvailableModels().find(m => m.id === fallback);
              if (fallbackModel) {
                initialDecision.model = fallback;
                initialDecision.provider = fallbackModel.provider;
                initialDecision.reason = '免费额度不足，使用备选';
                initialDecision.isFreeTier = this.quotaManager.hasFreeTier(fallbackModel.provider, fallback);
                initialDecision.estimatedCost = this.estimateCost(messages, initialDecision.model);
              }
            }
          }
        }

        const request: ChatCompletionRequest = {
          model: initialDecision.model,
          messages,
          temperature,
          maxTokens: max_tokens,
          stream: stream === true
        };

        const userPreference = {
          preferredModel: effectiveModel,
          preferredProvider: effectiveProvider,
          priority: req.body.priority || this.config.user.defaultPriority,
          preferFreeTier: req.body.prefer_free_tier !== false
        };

        if (stream) {
          // 流式响应
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          let fullContent = '';
          let hasStarted = false;
          let currentModel = initialDecision.model;
          let currentProvider = initialDecision.provider;

          const result = await this.retryManager.executeStreamWithRetry(
            request,
            initialDecision,
            messages,
            userPreference,
            (chunk) => {
              hasStarted = true;
              fullContent += chunk;
              res.write(`data: ${JSON.stringify({
                id: requestId,
                object: 'chat.completion.chunk',
                model: currentModel,
                provider: currentProvider,
                choices: [{
                  delta: { content: chunk },
                  index: 0,
                  finish_reason: null
                }]
              })}\n\n`);
            }
          );

          // Update model after result is available
          if (result.success) {
            currentModel = result.decision.model;
          }

          if (!result.success) {
            // 流式失败
            if (hasStarted) {
              // 已经开始发送数据，发送错误事件
              res.write(`data: ${JSON.stringify({
                error: {
                  message: result.finalError?.message || '所有模型均失败',
                  type: result.finalError?.type || 'gateway_error',
                  attempts: result.attempts,
                  errors: result.errors.map(e => ({
                    provider: e.provider,
                    model: e.model,
                    type: e.type,
                    message: e.message
                  }))
                }
              })}\n\n`);
            } else {
              // 还没开始发送，可以返回正常错误
              return res.status(500).json({
                error: {
                  message: result.finalError?.message || '所有模型均失败',
                  type: result.finalError?.type || 'gateway_error',
                  attempts: result.attempts,
                  errors: result.errors.map(e => ({
                    provider: e.provider,
                    model: e.model,
                    type: e.type,
                    message: e.message
                  }))
                }
              });
            }
            res.end();
            return;
          }

          // 成功响应
          res.write(`data: ${JSON.stringify({
            id: requestId,
            object: 'chat.completion.chunk',
            model: result.decision.model,
            provider: result.decision.provider,
            choices: [{
              delta: {},
              index: 0,
              finish_reason: 'stop'
            }]
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();

          // 记录日志
          const streamResponse = {
            content: fullContent,
            finishReason: 'stop',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          };
          this.logRequest(requestId, result.decision, streamResponse, startTime, req.body);

        } else {
          // 非流式响应
          const result = await this.retryManager.executeWithRetry(
            request,
            initialDecision,
            messages,
            userPreference
          );

          if (!result.success) {
            return res.status(500).json({
              error: {
                message: result.finalError?.message || '所有模型均失败',
                type: result.finalError?.type || 'gateway_error',
                attempts: result.attempts,
                errors: result.errors.map(e => ({
                  provider: e.provider,
                  model: e.model,
                  type: e.type,
                  message: e.message
                }))
              }
            });
          }

          const response = result.response;
          const resultJson = {
            id: requestId,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: result.decision.model,
            provider: result.decision.provider,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: response.content
              },
              finish_reason: response.finishReason
            }],
            usage: {
              prompt_tokens: response.usage.promptTokens,
              completion_tokens: response.usage.completionTokens,
              total_tokens: response.usage.totalTokens
            }
          };

          res.json(resultJson);
          this.logRequest(requestId, result.decision, response, startTime, req.body);

          // 存入语义缓存（非流式、非 PII 强制路由、缓存未命中的情况）
          if (!cacheHit && !hasPiiForcedOllama && process.env.SEMANTIC_CACHE_ENABLED === 'true') {
            this.semanticCache.set(messages, model, {
              content: response.content,
              model: result.decision.model,
              usage: {
                promptTokens: response.usage.promptTokens,
                completionTokens: response.usage.completionTokens,
                totalTokens: response.usage.totalTokens
              }
            });
          }
        }

      } catch (error: any) {
        console.error(`[${requestId}] 未捕获错误:`, error);
        this.monitor.logError(error, { requestId });

        res.status(500).json({
          error: {
            message: error.message,
            type: 'gateway_error'
          }
        });
      }
    });

    // 语义缓存统计
    this.app.get('/cache/stats', (req, res) => {
      res.json(this.semanticCache.getStats());
    });

    // 清空语义缓存
    this.app.post('/cache/clear', async (req, res) => {
      await this.semanticCache.clear();
      res.json({ success: true, message: 'Cache cleared' });
    });

    // 模型管理 API
    this.app.get('/models', (req, res) => {
      res.json({ models: this.config.models });
    });

    this.app.post('/models', (req, res) => {
      const { id, name, provider, contextWindow, costPer1KInput, costPer1KOutput, capabilities, tags, priority, enabled } = req.body;
      if (!id || !name || !provider) {
        return res.status(400).json({ error: '缺少必填字段: id, name, provider' });
      }
      if (this.config.models.find(m => m.id === id)) {
        return res.status(409).json({ error: `模型 ${id} 已存在` });
      }
      const newModel: ModelConfig = {
        id, name, provider,
        contextWindow: contextWindow || 4096,
        costPer1KInput: costPer1KInput || 0,
        costPer1KOutput: costPer1KOutput || 0,
        capabilities: capabilities || ['text'],
        tags: tags || [],
        priority: priority || 1,
        enabled: enabled !== false
      };
      this.config.models.push(newModel);
      const providerConfig = this.config.providers.find(p => p.name === provider);
      if (providerConfig && !providerConfig.models.includes(id)) {
        providerConfig.models.push(id);
      }
      this.saveConfig();
      res.json({ success: true, model: newModel });
    });

    this.app.put('/models/:id', (req, res) => {
      const idx = this.config.models.findIndex(m => m.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: `模型 ${req.params.id} 不存在` });
      this.config.models[idx] = { ...this.config.models[idx], ...req.body };
      this.saveConfig();
      res.json({ success: true, model: this.config.models[idx] });
    });

    this.app.patch('/models/:id/toggle', (req, res) => {
      const model = this.config.models.find(m => m.id === req.params.id);
      if (!model) return res.status(404).json({ error: `模型 ${req.params.id} 不存在` });
      model.enabled = req.body.enabled;
      this.saveConfig();
      res.json({ success: true, model });
    });

    this.app.delete('/models/:id', (req, res) => {
      const idx = this.config.models.findIndex(m => m.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: `模型 ${req.params.id} 不存在` });
      const [removed] = this.config.models.splice(idx, 1);
      const providerConfig = this.config.providers.find(p => p.name === removed.provider);
      if (providerConfig) {
        providerConfig.models = providerConfig.models.filter(m => m !== removed.id);
      }
      this.saveConfig();
      res.json({ success: true });
    });

    // 404 处理
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  private estimateCost(messages: any[], modelId: string): number {
    const model = this.router.getAvailableModels().find(m => m.id === modelId);
    if (!model) return 0;
    
    const inputTokens = Math.ceil(
      messages.reduce((sum, m) => sum + m.content.length, 0) / 4
    );
    const estimatedOutputTokens = Math.min(inputTokens * 0.5, 2000);
    
    const inputCost = (inputTokens / 1000) * model.costPer1KInput;
    const outputCost = (estimatedOutputTokens / 1000) * model.costPer1KOutput;
    
    return Number((inputCost + outputCost).toFixed(6));
  }

  private logRequest(
    requestId: string,
    decision: any,
    response: any,
    startTime: number,
    requestBody: any
  ): void {
    // 基础日志（用于统计）
    const log: RequestLog = {
      id: requestId,
      timestamp: new Date(),
      model: decision.model,
      provider: decision.provider,
      inputTokens: response.usage?.promptTokens || 0,
      outputTokens: response.usage?.completionTokens || 0,
      cost: decision.isFreeTier ? 0 : decision.estimatedCost,
      latency: Date.now() - startTime,
      status: 'success',
      routingReason: decision.reason
    };

    this.monitor.logRequest(log);

    // 完整日志（包含请求/响应体）
    const fullLog: FullRequestLog = {
      ...log,
      request: {
        messages: requestBody.messages,
        model: requestBody.model || 'auto',
        temperature: requestBody.temperature,
        maxTokens: requestBody.max_tokens,
        stream: requestBody.stream,
        priority: requestBody.priority,
        preferFreeTier: requestBody.prefer_free_tier
      },
      response: {
        content: response.content || '',
        finishReason: response.finishReason,
        usage: response.usage
      },
      routing: {
        requestedModel: requestBody.model || 'auto',
        selectedModel: decision.model,
        selectedProvider: decision.provider,
        reason: decision.reason,
        isFreeTier: decision.isFreeTier,
        estimatedCost: decision.estimatedCost,
        fallbackModels: decision.fallbackModels || []
      }
    };

    this.monitor.saveFullRequestLog(fullLog);
  }

  private saveConfig(): void {
    try {
      const configPath = path.join(process.cwd(), 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('保存配置失败:', err);
    }
  }

  start(): void {
    const { port, host } = this.config.server;
    
    // 优雅关闭处理
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📤 收到 ${signal} 信号，正在优雅关闭...`);
      
      // 保存语义缓存
      if (process.env.SEMANTIC_CACHE_ENABLED === 'true') {
        console.log('💾 正在保存语义缓存...');
        await this.semanticCache.flush();
      }
      
      console.log('✅ 服务已安全关闭');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    this.app.listen(port, host, () => {
      const quotaStatus = this.router.getQuotaStatus();
      const availableFree = quotaStatus.filter(q => q.remaining > 0);
      const cacheStats = this.semanticCache.getStats();
      
      console.log(`
╔══════════════════════════════════════════════════════════╗
║            LLM Gateway 已启动 🚀                         ║
╠══════════════════════════════════════════════════════════╣
║  地址: http://${host}:${port}                              ║
║  模型: ${this.router.getAvailableModels().length} 个可用                                 ║
║  供应商: ${Array.from(this.providers.keys()).join(', ') || '无'}                        ║
║  免费额度模型: ${availableFree.length} 个                              ║
${cacheStats.enabled ? `║  语义缓存: ${cacheStats.totalEntries} 条历史记录                    ║` : '║  语义缓存: 已禁用                                        ║'}
╚══════════════════════════════════════════════════════════╝
      `);
      
      if (availableFree.length > 0) {
        console.log('\n🆓 可用免费额度:');
        availableFree.forEach(q => {
          const date = new Date(q.nextReset);
          console.log(`   • ${q.model}: ${q.remaining.toLocaleString()} tokens (重置: ${date.toLocaleDateString()})`);
        });
        console.log();
      }
      
      console.log('🌐 Web UI: http://' + host + ':' + port + '/');
      console.log();
      console.log('📝 API 端点:');
      console.log(`   • 聊天: POST http://${host}:${port}/v1/chat/completions`);
      console.log(`   • 模型: GET  http://${host}:${port}/v1/models`);
      console.log(`   • 额度: GET  http://${host}:${port}/quota`);
      console.log(`   • 统计: GET  http://${host}:${port}/stats`);
      console.log(`   • 日志: GET  http://${host}:${port}/logs/:requestId`);
      console.log(`   • 日志: GET  http://${host}:${port}/logs?date=YYYY-MM-DD`);
      if (cacheStats.enabled) {
        console.log(`   • 缓存统计: GET  http://${host}:${port}/cache/stats`);
        console.log(`   • 清空缓存: POST http://${host}:${port}/cache/clear`);
      }
      console.log();
    });
  }
}

// 启动服务
const gateway = new LLMGateway();
gateway.start();
