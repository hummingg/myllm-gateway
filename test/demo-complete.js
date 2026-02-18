#!/usr/bin/env node

/**
 * 重试机制完整演示
 * 展示智能故障转移和重试功能
 */

const BASE_URL = 'http://localhost:3000';

console.log('\n🎯 智能故障转移和重试机制 - 完整演示\n');
console.log('='.repeat(70));

async function demo1() {
  console.log('\n✅ 演示 1: 正常请求（第一次尝试成功）');
  console.log('-'.repeat(70));

  const start = Date.now();
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: '你好' }],
      max_tokens: 30
    })
  });

  const data = await response.json();
  const elapsed = Date.now() - start;

  console.log(`📊 结果: ${response.ok ? '✅ 成功' : '❌ 失败'}`);
  console.log(`🤖 模型: ${data.model || 'N/A'}`);
  console.log(`⏱️  耗时: ${elapsed}ms`);
  console.log(`💬 回复: ${data.choices?.[0]?.message?.content?.substring(0, 60) || data.error?.message}...`);
}

async function demo2() {
  console.log('\n🔄 演示 2: 自动路由 - 代码场景（智能选择模型）');
  console.log('-'.repeat(70));

  const start = Date.now();
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'auto',
      messages: [{ role: 'user', content: '写一个Python Hello World' }],
      max_tokens: 50
    })
  });

  const data = await response.json();
  const elapsed = Date.now() - start;

  console.log(`📊 结果: ${response.ok ? '✅ 成功' : '❌ 失败'}`);
  console.log(`🤖 选择的模型: ${data.model || 'N/A'}`);
  console.log(`⏱️  耗时: ${elapsed}ms`);

  if (data.error) {
    console.log(`⚠️  错误类型: ${data.error.type}`);
    console.log(`🔄 尝试次数: ${data.error.attempts || 1}`);
    if (data.error.errors) {
      console.log(`📋 失败记录:`);
      data.error.errors.forEach((e, i) => {
        console.log(`   ${i + 1}. ${e.provider}/${e.model} - ${e.type}: ${e.message}`);
      });
    }
  }
}

async function demo3() {
  console.log('\n🌊 演示 3: 流式响应（实时输出）');
  console.log('-'.repeat(70));

  const start = Date.now();
  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: '说一句话' }],
      stream: true
    })
  });

  if (response.ok) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;
    let content = '';

    console.log('💬 实时输出: ', { newline: false });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter(line => line.trim().startsWith('data:'));

      for (const line of lines) {
        if (line.includes('[DONE]')) continue;
        try {
          const json = JSON.parse(line.substring(5));
          if (json.choices?.[0]?.delta?.content) {
            const chunk = json.choices[0].delta.content;
            process.stdout.write(chunk);
            content += chunk;
            chunks++;
          }
        } catch (e) {}
      }
    }

    const elapsed = Date.now() - start;
    console.log(`\n📊 统计: ${chunks} 个数据块, 耗时 ${elapsed}ms`);
  } else {
    console.log('❌ 流式响应失败');
  }
}

async function demo4() {
  console.log('\n📈 演示 4: 查看系统状态');
  console.log('-'.repeat(70));

  // 查看可用模型
  const modelsRes = await fetch(`${BASE_URL}/v1/models`);
  const models = await modelsRes.json();
  console.log(`🤖 可用模型: ${models.data.length} 个`);

  // 查看统计信息
  const statsRes = await fetch(`${BASE_URL}/stats`);
  const stats = await statsRes.json();
  console.log(`📊 总请求数: ${stats.totalRequests}`);
  console.log(`✅ 成功率: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%`);
  console.log(`💰 总成本: $${stats.totalCost.toFixed(4)}`);
}

async function showLogs() {
  console.log('\n📋 服务器日志（最近的重试记录）');
  console.log('='.repeat(70));

  const { exec } = require('child_process');
  return new Promise((resolve) => {
    exec('tail -40 server.log | grep -E "重试管理器|初始路由|场景" | tail -15', (error, stdout) => {
      if (stdout) {
        console.log(stdout);
      }
      resolve();
    });
  });
}

async function runDemo() {
  try {
    await demo1();
    await new Promise(resolve => setTimeout(resolve, 800));

    await demo2();
    await new Promise(resolve => setTimeout(resolve, 800));

    await demo3();
    await new Promise(resolve => setTimeout(resolve, 800));

    await demo4();
    await new Promise(resolve => setTimeout(resolve, 800));

    await showLogs();

    console.log('\n' + '='.repeat(70));
    console.log('✅ 演示完成！');
    console.log('='.repeat(70));

    console.log('\n💡 重试机制特性:');
    console.log('   • 自动分类错误（可重试 vs 不可重试）');
    console.log('   • 智能重新路由（排除失败的模型）');
    console.log('   • 指数退避延迟（1s, 2s, 4s...）');
    console.log('   • 最大重试 3 次（可配置）');
    console.log('   • 详细的错误报告');
    console.log('   • 支持流式和非流式请求\n');

  } catch (error) {
    console.error('\n❌ 演示过程中出错:', error.message);
  }
}

runDemo();
