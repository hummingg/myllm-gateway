#!/bin/bash

echo "🧪 测试 LLM Gateway API 调用"
echo "================================"
echo ""

echo "1. 测试服务状态..."
curl -s http://localhost:3000/stats | jq '.' || echo "❌ 服务未响应"
echo ""

echo "2. 测试模型调用 (Moonshot Kimi)..."
response=$(curl -s -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kimi-k2.5",
    "messages": [{"role": "user", "content": "你好"}],
    "max_tokens": 50
  }')

echo "$response" | jq '.'
echo ""

echo "3. 测试自动路由..."
response=$(curl -s -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "写一个 hello world"}],
    "max_tokens": 50
  }')

echo "$response" | jq '.'
