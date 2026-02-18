# 智能故障转移和重试机制 - 实现总结

## 实现概述

已成功实现智能的故障转移和重试机制，当 API 调用失败时能够：
1. 自动尝试备选模型
2. 重新执行路由决策（排除已失败的模型）
3. 根据错误类型决定是否重试
4. 避免重复选择失败的模型

## 新增文件

### 1. `/src/types/error.ts` - 错误分类系统
- `ErrorType` 枚举：定义可重试和不可重试的错误类型
- `ProviderError` 接口：统一的错误格式
- `classifyError()` 函数：根据错误信息自动分类

**错误分类规则**：
- **可重试**：网络错误、速率限制、服务器错误、额度不足
- **不可重试**：认证失败、请求参数错误、模型不存在、内容过滤

### 2. `/src/core/retry.ts` - 重试管理器
- `RetryManager` 类：封装重试逻辑
- `executeWithRetry()` 方法：非流式请求重试
- `executeStreamWithRetry()` 方法：流式请求重试
- `RoutingContext` 接口：包含排除模型列表的路由上下文

**核心特性**：
- 每次失败后重新路由决策
- 自动排除已失败的模型
- 指数退避延迟（1s, 2s, 4s...）
- 最大重试 3 次（可配置）

## 修改文件

### 3. `/src/core/router.ts` - 扩展路由引擎
- 添加 `context` 参数到 `decideModel()` 方法
- 在所有模型选择逻辑中添加 `excludedModels` 检查
- 更新 `findBestFreeModel()` 支持排除列表
- 更新 `findFreeAlternative()` 支持排除列表
- 更新 `getFallbackModels()` 支持排除列表

### 4. `/src/index.ts` - 集成重试管理器
- 导入 `RetryManager` 和错误类型
- 初始化 `RetryManager` 实例
- 修改 `/v1/chat/completions` 路由使用重试管理器
- 处理重试结果，返回详细错误信息

### 5. `/src/types/config.ts` - 添加重试配置
- 添加 `RetryConfigSchema` 和 `RetryConfig` 类型
- 扩展 `GatewayConfig` 包含 `retry` 字段

### 6. `/src/config/default.ts` - 添加默认重试配置
```json
{
  "retry": {
    "maxAttempts": 3,
    "enableRerouting": true,
    "exponentialBackoff": true,
    "baseDelayMs": 1000,
    "maxDelayMs": 10000,
    "retryableErrors": [
      "network_error",
      "rate_limit",
      "server_error",
      "quota_exceeded"
    ]
  }
}
```

## 工作流程

### 非流式请求重试流程
```
1. 初始路由决策 → 选择模型 A
2. 尝试调用模型 A
   ↓ 失败（网络超时）
3. 分类错误 → network_error（可重试）
4. 记录到 excludedModels: [A]
5. 重新路由决策（排除 A）→ 选择模型 B
6. 延迟 1 秒
7. 尝试调用模型 B
   ↓ 失败（服务器错误）
8. 记录到 excludedModels: [A, B]
9. 重新路由决策（排除 A, B）→ 选择模型 C
10. 延迟 2 秒
11. 尝试调用模型 C
    ↓ 成功
12. 返回结果
```

### 流式请求重试流程
- 与非流式类似，但在流式响应开始后无法撤回
- 如果流式响应中途失败，发送错误事件并关闭连接

## 日志输出示例

```
[abc123] 初始路由: qwen3-max-2026-01-23 (场景: code) 🆓
[重试管理器] 尝试 1/3: aliyun/qwen3-max-2026-01-23
[重试管理器] ❌ 失败 (1/3): server_error - 服务器错误: 500
[重试管理器] 🔄 重新路由决策，排除模型: qwen3-max-2026-01-23
[路由] 场景: code, 排除: [qwen3-max-2026-01-23]
[路由] 选择: Qwen2.5-7B-Instruct (免费额度优先)
[重试管理器] ⏳ 等待 1000ms 后重试...
[重试管理器] 尝试 2/3: siliconflow/Qwen2.5-7B-Instruct
[重试管理器] ✅ 成功: siliconflow/Qwen2.5-7B-Instruct
```

## 错误响应格式

当所有重试失败时，返回详细的错误信息：

```json
{
  "error": {
    "message": "所有模型均失败",
    "type": "gateway_error",
    "attempts": 3,
    "errors": [
      {
        "provider": "aliyun",
        "model": "qwen3-max-2026-01-23",
        "type": "server_error",
        "message": "服务器错误: 500"
      },
      {
        "provider": "siliconflow",
        "model": "Qwen2.5-7B-Instruct",
        "type": "network_error",
        "message": "网络超时"
      },
      {
        "provider": "moonshot",
        "model": "moonshot-v1-8k",
        "type": "rate_limit",
        "message": "速率限制"
      }
    ]
  }
}
```

## 配置选项

用户可以在 `config.json` 中自定义重试配置：

```json
{
  "retry": {
    "maxAttempts": 5,              // 最大重试次数（1-10）
    "enableRerouting": true,        // 启用重新路由
    "exponentialBackoff": true,     // 启用指数退避
    "baseDelayMs": 1000,           // 基础延迟（毫秒）
    "maxDelayMs": 10000,           // 最大延迟（毫秒）
    "retryableErrors": [           // 可重试的错误类型
      "network_error",
      "rate_limit",
      "server_error",
      "quota_exceeded"
    ]
  }
}
```

## 边界情况处理

1. **所有模型都失败** → 返回 500 错误，包含所有尝试的错误信息
2. **路由引擎返回已失败的模型** → 立即停止重试，避免无限循环
3. **流式响应中途失败** → 发送错误事件并关闭连接
4. **不可重试错误** → 立即返回错误，不尝试其他模型
5. **指数退避超时** → 最大延迟限制为 10 秒

## 测试

运行测试脚本验证功能：

```bash
# 确保服务器正在运行
npm start

# 在另一个终端运行测试
node test/test-retry.js
```

测试包括：
1. 正常请求（无失败）
2. 指定不存在的模型（测试重新路由）
3. 流式响应

## 优势

1. **智能重新路由**：每次失败都根据实时状态重新决策
2. **动态适应**：自动排除失败的模型和提供商
3. **避免重复**：不会重复选择已失败的模型
4. **保护服务器**：指数退避避免频繁请求
5. **详细错误信息**：返回所有尝试的错误，方便调试
6. **可配置策略**：支持自定义重试次数、延迟、可重试错误类型

## 性能影响

- **正常情况**：无额外延迟（第一次尝试成功）
- **一次重试**：延迟增加约 1-2 秒（包括指数退避）
- **两次重试**：延迟增加约 3-4 秒
- **三次重试**：延迟增加约 7-8 秒

## 下一步

可选的增强功能：
1. 添加重试统计和监控
2. 支持自定义重试策略（例如：只重试特定提供商）
3. 添加断路器模式（Circuit Breaker）
4. 支持重试回调钩子
5. 添加重试缓存（避免短时间内重复失败）
