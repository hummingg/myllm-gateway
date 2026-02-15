#!/usr/bin/env node

/**
 * 测试脚本：演示先过期优先的路由策略
 * 
 * 场景：同时有两个免费模型可用
 * - Groq: 月额度，3天后重置
 * - SiliconFlow: 日额度，8小时后重置
 * 
 * 预期：优先使用 SiliconFlow（因为先过期）
 */

import { loadConfig } from './src/config/default.js';
import { RoutingEngine } from './src/core/router.js';
import { QuotaManager } from './src/core/quota.js';

console.log('🧪 测试先过期优先路由策略\n');

// 初始化
const config = loadConfig();
const quotaManager = new QuotaManager('./data');
const router = new RoutingEngine(config, quotaManager);

// 模拟注册两个免费模型（设置不同的过期时间）
const now = new Date();

// SiliconFlow - 日额度（即将过期）
quotaManager.registerFreeTier({
  provider: 'siliconflow',
  model: 'Qwen2.5-7B-Instruct',
  totalQuota: 500000,
  usedQuota: 200000, // 还剩 300K
  resetPeriod: 'daily',
  lastResetAt: new Date(now.getTime() - 16 * 60 * 60 * 1000), // 16小时前，8小时后过期
  priority: 1,
  enabled: true
});

// Groq - 月额度（还有很久）
quotaManager.registerFreeTier({
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
  totalQuota: 1000000,
  usedQuota: 200000, // 还剩 800K
  resetPeriod: 'monthly',
  lastResetAt: new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000), // 27天前，3天后过期
  priority: 1,
  enabled: true
});

console.log('📊 已注册免费模型额度：');
console.log('  • SiliconFlow Qwen2.5: 300K tokens, 8小时后过期（日额度）');
console.log('  • Groq Llama 3.1: 800K tokens, 3天后过期（月额度）\n');

// 测试场景1：通用对话（先过期优先）
console.log('📝 测试场景1：通用对话（先过期优先）');
const decision1 = router.decideModel([
  { role: 'user', content: '你好，请介绍一下自己' }
], { preferFreeTier: true });

console.log(`   选中模型: ${decision1.model}`);
console.log(`   提供商: ${decision1.provider}`);
console.log(`   原因: ${decision1.reason}`);
console.log(`   是否免费: ${decision1.isFreeTier ? '✅' : '❌'}`);
console.log(`   预期: SiliconFlow（先过期，8小时后重置）\n`);

// 测试场景2：代码生成（速度优先，应该选 Groq）
console.log('📝 测试场景2：代码生成（速度优先）');
const decision2 = router.decideModel([
  { role: 'user', content: '写一个 Python 快排算法' }
], { preferFreeTier: true });

console.log(`   选中模型: ${decision2.model}`);
console.log(`   提供商: ${decision2.provider}`);
console.log(`   原因: ${decision2.reason}`);
console.log(`   是否免费: ${decision2.isFreeTier ? '✅' : '❌'}`);
console.log(`   预期: Groq（速度优先，虽然后过期但代码场景更优）\n`);

// 测试场景3：长文本（能力优先，应该选 SiliconFlow）
console.log('📝 测试场景3：长文本处理（100K tokens，能力优先）');
const longText = '这是一个很长的文本。'.repeat(5000);
const decision3 = router.decideModel([
  { role: 'user', content: `总结以下内容：${longText}` }
], { preferFreeTier: true });

console.log(`   选中模型: ${decision3.model}`);
console.log(`   提供商: ${decision3.provider}`);
console.log(`   原因: ${decision3.reason}`);
console.log(`   是否免费: ${decision3.isFreeTier ? '✅' : '❌'}`);
console.log(`   预期: SiliconFlow（能力优先，支持 128K 上下文）\n`);

// 测试场景4：数学推理（能力优先）
console.log('📝 测试场景4：数学推理（能力优先）');
const decision4 = router.decideModel([
  { role: 'user', content: '求解方程 x² + 3x + 2 = 0' }
], { preferFreeTier: true });

console.log(`   选中模型: ${decision4.model}`);
console.log(`   提供商: ${decision4.provider}`);
console.log(`   原因: ${decision4.reason}`);
console.log(`   是否免费: ${decision4.isFreeTier ? '✅' : '❌'}`);
console.log(`   预期: Groq Mixtral 或 SiliconFlow Qwen（能力优先）\n`);

// 测试场景5：质量优先（忽略免费）
console.log('📝 测试场景5：质量优先（忽略免费）');
const decision5 = router.decideModel([
  { role: 'user', content: '你好' }
], { priority: 'quality' });

console.log(`   选中模型: ${decision5.model}`);
console.log(`   提供商: ${decision5.provider}`);
console.log(`   原因: ${decision5.reason}`);
console.log(`   是否免费: ${decision5.isFreeTier ? '✅' : '❌'}`);
console.log(`   预期: 付费模型（如 Claude 3.5 Sonnet 或 GPT-4o）\n`);

// 查看额度预警
console.log('⚠️  额度预警检查：');
const alerts = quotaManager.getLowQuotaAlerts(100000, 48);
if (alerts.length > 0) {
  alerts.forEach(alert => {
    console.log(`   ${alert.reason === 'expiring_soon' ? '⏰' : '⚠️ '} ${alert.message}`);
  });
} else {
  console.log('   ✅ 无异常');
}

console.log('\n✨ 测试完成！');
