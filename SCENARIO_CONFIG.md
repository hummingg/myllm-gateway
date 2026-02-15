# 场景优先级自定义配置指南

## 📋 概述

LLM Gateway 现在支持用户自定义场景优先级配置，包括：
- 场景检测顺序（决定多场景匹配时的优先级）
- 各场景的免费意愿度（0-1，越高越倾向使用免费模型）
- 场景的优先级类型（速度优先、能力优先、先过期优先等）
- 场景内的模型排名

## 🚀 快速开始

### 1. 创建配置文件

在项目根目录创建 `config.json` 文件：

```json
{
  "scenarioPriorities": [
    {
      "scenario": "code",
      "priorityType": "speed_first",
      "modelRanking": ["groq/llama-3.1-8b-instant"],
      "freeTierWillingness": 0.9,
      "description": "代码生成场景"
    }
  ]
}
```

### 2. 启动服务

配置会在服务启动时自动加载：

```bash
npm run dev
```

## ⚙️ 配置详解

### scenarioPriorities 数组

场景优先级配置是一个数组，**数组顺序决定了场景的检测优先级**。

当一个请求同时匹配多个场景时，会使用数组中**第一个匹配的场景**的配置。

### 场景配置字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `scenario` | string | 场景名称 | `"code"`, `"math"`, `"long_context"` |
| `priorityType` | enum | 优先级类型 | `"speed_first"`, `"capability_first"`, `"expiry_first"`, `"cost_first"` |
| `modelRanking` | string[] | 模型排名列表 | `["groq/llama-3.1-8b-instant"]` |
| `freeTierWillingness` | number | 免费意愿度 (0-1) | `0.9` = 90% 概率使用免费模型 |
| `description` | string | 场景描述（可选） | `"代码生成场景"` |

### 支持的场景类型

| 场景名称 | 说明 | 检测关键词 |
|---------|------|-----------|
| `code` | 代码生成 | code, programming, debug, function, class, api, bug |
| `math` | 数学推理 | math, calculate, solve, equation, logic, reasoning |
| `long_context` | 长文本 | 输入长度 > 10000 字符 |
| `creative` | 创意写作 | write, story, creative, poem, essay, blog |
| `analysis` | 分析任务 | analyze, compare, evaluate, assess, review |
| `translation` | 翻译 | translate, translation, 中文, 英文 |
| `general` | 通用对话 | 默认场景 |

### 优先级类型说明

| 类型 | 说明 | 适用场景 |
|------|------|---------|
| `speed_first` | 速度优先 | 代码生成（Groq 最快） |
| `capability_first` | 能力优先 | 数学推理、长文本 |
| `expiry_first` | 先过期优先 | 通用场景（避免浪费额度） |
| `cost_first` | 成本优先 | 经济模式 |

## 📝 配置示例

### 示例 1：数学场景优先

如果你经常做数学计算，想让数学场景排在第一位：

```json
{
  "scenarioPriorities": [
    {
      "scenario": "math",
      "priorityType": "capability_first",
      "modelRanking": ["groq/mixtral-8x7b-32768"],
      "freeTierWillingness": 0.95,
      "description": "数学场景优先，提高免费意愿度"
    },
    {
      "scenario": "code",
      "priorityType": "speed_first",
      "modelRanking": ["groq/llama-3.1-8b-instant"],
      "freeTierWillingness": 0.9
    },
    {
      "scenario": "general",
      "priorityType": "expiry_first",
      "modelRanking": [],
      "freeTierWillingness": 0.3
    }
  ]
}
```

### 示例 2：降低代码场景的免费意愿度

如果你希望代码生成使用更高质量的付费模型：

```json
{
  "scenarioPriorities": [
    {
      "scenario": "code",
      "priorityType": "capability_first",
      "modelRanking": [],
      "freeTierWillingness": 0.3,
      "description": "代码场景优先使用付费模型"
    }
  ]
}
```

### 示例 3：全部使用免费模型

最大化节省成本：

```json
{
  "scenarioPriorities": [
    {
      "scenario": "code",
      "priorityType": "speed_first",
      "modelRanking": ["groq/llama-3.1-8b-instant"],
      "freeTierWillingness": 1.0
    },
    {
      "scenario": "math",
      "priorityType": "capability_first",
      "modelRanking": ["groq/mixtral-8x7b-32768"],
      "freeTierWillingness": 1.0
    },
    {
      "scenario": "general",
      "priorityType": "expiry_first",
      "modelRanking": [],
      "freeTierWillingness": 1.0
    }
  ]
}
```

## 🎯 场景优先级的工作原理

### 1. 场景检测

当请求到达时，系统会检测所有匹配的场景：

```
用户请求: "写一个 Python 算法来 solve 这个数学方程"
检测结果: ['code', 'math']
```

### 2. 选择场景配置

使用 `scenarioPriorities` 数组中**第一个匹配的场景**：

```json
{
  "scenarioPriorities": [
    {"scenario": "math", ...},   // ← 如果 math 排第一，使用这个
    {"scenario": "code", ...}
  ]
}
```

### 3. 应用免费意愿度

根据场景的 `freeTierWillingness` 决定是否使用免费模型：

```
freeTierWillingness: 0.9
→ 90% 概率使用免费模型
→ 10% 概率使用付费模型
```

### 4. 选择具体模型

根据 `priorityType` 和 `modelRanking` 选择最佳模型：

- `speed_first`: Groq 优先
- `capability_first`: 按 modelRanking 排序
- `expiry_first`: 按过期时间排序

## 💡 最佳实践

### 1. 场景顺序建议

将最常用或最重要的场景放在前面：

```json
{
  "scenarioPriorities": [
    {"scenario": "code", ...},      // 最常用
    {"scenario": "math", ...},      // 次常用
    {"scenario": "general", ...}    // 兜底
  ]
}
```

### 2. 免费意愿度设置

- **高意愿度 (0.8-1.0)**: 简单任务、代码生成、翻译
- **中等意愿度 (0.5-0.7)**: 分析任务、长文本
- **低意愿度 (0.2-0.4)**: 重要对话、创意写作

### 3. 模型排名

只在 `capability_first` 模式下需要设置 `modelRanking`：

```json
{
  "priorityType": "capability_first",
  "modelRanking": [
    "groq/mixtral-8x7b-32768",      // 第一选择
    "siliconflow/Qwen2.5-7B-Instruct"  // 备选
  ]
}
```

### 4. 保留 general 场景

始终保留 `general` 场景作为兜底：

```json
{
  "scenarioPriorities": [
    // ... 其他场景
    {
      "scenario": "general",
      "priorityType": "expiry_first",
      "modelRanking": [],
      "freeTierWillingness": 0.3
    }
  ]
}
```

## 🔍 调试配置

### 查看当前配置

```bash
curl http://localhost:3000/config/scenarios
```

### 测试场景检测

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "写一个 Python 快排"}],
    "debug": true
  }'
```

响应会包含场景检测和路由决策信息。

## ⚠️ 注意事项

1. **配置验证**: 配置文件必须符合 JSON 格式，否则会使用默认配置
2. **场景名称**: 必须使用支持的场景名称（code, math, long_context 等）
3. **意愿度范围**: freeTierWillingness 必须在 0-1 之间
4. **模型格式**: modelRanking 中的模型必须使用 `provider/model` 格式
5. **重启生效**: 修改配置后需要重启服务才能生效

## 📚 相关��档

- [README.md](./README.md) - 项目总览
- [config.example.json](./config.example.json) - 配置示例
