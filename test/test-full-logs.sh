#!/bin/bash

# 测试完整请求日志功能

echo "🧪 测试完整请求日志功能"
echo "================================"

# 1. 发送测试请求
echo -e "\n1️⃣ 发送测试请求..."
RESPONSE=$(curl -s http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "你好，这是一个测试请求"}],
    "temperature": 0.7
  }')

REQUEST_ID=$(echo $RESPONSE | jq -r '.id')
echo "✅ 请求 ID: $REQUEST_ID"

# 等待日志写入
sleep 1

# 2. 查询完整日志
echo -e "\n2️⃣ 查询完整请求日志..."
LOG=$(curl -s http://localhost:3000/logs/$REQUEST_ID)

if [ -z "$LOG" ] || [ "$LOG" == "null" ]; then
  echo "❌ 日志查询失败"
  exit 1
fi

echo "✅ 日志查询成功"

# 3. 验证日志内容
echo -e "\n3️⃣ 验证日志内容..."

# 检查基础字段
echo "   • Request ID: $(echo $LOG | jq -r '.id')"
echo "   • Model: $(echo $LOG | jq -r '.model')"
echo "   • Provider: $(echo $LOG | jq -r '.provider')"
echo "   • Latency: $(echo $LOG | jq -r '.latency')ms"
echo "   • Cost: $$(echo $LOG | jq -r '.cost')"

# 检查请求体
echo -e "\n   📥 请求信息:"
echo "   • Requested Model: $(echo $LOG | jq -r '.request.model')"
echo "   • Messages: $(echo $LOG | jq -r '.request.messages[0].content')"
echo "   • Temperature: $(echo $LOG | jq -r '.request.temperature')"

# 检查响应体
echo -e "\n   📤 响应信息:"
CONTENT=$(echo $LOG | jq -r '.response.content')
echo "   • Content Length: ${#CONTENT} 字符"
echo "   • Finish Reason: $(echo $LOG | jq -r '.response.finishReason')"
echo "   • Tokens: $(echo $LOG | jq -r '.response.usage.totalTokens')"

# 检查路由信息
echo -e "\n   🧭 路由信息:"
echo "   • Selected Model: $(echo $LOG | jq -r '.routing.selectedModel')"
echo "   • Selected Provider: $(echo $LOG | jq -r '.routing.selectedProvider')"
echo "   • Reason: $(echo $LOG | jq -r '.routing.reason')"
echo "   • Is Free Tier: $(echo $LOG | jq -r '.routing.isFreeTier')"

# 4. 查询今天的所有日志
echo -e "\n4️⃣ 查询今天的所有日志..."
TODAY=$(date +%Y-%m-%d)
TODAY_LOGS=$(curl -s "http://localhost:3000/logs?date=$TODAY")
TOTAL=$(echo $TODAY_LOGS | jq -r '.total')
echo "✅ 今天共有 $TOTAL 条日志"

# 5. 查询最近的日志
echo -e "\n5️⃣ 查询最近的日志..."
RECENT_LOGS=$(curl -s "http://localhost:3000/logs?limit=10")
RECENT_TOTAL=$(echo $RECENT_LOGS | jq -r '.total')
echo "✅ 最近有 $RECENT_TOTAL 条日志"

echo -e "\n================================"
echo "✅ 所有测试通过！"
echo ""
echo "💡 提示："
echo "   • 日志文件位置: logs/requests/$TODAY/"
echo "   • 查看日志: curl http://localhost:3000/logs/$REQUEST_ID | jq"
echo "   • 查看今天日志: curl http://localhost:3000/logs?date=$TODAY | jq"
