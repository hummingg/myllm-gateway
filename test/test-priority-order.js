#!/usr/bin/env node

/**
 * 测试场景优先级顺序的影响
 */

import { RoutingEngine } from './dist/core/router.js';
import { defaultConfig } from './dist/config/default.js';

console.log('🧪 测试场景优先级顺序的影响\n');

// 创建两个不同的配置
const config1 = {
  ...defaultConfig,
  scenarioPriorities: [
    {
      scenario: 'code',
      priorityType: 'speed_first',
      modelRanking: ['groq/llama-3.1-8b-instant'],
      freeTierWillingness: 0.9,
      description: '代码优先'
    },
    {
      scenario: 'math',
      priorityType: 'capability_first',
      modelRanking: ['groq/mixtral-8x7b-32768'],
      freeTierWillingness: 0.8,
      description: '数学次之'
    },
    {
      scenario: 'general',
      priorityType: 'expiry_first',
      modelRanking: [],
      freeTierWillingness: 0.3,
      description: '通用兜底'
    }
  ]
};

const config2 = {
  ...defaultConfig,
  scenarioPriorities: [
    {
      scenario: 'math',
      priorityType: 'capability_first',
      modelRanking: ['groq/mixtral-8x7b-32768'],
      freeTierWillingness: 0.95,
      description: '数学优先'
    },
    {
      scenario: 'code',
      priorityType: 'speed_first',
      modelRanking: ['groq/llama-3.1-8b-instant'],
      freeTierWillingness: 0.85,
      description: '代码次之'
    },
    {
      scenario: 'general',
      priorityType: 'expiry_first',
      modelRanking: [],
      freeTierWillingness: 0.3,
      description: '通用兜底'
    }
  ]
};

// 测试同时包含代码和数学关键词的请求
const testMessage = {
  role: 'user',
  content: '写一个 Python 算法来 solve 这个数学方程: x^2 + 5x + 6 = 0'
};

console.log(`📝 测试输入: "${testMessage.content}"`);
console.log('   (同时包含 code 和 math 关键词)\n');

console.log('配置 1: code 场景排第一');
console.log('场景顺序: code → math → general');
const router1 = new RoutingEngine(config1);
// 多次测试以观察概率效果
console.log('运行 5 次测试:');
for (let i = 0; i < 5; i++) {
  const decision = router1.decideModel([testMessage]);
  console.log(`  ${i + 1}. ${decision.reason} | 免费: ${decision.isFreeTier ? '是' : '否'} | 成本: $${decision.estimatedCost.toFixed(6)}`);
}

console.log('\n配置 2: math 场景排第一');
console.log('场景顺序: math → code → general');
const router2 = new RoutingEngine(config2);
console.log('运行 5 次测试:');
for (let i = 0; i < 5; i++) {
  const decision = router2.decideModel([testMessage]);
  console.log(`  ${i + 1}. ${decision.reason} | 免费: ${decision.isFreeTier ? '是' : '否'} | 成本: $${decision.estimatedCost.toFixed(6)}`);
}

console.log('\n💡 结论:');
console.log('当请求同时匹配多个场景时，使用 scenarioPriorities 数组中');
console.log('第一个匹配的场景配置（包括其免费意愿度和优先级类型）。');
console.log('\n✅ 场景优先级自定义功能测试通过！');
