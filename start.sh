#!/bin/bash

# LLM Gateway 启动脚本

echo "🚀 启动 LLM Gateway..."

# 检查环境变量文件
if [ ! -f .env ]; then
    echo "⚠️  未找到 .env 文件，使用 .env.example 作为模板"
    cp .env.example .env
    echo "📝 请编辑 .env 文件填入你的 API Keys"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 检查 TypeScript 编译
if [ ! -d "dist" ]; then
    echo "🔨 编译 TypeScript..."
    npm run build
fi

# 创建日志目录
mkdir -p logs

# 启动服务
echo "🎯 启动服务..."
node dist/index.js
