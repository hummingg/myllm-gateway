# MyLLM Gateway

**个人专属的多模型智能网关** | 免费优先 | 智能路由 | 多提供商统一管理

管理1800万+免费tokens，自动优化AI使用成本

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## ✨ 功能特性

- **🆓 免费额度优先**: 同场景能力下，自动优先使用有免费额度的模型
- **🧠 智能路由**: 根据任务类型、输入长度、成本优先级自动选择最佳模型
- **💰 成本优化**: 支持预算控制，自动选择性价比最高的模型
- **🏢 多供应商**: 支持 Anthropic、Moonshot、SiliconFlow、Aliyun、MiniMax、NVIDIA、iFlow、DeepSeek 等多个供应商
- **🔄 智能重试**: API 失败时自动重试，支持指数退避和智能重新路由
- **🛡️ 故障转移**: 模型失败时自动切换到备选模型，排除已失败的模型
- **📊 实时监控**: 请求统计、成本分析、性能监控
- **📝 完整日志**: 记录每次请求的完整请求/响应体，方便调试和分析
- **🔒 PII 隐私保护**: 自动检测请求中的个人隐私信息，强制路由到本地 Ollama，防止隐私数据外泄
- **🔌 OpenAI 兼容**: 完全兼容 OpenAI API 格式，无缝迁移

## 🚀 快速开始

### 1. 安装依赖

```bash
cd myllm-gateway
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 API Keys
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

服务默认在 `http://localhost:3000` 启动。

## 🆓 免费额度优先功能

网关会自动在同场景能力下优先选择有免费额度的模型，帮你最大程度节省成本！

### 智能路由策略（先过期优先）

当多个免费模型都可用时，网关会优先选择**先过期**的模型，避免浪费！

**示例场景：**
- Groq（月额度，3天后重置）：剩余 800K tokens
- SiliconFlow（日额度，8小时后重置）：剩余 300K tokens

**路由决策：** 优先使用 SiliconFlow（8小时后过期），因为 Groq 还有 3 天时间可以用。

### 支持的免费模型

| 供应商 | 模型 | 免费额度 | 重置周期 |
|--------|------|---------|---------|
| Aliyun | qwen3-max-2026-01-23 | 1M tokens | 永不刷新 |
| Aliyun | glm-4.7 | 1M tokens | 永不刷新 |
| Aliyun | qwen3-max-preview | 1M tokens | 永不刷新 |
| Aliyun | 其他15个模型 | 各1M tokens | 永不刷新 |

**Aliyun免费额度说明**:
- 提供18个模型，每个模型1M tokens一次性免费额度
- 注意设置“免费额度用完即停”
- 总计约1800万tokens免费额度
- 用完即止，不会自动刷新
- 包含qwen、glm、llama等多种模型

### 使用方式

**方式 1：自动模式（推荐）**
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```
网关会自动在代码生成场景优先使用免费的 Groq，长文本场景使用免费的 SiliconFlow。

**方式 2：强制免费模式**
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "prefer_free_tier": true,
    "messages": [{"role": "user", "content": "写一个 Python 快排"}]
  }'
```

**方式 3：质量优先（忽略免费）**
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "priority": "quality",
    "messages": [{"role": "user", "content": "重要任务"}]
  }'
```

## ⚙️ 配置说明

### 环境变量

```env
# Anthropic (Claude) - 支持第三方代理
ANTHROPIC_API_KEY=sk-ant-...  # 或 ANTHROPIC_AUTH_TOKEN
ANTHROPIC_BASE_URL=https://api.anthropic.com  # 可选，支持第三方代理

# Moonshot (月之暗面 Kimi)
MOONSHOT_API_KEY=sk-...

# SiliconFlow (免费额度)
SILICONFLOW_API_KEY=sk-...

# Aliyun (阿里云百炼，18个免费模型)
ALIYUN_API_KEY=sk-...

# MiniMax (海螺AI)
MINIMAX_API_KEY=sk-...

# NVIDIA (GLM-5)
NVIDIA_API_KEY=nvapi-...

# iFlow
IFLOW_API_KEY=sk-...

# DeepSeek
DEEPSEEK_API_KEY=sk-...

# 网关认证（可选）
GATEWAY_AUTH_TOKEN=your-secure-token

