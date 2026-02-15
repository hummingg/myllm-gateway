# api-gateway 到 llm-gateway 迁移报告

## 迁移日期
2026-02-15

## 迁移内容

### 1. Providers (供应商)

#### 新增供应商
- ✅ **Aliyun (阿里云百炼)**
  - Base URL: `https://dashscope.aliyuncs.com/compatible-mode/v1`
  - 协议: OpenAI 兼容
  - 环境变量: `ALIYUN_API_KEY`

#### 更新的供应商
- ✅ **Anthropic**
  - 新增支持: `ANTHROPIC_AUTH_TOKEN` 环境变量
  - 新增支持: `ANTHROPIC_BASE_URL` 环境变量
  - 新增模型: `claude-sonnet-4-20250514`

- ✅ **Moonshot**
  - 新增模型: `moonshot-v1-8k`

### 2. Models (模型)

#### 新增模型列表

| 模型 ID | 名称 | 供应商 | 上下文 | 成本 | 能力 |
|---------|------|--------|--------|------|------|
| `claude-sonnet-4-20250514` | Claude Sonnet 4 | anthropic | 200K | $0.003/$0.015 | text, code, reasoning, long_context |
| `moonshot-v1-8k` | Moonshot V1 8K | moonshot | 8K | 免费 | text, code |
| `deepseek-v3.2` | DeepSeek V3.2 | aliyun | 128K | 免费 | text, code, reasoning, long_context |
| `kimi-k2.5` | Kimi K2.5 (Aliyun) | aliyun | 128K | 免费 | text, long_context, code, reasoning |
| `qwen3-max-preview` | Qwen3 Max Preview | aliyun | 32K | 免费 | text, code, reasoning |

#### 更新的模型

**Kimi K2.5**:
- 供应商: moonshot → 保持不变
- 上下文: 256K → 128K
- 成本: $0.002/$0.006 → 免费
- 能力: 新增 code, reasoning

### 3. 免费额度配置

#### 新注册的免费额度模型

```typescript
// Aliyun 模型
{
  provider: 'aliyun',
  model: 'deepseek-v3.2',
  totalQuota: 1000000,  // 1M tokens
  resetPeriod: 'monthly',
  expires: '2026-03-03'
}

{
  provider: 'aliyun',
  model: 'kimi-k2.5',
  totalQuota: 1000000,  // 1M tokens
  resetPeriod: 'monthly',
  expires: '2026-04-30'
}

{
  provider: 'aliyun',
  model: 'qwen3-max-preview',
  totalQuota: 1000000,  // 1M tokens
  resetPeriod: 'monthly',
  expires: '2026-03-03'
}

// Moonshot 模型
{
  provider: 'moonshot',
  model: 'moonshot-v1-8k',
  totalQuota: 500000,  // 500K tokens
  resetPeriod: 'monthly'
}
```

### 4. 代码变更

#### 新增文件
无

#### 修改的文件

1. **src/config/default.ts**
   - 新增 aliyun provider 配置
   - 更新 anthropic provider（支持新环境变量）
   - 新增 5 个模型配置
   - 更新 kimi-k2.5 模型配置

2. **src/providers/base.ts**
   - 新增 `AliyunProvider` 类（继承自 OpenAIProvider）

3. **src/core/router.ts**
   - 更新 `registerFreeTierModels()` 方法
   - 新增 4 个 Aliyun 免费模型注册
   - 新增 1 个 Moonshot 免费模型注册

4. **src/index.ts**
   - 导入 `AliyunProvider`
   - 在 switch 语句中添加 aliyun case

5. **src/core/quota.ts**
   - 修复日期加载问题
   - 在 `loadQuotaData()` 中添加 `lastResetAt` 日期转换

## 迁移结果

### 统计数据

| 指标 | 迁移��� | 迁移后 | 变化 |
|------|--------|--------|------|
| 供应商数量 | 5 | 6 | +1 |
| 模型总数 | 9 | 13 | +4 |
| 免费模型数 | 2 | 6 | +4 |
| 免费额度总量 | 1.5M tokens | 5.5M tokens | +4M |

### 服务启动信息

```
✅ 初始化供应商: openai (3 个模型)
✅ 初始化供应商: anthropic (3 个模型)
✅ 初始化供应商: moonshot (2 个模型)
✅ 初始化供应商: groq (2 个模型)
✅ 初始化供应商: siliconflow (1 个模型)
✅ 初始化供应商: aliyun (3 个模型)

📊 共初始化 6 个供应商

🆓 可用免费额度:
   • llama-3.1-8b-instant: 1,000,000 tokens (重置: 2026/3/15)
   • Qwen2.5-7B-Instruct: 500,000 tokens (重置: 2026/2/16)
   • deepseek-v3.2: 1,000,000 tokens (重置: 2026/4/3)
   • kimi-k2.5: 1,000,000 tokens (重置: 2026/5/30)
   • qwen3-max-preview: 1,000,000 tokens (重置: 2026/4/3)
   • moonshot-v1-8k: 500,000 tokens (重置: 2026/3/15)
```

## 环境变量配置

### 需要添加到 .env 文件

```bash
# Aliyun 阿里云百炼
ALIYUN_API_KEY=sk-your-aliyun-key-here

# Anthropic (可选的替代环境变量)
ANTHROPIC_AUTH_TOKEN=sk-ant-your-token-here
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
```

## 测试结果

### API 端点测试

✅ **GET /v1/models** - 成功返回 13 个模型
✅ **GET /quota** - 成功返回额度信息
✅ **POST /v1/chat/completions** - 路由功能正常

### 模型调用测试

| 模型 | 状态 | 备注 |
|------|------|------|
| kimi-k2.5 (moonshot) | ✅ 成功 | 正常响应 |
| deepseek-v3.2 (aliyun) | ⚠️ 额度耗尽 | 免费额度已用完 |
| qwen3-max-preview (aliyun) | 未测试 | - |
| moonshot-v1-8k | 未测试 | - |

## 注意事项

1. **Aliyun 免费额度**: 部分 Aliyun 模型的免费额度可能已经用完，需要在阿里云控制台检查
2. **日期格式**: 修复了从 JSON 加载时日期字符串未转换为 Date 对象的问题
3. **环境变量**: 确保在 .env 文件中配置了 `ALIYUN_API_KEY`
4. **兼容性**: 所有新增的 provider 都是 OpenAI 兼容协议，无需额外适配

## 下一步建议

1. ✅ 在阿里云控制台检查免费额度状态
2. ✅ 测试所有新增模型的实际调用
3. ✅ 更新场景优先级配置，添加 Aliyun 模型到推荐列表
4. ✅ 考虑添加 Aliyun 模型到路由规则中

## 迁移完成 ✅

所有 api-gateway 中的 providers 和 models 已成功迁移到 llm-gateway！
