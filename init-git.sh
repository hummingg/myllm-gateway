#!/bin/bash

echo "🚀 初始化Git仓库并推送到GitHub..."

# 初始化git仓库
git init

# 添加所有文件
git add .

# 创建初始提交
git commit -m "feat: initial commit - MyLLM Gateway v1.0.0

- 支持多个AI提供商（Anthropic, Moonshot, SiliconFlow, Aliyun）
- 18个Aliyun免费模型，总计1800万tokens
- 智能路由和免费额度优先
- OpenAI兼容API
- 完整的文档和贡献指南"

# 设置主分支
git branch -M main

# 添加远程仓库
git remote add origin https://github.com/hummingg/myllm-gateway.git

# 推送到GitHub
echo "📤 推送到GitHub..."
git push -u origin main

echo "✅ 完成！项目已推送到 https://github.com/hummingg/myllm-gateway"