# Ollama 本地模型（PII 检测路由用）
OLLAMA_HOST=http://localhost:11434/v1  # 默认值，可省略

# PII 检测超时（毫秒，默认 3000）
PII_DETECTION_TIMEOUT_MS=3000
```

**注意**:
- 只需配置你要使用的提供商的API Key
- Aliyun提供18个模型的一次性免费额度，总计约1800万tokens
- 未配置的提供商将自动禁用

### 路由规则

网关支持以下路由策略：

| 场景 | 首选模型 | 免费替代 | 选择依据 |
|------|---------|---------|---------|
| 长文本 (>50K) | Kimi K2.5 | SiliconFlow Qwen | 256K 上下文 |
| 代码生成 | Claude 3.5 Sonnet | Groq Llama 3.1 | 代码能力强 |
| 数学推理 | o1-mini | Groq Llama 3.1 | 推理能力优秀 |
| 经济模式 | GPT-4o Mini | Groq/SiliconFlow | 成本最低 |

## 📡 API 使用

### 聊天完成

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \ 
  -H "Authorization: Bearer your-token" \ 
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

### 指定模型

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \ 
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "写一段 Python 代码"}]
  }'
```

### 流式响应

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \ 
  -d '{
    "model": "auto",
    "stream": true,
    "messages": [{"role": "user", "content": "讲个故事"}]
  }'
```

## 🔌 在OpenAI兼容客户端中使用

LLM Gateway完全兼容OpenAI API格式，可以在任何支持OpenAI API的工具和SDK中使用。

### Python SDK

```python
from openai import OpenAI

# 配置客户端指向LLM Gateway
client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy-key"  # 如果网关未启用认证，可以使用任意值
)

# 使用自动路由
response = client.chat.completions.create(
    model="auto",  # 让网关自动选择最佳模型
    messages=[
        {"role": "user", "content": "用Python写一个快速排序"}
    ]
)

print(response.choices[0].message.content)

# 指定具体模型
response = client.chat.completions.create(
    model="qwen3-max-2026-01-23",  # 使用阿里云模型
    messages=[
        {"role": "user", "content": "你好"}
    ]
)
```

### Node.js SDK

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:3000/v1',
    apiKey: 'dummy-key'
});

const response = await client.chat.completions.create({
    model: 'auto',
    messages: [
        { role: 'user', content: '写一个JavaScript函数' }
    ]
});

console.log(response.choices[0].message.content);
```

### Continue (VSCode/JetBrains插件)

在Continue配置文件 `~/.continue/config.json` 中添加：

```json
{
  "models": [
    {
      "title": "LLM Gateway",
      "provider": "openai",
      "model": "auto",
      "apiBase": "http://localhost:3000/v1",
      "apiKey": "dummy-key"
    }
  ]
}
```

### Cursor

在Cursor设置中配置自定义模型：

1. 打开 Settings → Models
2. 添加自定义OpenAI兼容端点：
   - Base URL: `http://localhost:3000/v1`
   - API Key: `dummy-key`
   - Model: `auto` 或具体模型名

### Open WebUI

在Open WebUI中添加外部连接：

1. 进入 Settings → Connections
2. 添加OpenAI API：
   - API Base URL: `http://localhost:3000/v1`
   - API Key: `dummy-key`
3. 选择模型时可以使用 `auto` 或具体模型名

### ChatBox / NextChat

配置API设置：

```
API地址: http://localhost:3000/v1
API密钥: dummy-key
模型: auto
```

### OpenClaw (ClawdBot)

编辑 OpenClaw 配置文件（通常位于 `~/.openclaw/config.json`），添加 `myllm-gateway` 作为自定义供应商：

**1. 添加认证 profile**

```json
"auth": {
  "profiles": {
    "myllm:default": {
      "provider": "myllm",
      "mode": "api_key"
    }
  }
}
```

> 如果网关启用了 `GATEWAY_AUTH_TOKEN`，在 OpenClaw 的 API Key 设置中填入该 token；未启用则填任意值。

**2. 添加供应商和模型**

