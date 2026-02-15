#!/usr/bin/env node

/**
 * 测试脚本：演示场景免费意愿度
 * 
 * 展示不同场景对免费模型的使用意愿差异
 */

import { loadConfig } from './src/config/default.js';
import { RoutingEngine } from './src/core/router.js';
import { QuotaManager } from './src/core/quota.js';
import { scenarioPriorities, getWillingnessDescription } from './src/config/scenario-priority.js';

console.log('🧪 测试场景免费意愿度\n');
console.log('='.repeat(60));

// 显示各场景的免费意愿度
console.log('\n📊 各场景免费意愿度配置：');
console.log('-'.repeat(60));
for (const config of scenarioPriorities) {
  const bar = '█'.repeat(Math.round(config.freeTierWillingness * 20)).padEnd(20, '░');
  console.log(`${config.scenario.padEnd(15)} ${bar} ${(config.freeTierWillingness * 100).toFixed(0)}%`);
  console.log(`  ${config.description}\n`);
}

// 初始化
const config = loadConfig();
const quotaManager = new QuotaManager('./data');
const router = new RoutingEngine(config, quotaManager);

// 模拟注册两个模型
const now = new Date();

// Groq - 月额度
quotaManager.registerFreeTier({
  provider: 'groq',
  model: 'llama-3.1-8b-instant',
  totalQuota: 1000000,
  usedQuota: 200000,
  resetPeriod: 'monthly',
  lastResetAt: new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000),
  priority: 1,
  enabled: true
});

// SiliconFlow - 日额度
quotaManager.registerFreeTier({
  provider: 'siliconflow',
  model: 'Qwen2.5-7B-Instruct',
  totalQuota: 500000,
  usedQuota: 200000,
  resetPeriod: 'daily',
  lastResetAt: new Date(now.getTime() - 16 * 60 * 60 * 1000),
  priority: 1,
  enabled: true
});

console.log('='.repeat(60));
console.log('\n🎲 测试不同场景的路由决策（运行多次观察差异）：\n');

// 测试场景1：代码生成（90%意愿度）
console.log('💻 场景1：代码生成（90%免费意愿）');
console.log('   用户："写一个 Python 快排算法"');
for (let i = 0; i < 5; i++) {
  const decision = router.decideModel([
    { role: 'user', content: '写一个 Python 快排算法' }
  ]);
  const icon = decision.isFreeTier ? '🆓' : '💰';
  console.log(`   运行${i+1}: ${icon} ${decision.model} (${decision.reason.substring(0, 50)}...)`);
}

// 测试场景2：通用对话（30%意愿度）
console.log('\n💬 场景2：通用对话（30%免费意愿）');
console.log('   用户："你好，今天天气怎么样？"');
for (let i = 0; i < 5; i++) {
  const decision = router.decideModel([
    { role: 'user', content: '你好，今天天气怎么样？' }
  ]);
  const icon = decision.isFreeTier ? '🆓' : '💰';
  console.log(`   运行${i+1}: ${icon} ${decision.model} (${decision.reason.substring(0, 50)}...)`);
}

// 测试场景3：数学推理（80%意愿度）
console.log('\n🔢 场景3：数学推理（80%免费意愿）');
console.log('   用户："求解方程 x² + 3x + 2 = 0"');
for (let i = 0; i < 5; i++) {
  const decision = router.decideModel([
    { role: 'user', content: '求解方程 x² + 3x + 2 = 0' }
  ]);
  const icon = decision.isFreeTier ? '🆓' : '💰';
  console.log(`   运行${i+1}: ${icon} ${decision.model} (${decision.reason.substring(0, 50)}...)`);
}

// 测试场景4：创意写作（50%意愿度）
console.log('\n✍️  场景4：创意写作（50%免费意愿）');
console.log('   用户："写一个科幻故事"');
for (let i = 0; i < 5; i++) {
  const decision = router.decideModel([
    { role: 'user', content: '写一个科幻故事' }
  ]);
  const icon = decision.isFreeTier ? '🆓' : '💰';
  console.log(`   运行${i+1}: ${icon} ${decision.model} (${decision.reason.substring(0, 50)}...)`);
}

console.log('\n' + '='.repeat(60));
console.log('\n📈 观察结果：');
console.log('   • 代码场景：大部分使用免费模型（省钱）');
console.log('   • 聊天场景：大部分使用付费模型（体验好）');
console.log('   • 数学场景：较多使用免费模型');
console.log('   • 创意场景：免费付费各半');

console.log('\n✨ 测试完成！');
console.log('\n💡 提示：可以修改 src/config/scenario-priority.ts 调整各场景的意愿度');
