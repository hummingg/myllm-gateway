import { RoutingEngine, RoutingDecision } from './router.js';
import { BaseProvider, ChatCompletionRequest } from '../providers/base.js';
import { ErrorType, ProviderError, classifyError } from '../types/error.js';

/**
 * 重试配置
 */
export interface RetryConfig {
  maxAttempts: number;
  enableRerouting: boolean;
  exponentialBackoff: boolean;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

/**
 * 路由上下文
 */
export interface RoutingContext {
  excludedModels?: string[];
  attemptNumber?: number;
  previousError?: ProviderError;
}

/**
 * 重试结果
 */
export interface RetryResult {
  success: boolean;
  response?: any;
  decision: RoutingDecision;
  attempts: number;
  errors: ProviderError[];
  finalError?: ProviderError;
}

/**
 * 重试管理器
 */
export class RetryManager {
  private config: RetryConfig;
  private router: RoutingEngine;
  private providers: Map<string, BaseProvider>;

  constructor(config: RetryConfig, router: RoutingEngine, providers: Map<string, BaseProvider>) {
    this.config = config;
    this.router = router;
    this.providers = providers;
  }

  /**
   * 执行非流式请求（带重试）
   */
  async executeWithRetry(
    request: ChatCompletionRequest,
    initialDecision: RoutingDecision,
    messages: any[],
    userPreference?: any
  ): Promise<RetryResult> {
    const errors: ProviderError[] = [];
    const excludedModels: string[] = [];
    let currentDecision = initialDecision;
    let attemptNumber = 1;

    while (attemptNumber <= this.config.maxAttempts) {
      try {
        console.log(`[重试管理器] 尝试 ${attemptNumber}/${this.config.maxAttempts}: ${currentDecision.provider}/${currentDecision.model}`);

        // 1. 获取 provider
        const provider = this.providers.get(currentDecision.provider);
        if (!provider) {
          throw new Error(`Provider ${currentDecision.provider} not found`);
        }

        // 2. 执行请求
        request.model = currentDecision.model;
        const response = await provider.chatCompletion(request);

        // 3. 成功！返回结果
        console.log(`[重试管理器] ✅ 成功: ${currentDecision.provider}/${currentDecision.model}`);
        return {
          success: true,
          response,
          decision: currentDecision,
          attempts: attemptNumber,
          errors
        };

      } catch (error: any) {
        // 4. 分类错误
        const providerError = classifyError(error, currentDecision.provider, currentDecision.model);
        errors.push(providerError);

        console.log(`[重试管理器] ❌ 失败 (${attemptNumber}/${this.config.maxAttempts}): ${providerError.type} - ${providerError.message}`);

        // 5. 记录失败模型
        excludedModels.push(currentDecision.model);

        // 6. 检查是否可重试
        if (!this.shouldRetry(providerError, attemptNumber)) {
          console.log(`[重试管理器] 🛑 不可重试或达到最大次数`);
          return {
            success: false,
            decision: currentDecision,
            attempts: attemptNumber,
            errors,
            finalError: providerError
          };
        }

        // 7. 重新路由决策（关键！）
        if (this.config.enableRerouting) {
          console.log(`[重试管理器] 🔄 重新路由决策，排除模型: ${excludedModels.join(', ')}`);

          const context: RoutingContext = {
            excludedModels,
            attemptNumber: attemptNumber + 1,
            previousError: providerError
          };

          const nextDecision = this.router.decideModel(messages, userPreference, context);

          // 8. 检查新决策是否有效
          if (excludedModels.includes(nextDecision.model)) {
            console.log(`[重试管理器] ⚠️ 路由引擎返回了已失败的模型，没有更多选择`);
            return {
              success: false,
              decision: currentDecision,
              attempts: attemptNumber,
              errors,
              finalError: providerError
            };
          }

          currentDecision = nextDecision;
        } else {
          // 不启用重新路由，使用 fallback 列表
          if (currentDecision.fallbackModels && currentDecision.fallbackModels.length > 0) {
            const nextModel = currentDecision.fallbackModels.shift();
            if (nextModel && !excludedModels.includes(nextModel)) {
              currentDecision.model = nextModel;
            } else {
              console.log(`[重试管理器] ⚠️ 没有更多备选模型`);
              return {
                success: false,
                decision: currentDecision,
                attempts: attemptNumber,
                errors,
                finalError: providerError
              };
            }
          } else {
            console.log(`[重试管理器] ⚠️ 没有备选模型`);
            return {
              success: false,
              decision: currentDecision,
              attempts: attemptNumber,
              errors,
              finalError: providerError
            };
          }
        }

        // 9. 指数退避延迟
        if (this.config.exponentialBackoff && attemptNumber < this.config.maxAttempts) {
          await this.delay(attemptNumber);
        }

        // 10. 继续下一次尝试
        attemptNumber++;
      }
    }

    // 达到最大重试次数
    console.log(`[重试管理器] ⚠️ 达到最大重试次数 ${this.config.maxAttempts}`);
    return {
      success: false,
      decision: currentDecision,
      attempts: attemptNumber - 1,
      errors,
      finalError: errors[errors.length - 1]
    };
  }

