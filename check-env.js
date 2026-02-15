#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 检查环境变量配置\n');

const providers = [
  { name: 'OpenAI', key: 'OPENAI_API_KEY', prefix: 'sk-' },
  { name: 'Anthropic', key: 'ANTHROPIC_API_KEY', prefix: 'sk-ant-' },
  { name: 'Groq', key: 'GROQ_API_KEY', prefix: 'gsk_' },
  { name: 'SiliconFlow', key: 'SILICONFLOW_API_KEY', prefix: 'sk-' },
  { name: 'Moonshot', key: 'MOONSHOT_API_KEY', prefix: 'sk-' }
];

let configuredCount = 0;

providers.forEach(provider => {
  const value = process.env[provider.key];
  const isConfigured = value && value !== `${provider.prefix}your-${provider.name.toLowerCase()}-key-here` && !value.includes('your-');
  
  if (isConfigured) {
    console.log(`✅ ${provider.name.padEnd(15)} - 已配置`);
    configuredCount++;
  } else {
    console.log(`❌ ${provider.name.padEnd(15)} - 未配置`);
  }
});

console.log(`\n📊 已配置供应商: ${configuredCount}/${providers.length}`);

if (configuredCount === 0) {
  console.log('\n⚠️  警告: 没有配置任何 API key！');
  console.log('请编辑 .env 文件，填入至少一个供应商的 API key。');
  console.log('\n推荐先配置免费供应商:');
  console.log('  - Groq: https://console.groq.com');
  console.log('  - SiliconFlow: https://cloud.siliconflow.cn');
} else {
  console.log('\n✅ 配置完成！可以启动服务了。');
}
