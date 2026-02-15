# 发布指南

## 推送到GitHub

### 1. 初始化Git仓库

```bash
cd /Users/hummingg/GitProjects/ai-coding/NodejsProj/myllm-gateway

# 初始化git
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
```

### 2. 连接到GitHub仓库

```bash
# 设置主分支
git branch -M main

# 添加远程仓库
git remote add origin https://github.com/hummingg/myllm-gateway.git

# 推送到GitHub
git push -u origin main
```

### 3. 在GitHub上完善项目

访问 https://github.com/hummingg/myllm-gateway

#### 添加项目描述

在仓库页面点击"About"旁的设置图标，添加：

**Description:**
```
个人专属的多模型智能网关 | 免费优先 | 智能路由 | 多提供商统一管理
```

**Website:**
```
https://github.com/hummingg/myllm-gateway
```

**Topics (标签):**
```
llm
gateway
ai
openai-compatible
anthropic
claude
moonshot
kimi
aliyun
siliconflow
router
free-tier
cost-optimization
personal
self-hosted
typescript
nodejs
```

#### 启用功能

- ✅ Issues
- ✅ Discussions
- ✅ Wiki (可选)

### 4. 创建第一个Release

1. 点击右侧的 "Releases"
2. 点击 "Create a new release"
3. 填写信息：
   - **Tag:** v1.0.0
   - **Release title:** MyLLM Gateway v1.0.0 - 首次发布
   - **Description:**

```markdown
## 🎉 首次发布

MyLLM Gateway 是一个个人专属的多模型智能网关，帮助你管理和优化AI模型的使用。

### ✨ 主要特性

- 🆓 **免费优先**: 自动优先使用免费额度，最大化节省成本
- 🧠 **智能路由**: 根据场景自动选择最佳模型
- 🏢 **多提供商**: 支持 Anthropic、Moonshot、SiliconFlow、Aliyun 等
- 🔌 **OpenAI兼容**: 完全兼容 OpenAI API 格式
- 📊 **实时监控**: 请求统计、成本分析、额度追踪

### 🆓 免费额度

- **Aliyun**: 18个模型，每个1M tokens，总计1800万tokens
- **SiliconFlow**: 500K tokens/日
- **Moonshot**: 500K tokens/月

### 📦 快速开始

```bash
git clone https://github.com/hummingg/myllm-gateway.git
cd myllm-gateway
npm install
cp .env.example .env
# 编辑 .env 配置API密钥
npm run dev
```

详细文档请查看 [README.md](https://github.com/hummingg/myllm-gateway#readme)

### 🙏 致谢

感谢所有AI提供商提供的免费额度！
```

4. 点击 "Publish release"

### 5. 推广（可选）

#### 国内平台

- **V2EX**: https://www.v2ex.com/
  - 发布到 "分享创造" 节点
  - 标题：`[开源] MyLLM Gateway - 个人AI网关，管理1800万+免费tokens`

- **掘金**: https://juejin.cn/
  - 发布技术文章介绍项目

- **知乎**: https://www.zhihu.com/
  - 写一篇使用教程

#### 国际平台

- **Reddit**: https://www.reddit.com/r/LocalLLaMA/
  - 标题：`[Project] MyLLM Gateway - Personal AI Gateway with 18M+ Free Tokens`

- **Hacker News**: https://news.ycombinator.com/
  - Show HN: MyLLM Gateway - Personal AI Gateway

- **Product Hunt**: https://www.producthunt.com/
  - 提交产品

#### GitHub相关

- **Awesome Lists**: 提交到相关的 Awesome 列表
  - awesome-llm
  - awesome-ai-tools
  - awesome-selfhosted

### 6. 维护

#### 定期更新

- 及时回复 Issues
- 审查 Pull Requests
- 更新文档
- 发布新版本

#### 版本号规范

遵循语义化版本 (Semantic Versioning):
- **主版本号**: 不兼容的API修改
- **次版本号**: 向下兼容的功能性新增
- **修订号**: 向下兼容的问题修正

例如：
- v1.0.0 → v1.0.1 (bug修复)
- v1.0.1 → v1.1.0 (新功能)
- v1.1.0 → v2.0.0 (破坏性更改)

## 检查清单

发布前确认：

- [ ] 所有文档已更新
- [ ] 仓库URL已更新为正确地址
- [ ] .env文件中没有真实API密钥
- [ ] .gitignore配置正确
- [ ] LICENSE文件存在
- [ ] README.md完整且准确
- [ ] 代码可以正常运行
- [ ] 没有敏感信息泄露

## 常见问题

**Q: 如何更新已发布的代码？**
```bash
git add .
git commit -m "feat: 添加新功能"
git push
```

**Q: 如何发布新版本？**
1. 更新 package.json 中的版本号
2. 创建 git tag: `git tag v1.1.0`
3. 推送 tag: `git push --tags`
4. 在GitHub上创建新的Release

**Q: 如何处理贡献者的PR？**
1. 审查代码
2. 测试功能
3. 提供反馈或合并
4. 感谢贡献者

---

祝发布顺利！🚀