```json
"models": {
  "mode": "merge",
  "providers": {
    "myllm": {
      "baseUrl": "http://localhost:3000/v1",
      "api": "openai-completions",
      "models": [
        {
          "id": "auto",
          "name": "Auto (智能路由)",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 128000,
          "maxTokens": 8192
        },
        {
          "id": "deepseek-reasoner",
          "name": "DeepSeek R1",
          "reasoning": true,
          "input": ["text"],
          "cost": { "input": 0.00055, "output": 0.00219, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 65536,
          "maxTokens": 8192
        },
        {
          "id": "deepseek-chat",
          "name": "DeepSeek V3",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0.00027, "output": 0.0011, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 65536,
          "maxTokens": 8192
        }
      ]
    }
  }
}
```

**3. 设置默认 Agent 使用网关**

```json
"agents": {
  "defaults": {
    "model": {
      "primary": "myllm/auto"
    },
    "models": {
      "myllm/auto": { "alias": "Gateway Auto" },
      "myllm/deepseek-reasoner": { "alias": "DeepSeek R1" },
      "myllm/deepseek-chat": { "alias": "DeepSeek V3" }
    }
  }
}
```

完整配置示例（合并到现有 config.json）：

```json
{
  "auth": {
    "profiles": {
      "myllm:default": {
        "provider": "myllm",
        "mode": "api_key"
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "myllm": {
        "baseUrl": "http://localhost:3000/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "auto",
            "name": "Auto (智能路由)",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "myllm/auto"
      }
    }
  }
}
```

### LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy-key",
    model="auto"
)

response = llm.invoke("你好")
print(response.content)
```

### 可用模型列表

查看所有可用模型：

```bash
curl http://localhost:3000/v1/models
```

当前支持的模型：
- **Anthropic**: claude-3-5-haiku-20241022, claude-3-5-sonnet-20241022, claude-3-7-sonnet-20250219, claude-3-haiku-20240307, claude-3-opus-20240229, claude-haiku-4-5-20251001, claude-opus-4-1-20250805, claude-opus-4-20250514, claude-opus-4-5-20251101, claude-sonnet-4-20250514, claude-sonnet-4-5-20250929
- **Moonshot**: moonshot-v1-8k, moonshot-v1-128k
- **SiliconFlow**: Qwen/Qwen2.5-7B-Instruct
- **Aliyun**: qwen3-max-2026-01-23, glm-4.7, qwen3-max-preview, 等18个模型
- **MiniMax**: MiniMax-M2.5, MiniMax-M2
- **NVIDIA**: z-ai/glm5
- **iFlow**: Qwen3-Coder
- **DeepSeek**: deepseek-chat (V3), deepseek-reasoner (R1)
- **Ollama**: qwen2.5:7b（本地，PII 隐私保护专用）
- **特殊**: `auto` (智能路由)

## 🔒 PII 隐私检测与本地路由 ⭐ NEW

当请求消息中包含个人隐私信息（PII）时，网关自动将请求路由到本地 Ollama，避免隐私数据发送到外部 API。

### 检测的 PII 类型

姓名、手机号、身份证号、家庭/工作地址、银行卡号、病历/诊断、邮箱、护照号、微信/支付宝账号

### 工作原理

1. 每次请求到达时，先用本地 `qwen2.5:7b` 对消息内容做分类（`max_tokens: 5`，极低延迟）
2. 检测到 PII → 强制 `effectiveModel = 'qwen2.5:7b'`，整个请求走本地 Ollama
3. Ollama 不可用或超时 → **fail-open**，请求继续走正常路由，不阻断服务
4. PII 检测请求本身也通过网关路由，完整记录到日志

### 前置条件

本地需运行 Ollama 并拉取模型：

```bash
ollama pull qwen2.5:7b
```

### 日志示例

```
[abc123] PII detected (312ms), forcing ollama/qwen2.5:7b
[abc123] 初始路由: qwen2.5:7b (用户指定) 💰
```

无 PII 时无额外日志输出；Ollama 不可用时：

```
[abc123] PII detection skipped (3001ms), using normal routing
```

---

## 🔄 智能重试与故障转移 ⭐ NEW

网关内置智能重试机制，在 API 调用失败时自动重试并智能选择备选模型，大幅提升服务可靠性。

### 核心特性

1. **智能重新路由**: 每次失败后重新执行路由决策，自动排除已失败的模型
2. **错误分类**: 区分可重试错误（网络超时、速率限制）和不可重试错误（认证失败、参数错误）
3. **指数退避**: 重试间隔递增（1s, 2s, 4s...），避免频繁请求导致速率限制
4. **避免重复**: 自动记录失败模型，不会重复选择已失败的模型

### 可重试错误类型

- `network_error` - 网络超时、连接失败
- `rate_limit` - 速率限制（HTTP 429）
- `server_error` - 服务器错误（HTTP 5xx）
- `quota_exceeded` - 额度不足

### 不可重试错误类型

- `auth_error` - 认证失败（HTTP 401, 403）
- `invalid_request` - 请求参数错误（HTTP 400）
- `model_not_found` - 模型不存在
- `content_filter` - 内容过滤

### 重试流程示例

```
尝试 1: aliyun/qwen3-max-2026-01-23
  ↓ 失败 (server_error)
