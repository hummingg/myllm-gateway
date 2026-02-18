/**
 * 测试重试和故障转移机制
 */

const BASE_URL = 'http://localhost:3000';

async function testRetry() {
  console.log('🧪 测试 1: 正常请求（无失败）');
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: '你好，请用一句话回复' }]
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✅ 测试 1 通过: 正常返回');
      console.log(`   模型: ${data.model}`);
      console.log(`   内容: ${data.choices[0].message.content.substring(0, 50)}...`);
    } else {
      console.log('❌ 测试 1 失败:', data.error);
    }
  } catch (error) {
    console.log('❌ 测试 1 异常:', error.message);
  }

  console.log('\n🧪 测试 2: 指定不存在的模型（测试重新路由）');
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nonexistent-model',
        messages: [{ role: 'user', content: '测试' }]
      })
    });

    const data = await response.json();
    if (response.ok) {
      console.log('✅ 测试 2 通过: 自动切换到可用模型');
      console.log(`   模型: ${data.model}`);
    } else {
      console.log('⚠️  测试 2 返回错误（预期）:', data.error.message);
      if (data.error.attempts) {
        console.log(`   尝试次数: ${data.error.attempts}`);
        console.log(`   错误列表:`, data.error.errors);
      }
    }
  } catch (error) {
    console.log('❌ 测试 2 异常:', error.message);
  }

  console.log('\n🧪 测试 3: 流式响应');
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: '数到5' }],
        stream: true
      })
    });

    if (response.ok) {
      console.log('✅ 测试 3 通过: 流式响应开始');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.trim().startsWith('data:'));
        chunks += lines.length;
      }

      console.log(`   接收到 ${chunks} 个数据块`);
    } else {
      console.log('❌ 测试 3 失败');
    }
  } catch (error) {
    console.log('❌ 测试 3 异常:', error.message);
  }

  console.log('\n✅ 所有测试完成');
}

// 运行测试
testRetry().catch(console.error);
