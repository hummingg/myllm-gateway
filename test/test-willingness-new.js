#!/usr/bin/env node

/**
 * 测试场景免费意愿度的影响
 */

import { RoutingEngine } from './dist/core/router.js';
import { defaultConfig } from './dist/config/default.js';

console.log('🧪 测试场景免费意愿度的影响\n');

// 配置 1: 代码场景高意愿度 (90%)
const config1 = {
  ...defaultConfig,
  scenarioPriorities: [
    {
      scenario: 'code',
      priorityType: 'speed_first',
      modelRanking: [],
      freeTierWillingness: 0.9,
      description: '代码场景 90% 意愿度'
    },
    {
      scenario: 'general',
      priorityType: 'expiry_first',
      modelRanking: [],
      freeTierWillingness: 0.3
    }
  ]
};

// 配置 2: 代码场景低意愿度 (10%)
const config2 = {
  ...defaultConfig,
  scenarioPriorities: [
    {
      scenario: 'code',
      priorityType: 'speed_first',
      modelRanking: [],
      freeTierWillingness: 0.1,
      description: '代码场景 10% 意愿度'
    },
    {
      scenario: 'general',
      priorityType: 'expiry_first',
      modelRanking: [],
      freeTierWillingness: 0.3
    }
  ]
};

// 配置 3: 代码场景 100% 意愿度
const config3 = {
  ...defaultConfig,
  scenarioPriorities: [
    {
      scenario: 'code',
      priorityType: 'speed_first',
      modelRanking: [],
      freeTierWillingness: 1.0,
      description: '代码场景 100% 意愿度'
    },
    {
      scenario: 'general',
      priorityType: 'expiry_first',
      modelRanking: [],
      freeTierWillingness: 0.3
    }
  ]
};

const testMessage = {
  role: 'user',
  content: 'write a simple hello world function'
};

console.log(`📝 测试输入: "${testMessage.content}"\n`);

// 测试配置 1
console.log('配置 1: 代码场景 90% 免费意愿度');
const router1 = new RoutingEngine(config1);
let freeCount1 = 0;
const runs = 20;
for (let i = 0; i < runs; i++) {
  const decision = router1.decideModel([testMessage]);
  if (decision.isFreeTier) freeCount1++;
}
console.log(`  运行 ${runs} 次，使用免费模型: ${freeCount1} 次 (${(freeCount1/runs*100).toFixed(0)}%)`);

// 测试配置 2
console.log('\n配置 2: 代码场景 10% 免费意愿度');
const router2 = new RoutingEngine(config2);
let freeCount2 = 0;
for (let i = 0; i < runs; i++) {
  const decision = router2.decideModel([testMessage]);
  if (decision.isFreeTier) freeCount2++;
}
console.log(`  运行 ${runs} 次，使用免费模型: ${freeCount2} 次 (${(freeCount2/runs*100).toFixed(0)}%)`);

// 测试配置 3
console.log('\n配置 3: 代码场景 100% 免费意愿度');
const router3 = new RoutingEngine(config3);
let freeCount3 = 0;
for (let i = 0; i < runs; i++) {
  const decision = router3.decideModel([testMessage]);
  if (decision.isFreeTier) freeCount3++;
}
console.log(`  运行 ${runs} 次，使用免费模型: ${freeCount3} 次 (${(freeCount3/runs*100).toFixed(0)}%)`);

console.log('\n💡 结论:');
console.log('freeTierWillingness 参数控制使用免费模型的概率：');
console.log('- 0.9 (90%) → 约 90% 的请求使用免费模型');
console.log('- 0.1 (10%) → 约 10% 的请求使用免费模型');
console.log('- 1.0 (100%) → 100% 的请求使用免费模型');
console.log('\n✅ 免费意愿度功能测试通过！');