分类错误 → 可重试
  ↓
记录到 excludedModels
  ↓
重新路由（排除 qwen3-max-2026-01-23）
  ↓
延迟 1s
  ↓
尝试 2: siliconflow/Qwen/Qwen2.5-7B-Instruct
  ↓ 成功
返回响应
```

### 配置选项

在 `src/config/default.ts` 中配置重试参数：

```typescript
retry: {
  maxAttempts: 3,              // 最大重试次数
  enableRerouting: true,       // 启用智能重新路由
  exponentialBackoff: true,    // 启用指数退避
  baseDelayMs: 1000,          // 基础延迟（毫秒）
  maxDelayMs: 10000,          // 最大延迟（毫秒）
  retryableErrors: [          // 可重试的错误类型
    'network_error',
    'rate_limit',
    'server_error',
    'quota_exceeded'
  ]
}
```

### 错误响应格式

当所有重试都失败时，返回详细的错误信息：

```json
{
  "error": {
    "message": "所有模型均失败",
    "type": "server_error",
    "attempts": 3,
    "errors": [
      {
        "provider": "aliyun",
        "model": "qwen3-max-2026-01-23",
        "type": "server_error",
        "message": "500 服务器错误"
      },
      {
        "provider": "siliconflow",
        "model": "Qwen/Qwen2.5-7B-Instruct",
        "type": "network_error",
        "message": "连接超时"
      }
    ]
  }
}
```

### 日志输出示例

```
[abc123] 初始路由: qwen3-max-2026-01-23 (场景: code) 🆓
[重试管理器] 尝试 1/3: aliyun/qwen3-max-2026-01-23
[重试管理器] ❌ 失败 (1/3): server_error - 服务器错误: 500
[重试管理器] 🔄 重新路由决策，排除模型: qwen3-max-2026-01-23
[路由] 场景: code, 排除: [qwen3-max-2026-01-23]
[路由] 选择: Qwen/Qwen2.5-7B-Instruct (免费额度优先)
[重试管理器] ⏳ 等待 1000ms 后重试...
[重试管理器] 尝试 2/3: siliconflow/Qwen/Qwen2.5-7B-Instruct
[重试管理器] ✅ 成功: siliconflow/Qwen/Qwen2.5-7B-Instruct
```

## 📊 监控端点

### 获取统计信息

```bash
curl http://localhost:3000/stats
```

返回：
```json
{
  "requests24h": 1234,
  "cost24h": 12.34,
  "averageLatency24h": 2300,
  "freeTier": {
    "total": 5,
    "available": 3,
    "models": [
      {"model": "llama-3.1-8b-instant", "remaining": 800000, "nextReset": "2024-02-15"}
    ]
  }
}
```

### 查看完整请求日志 ⭐ NEW

查询单个请求的完整日志（包含请求/响应体）：

```bash
# 通过 requestId 查询
curl http://localhost:3000/logs/550e8400-e29b-41d4-a716-446655440000

# 查询某天的所有日志
curl http://localhost:3000/logs?date=2024-02-18

