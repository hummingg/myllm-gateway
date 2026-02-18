/**
 * 错误类型枚举
 */
export enum ErrorType {
  // 可重试错误
  NETWORK_ERROR = 'network_error',
  RATE_LIMIT = 'rate_limit',
  SERVER_ERROR = 'server_error',
  QUOTA_EXCEEDED = 'quota_exceeded',

  // 不可重试错误
  AUTH_ERROR = 'auth_error',
  INVALID_REQUEST = 'invalid_request',
  MODEL_NOT_FOUND = 'model_not_found',
  CONTENT_FILTER = 'content_filter',

  UNKNOWN = 'unknown'
}

/**
 * 统一的提供商错误格式
 */
export interface ProviderError {
  type: ErrorType;
  message: string;
  provider: string;
  model: string;
  retryable: boolean;
  statusCode?: number;
  originalError?: any;
}

/**
 * 根据错误信息分类错误类型
 */
export function classifyError(error: any, provider: string, model: string): ProviderError {
  let type = ErrorType.UNKNOWN;
  let retryable = false;
  let statusCode: number | undefined;
  let message = error.message || '未知错误';

  // 提取状态码
  if (error.status) {
    statusCode = error.status;
  } else if (error.statusCode) {
    statusCode = error.statusCode;
  } else if (error.response?.status) {
    statusCode = error.response.status;
  }

  // 根据状态码分类
  if (statusCode) {
    if (statusCode === 401 || statusCode === 403) {
      type = ErrorType.AUTH_ERROR;
      retryable = false;
    } else if (statusCode === 400) {
      type = ErrorType.INVALID_REQUEST;
      retryable = false;
    } else if (statusCode === 404) {
      type = ErrorType.MODEL_NOT_FOUND;
      retryable = false;
    } else if (statusCode === 429) {
      type = ErrorType.RATE_LIMIT;
      retryable = true;
    } else if (statusCode >= 500) {
      type = ErrorType.SERVER_ERROR;
      retryable = true;
    }
  }

  // 根据错误代码分类
  const errorCode = error.code || error.error?.code || '';
  if (errorCode) {
    if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT' || errorCode === 'ENOTFOUND' || errorCode === 'ECONNRESET') {
      type = ErrorType.NETWORK_ERROR;
      retryable = true;
    }
  }

  // 根据错误消息分类
  const errorMessage = (message || '').toLowerCase();
  if (errorMessage.includes('quota') || errorMessage.includes('额度') || errorMessage.includes('insufficient')) {
    type = ErrorType.QUOTA_EXCEEDED;
    retryable = true;
  } else if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
    type = ErrorType.RATE_LIMIT;
    retryable = true;
  } else if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || errorMessage.includes('forbidden')) {
    type = ErrorType.AUTH_ERROR;
    retryable = false;
  } else if (errorMessage.includes('content') && errorMessage.includes('filter')) {
    type = ErrorType.CONTENT_FILTER;
    retryable = false;
  } else if (errorMessage.includes('model') && errorMessage.includes('not found')) {
    type = ErrorType.MODEL_NOT_FOUND;
    retryable = false;
  } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
    type = ErrorType.NETWORK_ERROR;
    retryable = true;
  }

  // 如果仍然是 UNKNOWN，谨慎处理为可重试（避免遗漏可恢复的错误）
  if (type === ErrorType.UNKNOWN) {
    retryable = true;
  }

  return {
    type,
    message,
    provider,
    model,
    retryable,
    statusCode,
    originalError: error
  };
}
