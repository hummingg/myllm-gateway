# 贡献指南

感谢你对 MyLLM Gateway 的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告问题

如果你发现了bug或有功能建议：

1. 在 [Issues](../../issues) 中搜索是否已有相关问题
2. 如果没有，创建新的 Issue，并提供：
   - 清晰的标题和描述
   - 复现步骤（如果是bug）
   - 期望的行为
   - 实际的行为
   - 环境信息（Node.js版本、操作系统等）

### 提交代码

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循现有的代码风格
- 添加必要的注释
- 确保代码通过 lint 检查

### 提交信息规范

使用清晰的提交信息：

- `feat: 添加新功能`
- `fix: 修复bug`
- `docs: 更新文档`
- `refactor: 重构代码`
- `test: 添加测试`
- `chore: 构建/工具链更新`

## 开发设置

```bash
# 克隆仓库
git clone https://github.com/hummingg/myllm-gateway.git
cd myllm-gateway

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动开发服务器
npm run dev
```

## 测试

```bash
# 运行测试
npm test

# 运行lint
npm run lint
```

## 添加新的AI提供商

如果你想添加新的AI提供商支持：

1. 在 `src/providers/` 创建新的 provider 类
2. 继承 `BaseProvider` 或 `OpenAIProvider`
3. 在 `src/config/default.ts` 添加配置
4. 更新 README.md 文档

## 问题讨论

有任何问题或想法，欢迎在 [Discussions](../../discussions) 中讨论。

## 行为准则

请保持友善和尊重。我们致力于为所有人提供一个友好、安全和欢迎的环境。

## 许可证

通过贡献代码，你同意你的贡献将在 MIT 许可证下发布。