# 查询最近的日志
curl http://localhost:3000/logs?limit=50
```

完整日志包含：
- 完整的请求体（messages、参数）
- 完整的响应体（content、usage）
- 路由决策信息（为什么选择这个模型）
- 性能指标（延迟、tokens、成本）

详细使用说明请查看 [FULL_REQUEST_LOGS.md](./FULL_REQUEST_LOGS.md)

### 查看额度状态

```bash
curl http://localhost:3000/quota
```

### 额度预警（支持即将过期提醒）

```bash
# 查看额度不足预警
curl http://localhost:3000/quota/alerts?threshold=5000

# 查看即将过期预警（24小时内）
curl http://localhost:3000/quota/alerts?threshold=5000&expiry_hours=24
```

返回示例：
```json
{
  "threshold": 5000,
  "expiry_warning_hours": 24,
  "total_alerts": 2,
  "low_quota": {
    "count": 1,
    "alerts": [
      {
        "provider": "siliconflow",
        "model": "Qwen2.5-7B-Instruct",
        "remaining": 3000,
        "reason": "low_quota",
        "message": "额度不足: 仅剩 3,000 tokens"
      }
    ]
  },
  "expiring_soon": {
    "count": 1,
    "alerts": [
      {
        "provider": "siliconflow",
        "model": "Qwen2.5-7B-Instruct",
        "remaining": 450000,
        "reason": "expiring_soon",
        "message": "即将过期: 8小时后重置，剩余 450,000 tokens 未使用，建议尽快使用！"
      }
    ]
  }
}
```

### 注册新的免费额度模型

```bash
curl -X POST http://localhost:3000/quota/register \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "groq",
    "model": "mixtral-8x7b",
    "totalQuota": 1000000,
    "resetPeriod": "monthly",
    "priority": 1
  }'
```

### 生成报告

```bash
# 日报
curl http://localhost:3000/report/day

# 周报
curl http://localhost:3000/report/week

# 月报
curl http://localhost:3000/report/month
```

## 🏗️ 架构设计

```
User Request
    ↓
PII Detector (隐私检测) ⭐ NEW
    ├─ 含 PII → 强制路由到本地 Ollama（qwen2.5:7b）
    └─ 无 PII / 超时 → 继续正常路由（fail-open）
    ↓
Free Tier Check (免费额度检查)
    ↓
Router Engine (智能路由)
    ↓
Retry Manager (重试管理器) ⭐ NEW
    ├─ Error Classification (错误分类)
    ├─ Smart Rerouting (智能重新路由)
    └─ Exponential Backoff (指数退避)
    ↓
Provider Adapter (供应商适配)
    ↓
LLM API
    ↓
Quota Update (额度更新)
    ↓
Response + Metrics
```

## 🎯 免费额度路由策略

### 1. 场景免费意愿度 ⭐

不同场景使用免费模型的**意愿度**不同：

| 场景类型 | 免费意愿度 | 说明 | 示例 |
|---------|-----------|------|------|
| **代码生成** | 90% | 非常愿意用免费模型 | 代码对质量要求适中，省钱优先 |
| **数学推理** | 80% | 较愿意用免费模型 | 免费模型推理能力够用 |
| **翻译** | 80% | 较愿意用免费模型 | 翻译任务简单 |
| **长文本** | 70% | 中等意愿 | 视内容重要性而定 |
| **创意写作** | 50% | 平衡使用 | 创意需要一定质量 |
| **分析任务** | 60% | 中等意愿 | 平衡使用 |
| **通用对话** | 30% | 较倾向付费模型 | 聊天体验更重要 |

**意愿度如何工作：**
- 90% 意愿度 = 90% 概率使用免费模型
- 30% 意愿度 = 30% 概率使用免费模型（70% 概率用付费）

**实际例子：**

```
代码场景（90%意愿）:
用户: "写一个 Python 快排"
→ 90% 概率使用 Groq 免费模型
→ 10% 概率使用 GPT-4o（付费）

