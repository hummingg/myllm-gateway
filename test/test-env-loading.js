#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();

import { defaultConfig } from './dist/config/default.js';

console.log('🔍 检查供应商配置\n');

defaultConfig.providers.forEach(p => {
  console.log(`${p.name}:`);
  console.log(`  enabled: ${p.enabled}`);
  console.log(`  apiKey exists: ${!!p.apiKey}`);
  console.log(`  apiKey value: ${p.apiKey ? p.apiKey.substring(0, 10) + '...' : 'none'}`);
  console.log('');
});
