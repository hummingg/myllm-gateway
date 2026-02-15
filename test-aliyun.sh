#!/bin/bash
echo "测试 Aliyun DeepSeek V3.2..."
curl -s -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @- << 'JSON' | head -c 500
{
  "model": "deepseek-v3.2",
  "messages": [{"role": "user", "content": "你好"}],
  "max_tokens": 50
}
JSON
