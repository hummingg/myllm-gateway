FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源码
COPY . .

# 编译
RUN npm run build

# 创建日志目录
RUN mkdir -p logs

# 暴露端口
EXPOSE 3000

# 启动
CMD ["node", "dist/index.js"]