聊天场景（30%意愿）:
用户: "你好，今天天气怎么样？"
→ 30% 概率使用免费模型
→ 70% 概率使用 GPT-4o / Claude（付费体验更好）
```

### 2. 场景差异化优先级

在决定使用免费模型后，不同场景还有不同的**模型选择策略**：

| 场景类型 | 优先级策略 | 模型排序 |
|---------|-----------|---------|
| **代码生成** | 速度优先 | Groq > SiliconFlow |
| **数学推理** | 能力优先 | Mixtral > Qwen |
| **长文本** | 能力优先 | Qwen > Mixtral |
| **通用对话** | 先过期优先 | 按过期时间 |

### 3. 先过期优先（默认策略）
对于没有特殊需求的场景，**优先使用先过期的模型**，避免浪费即将重置的额度！

**排序逻辑：**
1. 比较过期时间（先过期的排在前面）
2. 过期时间相同，按优先级排序

### 4. 额度检查
每次请求前检查剩余额度，不足时自动降级到付费模型。

### 5. 备选策略
免费额度用完后，自动切换到同能力的付费模型。

## 🔧 自定义配置

### 场景优先级自定义 ⭐ NEW

现在支持用户自定义场景优先级！在项目根目录创建 `config.json`：

```json
{
  "scenarioPriorities": [
    {
      "scenario": "math",
      "priorityType": "capability_first",
      "modelRanking": ["groq/mixtral-8x7b-32768"],
      "freeTierWillingness": 0.95,
      "description": "数学场景优先"
    },
    {
      "scenario": "code",
      "priorityType": "speed_first",
      "modelRanking": ["groq/llama-3.1-8b-instant"],
      "freeTierWillingness": 0.9
    }
  ]
}
```

**可自定义内容：**
- 场景检测顺序（数组顺序决定优先级）
- 各场景的免费意愿度（0-1）
- 场景的优先级类型（speed_first, capability_first, expiry_first）
- 场景内的模型排名

详细配置说明请查看 [SCENARIO_CONFIG.md](./SCENARIO_CONFIG.md)

### 注册免费额度模型

编辑 `src/config/default.ts` 可自定义：

```typescript
// 注册免费额度模型
freeTierModels: [
  {
    provider: 'your-provider',
    model: 'your-model',
    totalQuota: 1000000,
    resetPeriod: 'monthly',
    priority: 1
  }
]
```

## 📝 成本对比

| 模型 | 输入价格/1K | 输出价格/1K | 免费额度 | 特点 |
|------|------------|------------|---------|------|
| Groq Llama 3.1 | $0 | $0 | 1M/月 | 🆓 免费、快速 |
| SiliconFlow Qwen | $0 | $0 | 500K/日 | 🆓 免费、中文好 |
| DeepSeek V3 | $0.00027 | $0.0011 | - | 高性价比 |
| DeepSeek R1 | $0.00055 | $0.00219 | - | 推理强 |
| GPT-4o Mini | $0.00015 | $0.0006 | - | 最经济 |
| Claude 3 Haiku | $0.00025 | $0.00125 | - | 快速 |
| GPT-4o | $0.005 | $0.015 | - | 全能 |
| Claude 3.5 Sonnet | $0.003 | $0.015 | - | 代码强 |
| Kimi K2.5 | $0.002 | $0.006 | - | 长文本 |

## 🔒 安全建议

1. 使用 `GATEWAY_AUTH_TOKEN` 启用 API 认证
2. 在生产环境使用 HTTPS
3. 定期轮换 API Keys
4. 设置合理的 rate limit
5. 监控异常使用模式

## 🛠️ 技术栈

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.0
- **Framework**: Express.js
- **Logging**: Winston, Morgan
- **Providers**: Anthropic, Moonshot, SiliconFlow, Aliyun SDKs

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

详细贡献指南请查看 [CONTRIBUTING.md](./CONTRIBUTING.md)

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️

## 📄 License

本项目采用 [MIT](./LICENSE) 许可证

## 🙏 致谢

感谢所有AI提供商提供的免费额度和优质服务：
- [Anthropic](https://www.anthropic.com/) - Claude系列模型（支持第三方代理）
- [Moonshot AI](https://www.moonshot.cn/) - Kimi系列模型
- [SiliconFlow](https://siliconflow.cn/) - 开源模型托管
- [阿里云百炼](https://www.aliyun.com/product/bailian) - 18个免费模型
- [MiniMax](https://www.minimaxi.com/) - 海螺AI模型
- [NVIDIA](https://www.nvidia.com/) - GLM-5模型
- [iFlow](https://iflow.cn/) - Qwen3-Coder模型
- [DeepSeek](https://www.deepseek.com/) - DeepSeek V3 / R1模型

---

Made with ❤️ for the AI community
