#!/usr/bin/env node

/**
 * 测试场景优先级自定义功能
 */

import { loadConfig } from './dist/config/default.js';
import { RoutingEngine } from './dist/core/router.js';
import fs from 'fs';

console.log('🧪 测试场景优先级自定义功能\n');

// 测试 1: 加载默认配置
console.log('📋 测试 1: 加载默认配置');
const defaultConfig = loadConfig();
console.log(`✓ 默认场景数量: ${defaultConfig.scenarioPriorities?.length || 0}`);
if (defaultConfig.scenarioPriorities && defaultConfig.scenarioPriorities.length > 0) {
  console.log(`✓ 第一个场景: ${defaultConfig.scenarioPriorities[0].scenario} (意愿度: ${defaultConfig.scenarioPriorities[0].freeTierWillingness})`);
}
console.log('');

// 测试 2: 加载自定义配置
console.log('📋 测试 2: 加载自定义配置');
// 临时重命名 config.test.json 为 config.json
if (fs.existsSync('config.test.json')) {
  const testConfig = JSON.parse(fs.readFileSync('config.test.json', 'utf-8'));
  console.log(`✓ 测试配置场景数量: ${testConfig.scenarioPriorities.length}`);
  console.log(`✓ 第一个场景: ${testConfig.scenarioPriorities[0].scenario} (意愿度: ${testConfig.scenarioPriorities[0].freeTierWillingness})`);
  console.log(`✓ 场景顺序: ${testConfig.scenarioPriorities.map(s => s.scenario).join(' → ')}`);
}
console.log('');

// 测试 3: 路由引擎初始化
console.log('📋 测试 3: 路由引擎初始化');
try {
  const router = new RoutingEngine(defaultConfig);
  console.log('✓ 路由引擎初始化成功');

  // 测试场景检测
  const testMessages = [
    { role: 'user', content: '写一个 Python 快排算法' },
    { role: 'user', content: 'solve this math equation: x^2 + 5x + 6 = 0' },
    { role: 'user', content: '你好，今天天气怎么样？' }
  ];

  console.log('\n📋 测试 4: 场景检测和路由决策');
  for (const msg of testMessages) {
    console.log(`\n输入: "${msg.content}"`);
    try {
      const decision = router.decideModel([msg]);
      console.log(`  → 选择模型: ${decision.model}`);
      console.log(`  → 供应商: ${decision.provider}`);
      console.log(`  → 原因: ${decision.reason}`);
      console.log(`  → 免费模型: ${decision.isFreeTier ? '是' : '否'}`);
      console.log(`  → 预估成本: $${decision.estimatedCost.toFixed(6)}`);
    } catch (error) {
      console.log(`  ✗ 错误: ${error.message}`);
    }
  }
} catch (error) {
  console.log(`✗ 路由引擎初始化失败: ${error.message}`);
  console.error(error);
}

console.log('\n✅ 测试完成！');