  /**
   * 执行流式请求（带重试）
   */
  async executeStreamWithRetry(
    request: ChatCompletionRequest,
    initialDecision: RoutingDecision,
    messages: any[],
    userPreference: any | undefined,
    onChunk: (chunk: string) => void
  ): Promise<RetryResult> {
    const errors: ProviderError[] = [];
    const excludedModels: string[] = [];
    let currentDecision = initialDecision;
    let attemptNumber = 1;

    while (attemptNumber <= this.config.maxAttempts) {
      try {
        console.log(`[重试管理器] 流式尝试 ${attemptNumber}/${this.config.maxAttempts}: ${currentDecision.provider}/${currentDecision.model}`);

        const provider = this.providers.get(currentDecision.provider);
        if (!provider) {
          throw new Error(`Provider ${currentDecision.provider} not found`);
        }

        request.model = currentDecision.model;
        const response = await provider.streamChatCompletion(request, onChunk);

        // 流式响应成功
        console.log(`[重试管理器] ✅ 流式成功: ${currentDecision.provider}/${currentDecision.model}`);

        return {
          success: true,
          response,
          decision: currentDecision,
          attempts: attemptNumber,
          errors
        };

      } catch (error: any) {
        const providerError = classifyError(error, currentDecision.provider, currentDecision.model);
        errors.push(providerError);

        console.log(`[重试管理器] ❌ 流式失败 (${attemptNumber}/${this.config.maxAttempts}): ${providerError.type} - ${providerError.message}`);

        excludedModels.push(currentDecision.model);

        if (!this.shouldRetry(providerError, attemptNumber)) {
          return {
            success: false,
            decision: currentDecision,
            attempts: attemptNumber,
            errors,
            finalError: providerError
          };
        }

        if (this.config.enableRerouting) {
          const context: RoutingContext = {
            excludedModels,
            attemptNumber: attemptNumber + 1,
            previousError: providerError
          };

          const nextDecision = this.router.decideModel(messages, userPreference, context);

          if (excludedModels.includes(nextDecision.model)) {
            return {
              success: false,
              decision: currentDecision,
              attempts: attemptNumber,
              errors,
              finalError: providerError
            };
          }

          currentDecision = nextDecision;
        } else {
          return {
            success: false,
            decision: currentDecision,
            attempts: attemptNumber,
            errors,
            finalError: providerError
          };
        }

        if (this.config.exponentialBackoff && attemptNumber < this.config.maxAttempts) {
          await this.delay(attemptNumber);
        }

        attemptNumber++;
      }
    }

    return {
      success: false,
      decision: currentDecision,
      attempts: attemptNumber - 1,
      errors,
      finalError: errors[errors.length - 1]
    };
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: ProviderError, attemptNumber: number): boolean {
    // 达到最大重试次数
    if (attemptNumber >= this.config.maxAttempts) {
      return false;
    }

    // 检查错误是否可重试
    if (!error.retryable) {
      return false;
    }

    // 检查错误类型是否在可重试列表中
    if (!this.config.retryableErrors.includes(error.type)) {
      return false;
    }

    return true;
  }

  /**
   * 指数退避延迟
   */
  private async delay(attemptNumber: number): Promise<void> {
    const delayMs = Math.min(
      this.config.baseDelayMs * Math.pow(2, attemptNumber - 1),
      this.config.maxDelayMs
    );
    console.log(`[重试管理器] ⏳ 等待 ${delayMs}ms 后重试...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
