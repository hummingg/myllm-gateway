# 快速开始指南

## 5分钟快速部署

### 1. 克隆并安装

```bash
git clone https://github.com/hummingg/myllm-gateway.git
cd myllm-gateway
npm install
```

### 2. 配置API密钥

```bash
cp .env.example .env
```

编辑 `.env` 文件，至少配置一个提供商的API Key：

```env
# 推荐：先配置阿里云（18个免费模型，1800万tokens）
ALIYUN_API_KEY=your_aliyun_api_key

# 可选：其他提供商
ANTHROPIC_API_KEY=your_anthropic_key
MOONSHOT_API_KEY=your_moonshot_key
SILICONFLOW_API_KEY=your_siliconflow_key
```

### 3. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 4. 测试调用

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-max-2026-01-23",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## 在代码中使用

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="dummy"
)

response = client.chat.completions.create(
    model="auto",  # 自动选择最佳模型
    messages=[{"role": "user", "content": "写一个Python快排"}]
)

print(response.choices[0].message.content)
```

### Node.js

```javascript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:3000/v1',
    apiKey: 'dummy'
});

const response = await client.chat.completions.create({
    model: 'auto',
    messages: [{ role: 'user', content: '写一个快排' }]
});

console.log(response.choices[0].message.content);
```

## 查看可用模型

```bash
curl http://localhost:3000/v1/models
```

## 查看免费额度

```bash
curl http://localhost:3000/quota
```

## 获取API密钥

### 阿里云百炼（推荐，18个免费模型）

1. 访问 [阿里云百炼](https://bailian.console.aliyun.com/)
2. 注册/登录账号
3. 进入"API-KEY管理"
4. 创建新的API Key
5. 每个模型有1M tokens免费额度

### Moonshot AI (Kimi)

1. 访问 [Moonshot AI](https://platform.moonshot.cn/)
2. 注册账号
3. 获取API Key
4. 有500K tokens/月免费额度

### SiliconFlow

1. 访问 [SiliconFlow](https://cloud.siliconflow.cn/)
2. 注册账号
3. 获取API Key
4. 有500K tokens/日免费额度

### Anthropic (Claude)

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 注册账号并充值
3. 获取API Key

## 下一步

- 查看完整文档：[README.md](./README.md)
- 了解贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 报告问题：[Issues](../../issues)

## 常见问题

**Q: 为什么推荐先配置阿里云？**
A: 阿里云提供18个模型，每个1M tokens免费额度，总计1800万tokens，且不需要绑卡。

**Q: 可以同时配置多个提供商吗？**
A: 可以！网关会自动在多个提供商之间智能路由，优先使用免费额度。

**Q: 如何在Cursor/Continue中使用？**
A: 查看 README.md 中的"在OpenAI兼容客户端中使用"章节。

**Q: 免费额度用完了怎么办？**
A: 网关会自动切换到其他有额度的模型，或使用付费模型（如果配置了）。
