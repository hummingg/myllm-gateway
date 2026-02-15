#!/bin/bash
curl -s -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @- << 'JSON'
{
  "model": "kimi-k2.5",
  "messages": [{"role": "user", "content": "你好，请用一句话介绍你自己"}],
  "max_tokens": 200
}
JSON
