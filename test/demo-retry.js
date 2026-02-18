#!/usr/bin/env node

/**
 * 重试机制演示和测试
 */

const BASE_URL = 'http://localhost:3000';

console.log('🚀 重试机制演示\n');
console.log('=' .repeat(60));

async function test1() {
  console.log('\n📝 测试 1: 正常请求 - 验证重试管理器集成');
  console.log('-'.repeat(60));

  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: '用一句话介绍自己' }],
      max_tokens: 50
    })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 状态: 成功');
    console.log(`📊 模型: ${data.model}`);
    console.log(`💬 回复: ${data.choices[0].message.content.substring(0, 80)}...`);
    console.log(`📈 Token: ${data.usage.total_tokens}`);
  } else {
    console.log('❌ 状态: 失败');
    console.log(`⚠️  错误: ${data.error.message}`);
    if (data.error.attempts) {
      console.log(`🔄 尝试次数: ${data.error.attempts}`);
    }
  }
}

async function test2() {
  console.log('\n📝 测试 2: 自动路由 - 代码场景');
  console.log('-'.repeat(60));

  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'auto',
      messages: [{ role: 'user', content: '写一个快速排序算法' }],
      max_tokens: 100
    })
  });

  const data = await response.json();

  if (response.ok) {
    console.log('✅ 状态: 成功');
    console.log(`📊 选择的模型: ${data.model}`);
    console.log(`💬 回复长度: ${data.choices[0].message.content.length} 字符`);
  } else {
    console.log('❌ 状态: 失败');
    console.log(`⚠️  错误: ${data.error.message}`);
  }
}

async function test3() {
  console.log('\n📝 测试 3: 流式响应');
  console.log('-'.repeat(60));

  const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'moonshot-v1-8k',
      messages: [{ role: 'user', content: '数到3' }],
      stream: true
    })
  });

  if (response.ok) {
    console.log('✅ 状态: 流式响应开始');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunks = 0;
    let content = '';

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
            content += json.choices[0].delta.content;
            chunks++;
          }
        } catch (e) {}
      }
    }

    console.log(`📊 接收到 ${chunks} 个数据块`);
    console.log(`💬 完整内容: ${content}`);
  } else {
    console.log('❌ 状态: 失败');
  }
}

async function test4() {
  console.log('\n📝 测试 4: 查看可用模型');
  console.log('-'.repeat(60));

  const response = await fetch(`${BASE_URL}/v1/models`);
  const data = await response.json();

  console.log(`✅ 共有 ${data.data.length} 个可用模型`);
  console.log('前 5 个模型:');
  data.data.slice(0, 5).forEach(model => {
    console.log(`   • ${model.id}`);
  });
}

async function test5() {
  console.log('\n📝 测试 5: 查看免费额度');
  console.log('-'.repeat(60));

  const response = await fetch(`${BASE_URL}/quota`);
  const data = await response.json();

  console.log(`✅ 共有 ${data.freeTiers.length} 个免费额度`);
  console.log('前 3 个额度:');
  data.freeTiers.slice(0, 3).forEach(tier => {
    console.log(`   • ${tier.provider}:${tier.model}`);
    console.log(`     剩余: ${tier.remaining.toLocaleString()} tokens`);
  });
}

async function showServerLogs() {
  console.log('\n📋 最近的服务器日志（重试相关）:');
  console.log('='.repeat(60));

  const { exec } = require('child_process');
  exec('tail -30 server.log | grep -E "重试管理器|初始路由" | tail -10', (error, stdout) => {
    if (stdout) {
      console.log(stdout);
    }
  });
}

async function runAllTests() {
  try {
    await test1();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test2();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test3();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test4();
    await new Promise(resolve => setTimeout(resolve, 500));

    await test5();
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试完成！');
    console.log('='.repeat(60));

    showServerLogs();

  } catch (error) {
    console.error('\n❌ 测试过程中出错:', error.message);
  }
}

runAllTests();
