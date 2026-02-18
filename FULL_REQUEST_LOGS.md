# 完整请求日志功能

## 功能概述

MyLLM Gateway 现在支持完整请求日志功能，记录每次 API 调用的完整请求和响应体，方便调试和分析。

## 特性

- ✅ **完整记录**：保存完整的请求体（messages、参数）和响应体（content、usage）
- ✅ **路由信息**：记录路由决策过程（请求模型、选择模型、原因、是否免费）
- ✅ **流式支持**：支持流式响应的完整内容记录
- ✅ **文件存储**：使用文件系统存储，无需数据库
- ✅ **按日期组织**：日志按日期分目录存储（`logs/requests/YYYY-MM-DD/`）
- ✅ **查询接口**：提供 RESTful API 查询历史日志

## 存储结构

```
logs/
├── gateway.log              # 基础日志（Winston）
└── requests/                # 完整请求日志
    ├── 2024-02-18/
    │   ├── 13_07_48_150_uuid-1.json    # 时_分_秒_毫秒_requestId.json
    │   ├── 13_18_08_910_uuid-2.json
    │   └── ...
    ├── 2024-02-19/
    │   └── ...
    └── ...
```

**文件名格式**：`时_分_秒_毫秒_requestId.json`
- 时间前缀便于按时间顺序浏览
- requestId 用于精确查询
- 示例：`13_18_08_910_9dddff1f-0b71-40da-83ea-7bb82d0b53a8.json`

## 日志格式

每个请求日志包含以下信息：

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-02-18T10:30:00.000Z",
  "model": "qwen3-max-2026-01-23",
  "provider": "aliyun",
  "inputTokens": 150,
  "outputTokens": 300,
  "cost": 0,
  "latency": 2300,
  "status": "success",
  "routingReason": "免费额度优先",

  "request": {
    "messages": [
      { "role": "user", "content": "写一个 Python 快排" }
    ],
    "model": "auto",
    "temperature": 0.7,
    "maxTokens": 2000,
    "stream": false,
    "priority": "balanced",
    "preferFreeTier": true
  },

  "response": {
    "content": "这是完整的响应内容...",
    "finishReason": "stop",
    "usage": {
      "promptTokens": 150,
      "completionTokens": 300,
      "totalTokens": 450
    }
  },

  "routing": {
    "requestedModel": "auto",
    "selectedModel": "qwen3-max-2026-01-23",
    "selectedProvider": "aliyun",
    "reason": "免费额度优先",
    "isFreeTier": true,
    "estimatedCost": 0,
    "fallbackModels": ["gpt-4o-mini"]
  }
}
```

## API 使用

### 1. 查询单个请求日志

通过 requestId 查询：

```bash
curl http://localhost:3000/logs/550e8400-e29b-41d4-a716-446655440000
```

如果知道日期，可以加速查询：

```bash
curl http://localhost:3000/logs/550e8400-e29b-41d4-a716-446655440000?date=2024-02-18
```

### 2. 查询某天的所有日志

```bash
curl http://localhost:3000/logs?date=2024-02-18
```

返回：

```json
{
  "date": "2024-02-18",
  "total": 25,
  "logs": [...]
}
```

### 3. 查询最近的日志

```bash
# 默认返回最近 50 条
curl http://localhost:3000/logs

# 指定数量
curl http://localhost:3000/logs?limit=100
```

## 使用场景

### 1. 调试 Prompt

查看实际发送的 prompt 和模型返回的内容：

```bash
# 发送请求
REQUEST_ID=$(curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "测试"}]
  }' | jq -r '.id')

# 查看完整日志
curl http://localhost:3000/logs/$REQUEST_ID | jq '.request.messages, .response.content'
```

### 2. 分析路由决策

查看网关为什么选择了某个模型：

```bash
curl http://localhost:3000/logs/$REQUEST_ID | jq '.routing'
```

### 3. 成本分析

查看某天的所有请求成本：

```bash
curl http://localhost:3000/logs?date=2024-02-18 | \
  jq '[.logs[].cost] | add'
```

### 4. 性能分析

查看延迟分布：

```bash
curl http://localhost:3000/logs?date=2024-02-18 | \
  jq '[.logs[].latency] | add / length'
```

### 5. 免费额度使用情况

统计免费模型使用次数：

```bash
curl http://localhost:3000/logs?date=2024-02-18 | \
  jq '[.logs[] | select(.routing.isFreeTier == true)] | length'
```

## 日志保留策略

- 日志文件按日期组织，方便手动清理
- 建议定期清理旧日志（如保留最近 30 天）
- 可以通过 cron 任务自动清理：

```bash
# 删除 30 天前的日志
find logs/requests -type d -mtime +30 -exec rm -rf {} \;
```

## 隐私和安全

⚠️ **注意**：完整日志包含用户的 prompt 和模型响应，请注意：

1. **敏感信息**：如果 prompt 包含敏感信息，请妥善保管日志文件
2. **访问控制**：建议启用 `GATEWAY_AUTH_TOKEN` 保护日志查询接口
3. **定期清理**：及时清理不需要的历史日志
4. **备份加密**：如需备份日志，建议加密存储

## 性能影响

- 每次请求会额外写入一个 JSON 文件（通常 < 10KB）
- 对请求延迟影响极小（异步写入）
- 磁盘占用：每天 1000 次请求约 10MB

## 与 Squirrel 的对比

| 功能 | MyLLM Gateway | Squirrel |
|------|---------------|----------|
| 存储方式 | 文件系统 | PostgreSQL/SQLite |
| 查询方式 | RESTful API | Web UI + API |
| 流式支持 | ✅ 完整记录 | ✅ 完整记录 |
| 部署复杂度 | 低（无需数据库） | 中（需要数据库） |
| 查询性能 | 中（文件扫描） | 高（数据库索引） |

## 未来改进

- [ ] 添加日志搜索功能（按关键词搜索 prompt/response）
- [ ] 支持日志导出（CSV、JSON）
- [ ] 添加日志统计仪表板
- [ ] 支持日志压缩存储
- [ ] 可选的数据库存储后端
