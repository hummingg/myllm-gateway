import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import crypto from 'crypto';
import { loadConfig } from './config/default.js';
import { RoutingEngine } from './core/router.js';
import { Monitor, RequestLog, FullRequestLog } from './core/monitor.js';
import { QuotaManager } from './core/quota.js';
import { BaseProvider, OpenAIProvider, AnthropicProvider, MoonshotProvider, GroqProvider, SiliconFlowProvider, AliyunProvider, MinimaxProvider, NvidiaProvider, IflowProvider, DeepSeekProvider, OllamaProvider, ChatCompletionRequest } from './providers/base.js';
import { GatewayConfig, ModelConfig, ProviderConfig, RetryConfig } from './types/config.js';
import { RetryManager } from './core/retry.js';
import { ErrorType } from './types/error.js';

class LLMGateway {
  private app: express.Application;
  private config: GatewayConfig;
  private router: RoutingEngine;
  private monitor: Monitor;
  private quotaManager: QuotaManager;
  private providers: Map<string, BaseProvider> = new Map();
  private retryManager: RetryManager;

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

    this.setupMiddleware();
    this.setupRoutes();
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
    // 健康检查
    this.app.get('/health', (req, res) => {
      const quotaStatus = this.router.getQuotaStatus();
      res.json({ 
        status: 'ok',
        providers: Array.from(this.providers.keys()),
        models: this.router.getAvailableModels().map(m => m.id),
        freeTierModels: quotaStatus.filter(q => q.remaining > 0).length
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

    // 获取统计数据
    this.app.get('/stats', (req, res) => {
      const stats = this.monitor.getRealtimeMetrics();
      const quotaStatus = this.router.getQuotaStatus();
      
      res.json({
        ...stats,
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
        const { messages, model, temperature, max_tokens, stream } = req.body;

        if (!messages || !Array.isArray(messages)) {
          return res.status(400).json({ error: 'Messages are required' });
        }

        // 初始路由决策
        const initialDecision = this.router.decideModel(messages, {
          preferredModel: model,
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
          preferredModel: model,
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

  start(): void {
    const { port, host } = this.config.server;
    this.app.listen(port, host, () => {
      const quotaStatus = this.router.getQuotaStatus();
      const availableFree = quotaStatus.filter(q => q.remaining > 0);
      
      console.log(`
╔══════════════════════════════════════════════════════════╗
║            LLM Gateway 已启动 🚀                         ║
╠══════════════════════════════════════════════════════════╣
║  地址: http://${host}:${port}                              ║
║  模型: ${this.router.getAvailableModels().length} 个可用                                 ║
║  供应商: ${Array.from(this.providers.keys()).join(', ') || '无'}                        ║
║  免费额度模型: ${availableFree.length} 个                              ║
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
      
      console.log('📝 API 端点:');
      console.log(`   • 聊天: POST http://${host}:${port}/v1/chat/completions`);
      console.log(`   • 模型: GET  http://${host}:${port}/v1/models`);
      console.log(`   • 额度: GET  http://${host}:${port}/quota`);
      console.log(`   • 统计: GET  http://${host}:${port}/stats`);
      console.log(`   • 日志: GET  http://${host}:${port}/logs/:requestId`);
      console.log(`   • 日志: GET  http://${host}:${port}/logs?date=YYYY-MM-DD\n`);
    });
  }
}

// 启动服务
const gateway = new LLMGateway();
gateway.start();
