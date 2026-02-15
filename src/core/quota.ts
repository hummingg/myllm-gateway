import { FreeTierConfig, QuotaTracker } from '../types/quota.js';
import { ModelConfig, ProviderConfig } from '../types/config.js';
import fs from 'fs/promises';
import path from 'path';

export class QuotaManager {
  private freeTiers: Map<string, FreeTierConfig> = new Map();
  private trackers: Map<string, QuotaTracker> = new Map();
  private storagePath: string;

  constructor(storageDir: string = './data') {
    this.storagePath = path.join(storageDir, 'quota.json');
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
      await this.loadQuotaData();
    } catch (error) {
      console.log('初始化额度存储失败，将使用内存存储');
    }
  }

  // 注册免费额度模型
  registerFreeTier(config: FreeTierConfig): void {
    const key = `${config.provider}:${config.model}`;
    
    // 检查是否需要重置额度
    const existing = this.freeTiers.get(key);
    if (existing) {
      const shouldReset = this.checkResetNeeded(existing);
      if (shouldReset) {
        config.usedQuota = 0;
        config.lastResetAt = new Date();
      }
    }
    
    this.freeTiers.set(key, config);
    
    // 初始化追踪器
    this.trackers.set(key, {
      provider: config.provider,
      model: config.model,
      remainingTokens: config.totalQuota - config.usedQuota,
      lastCheckedAt: new Date()
    });
    
    console.log(`✅ 注册免费额度: ${key} (${config.totalQuota} tokens)`);
  }

  // 检查是否需要重置额度
  private checkResetNeeded(config: FreeTierConfig): boolean {
    const now = new Date();
    const lastReset = config.lastResetAt;
    
    switch (config.resetPeriod) {
      case 'daily':
        return now.getDate() !== lastReset.getDate() ||
               now.getMonth() !== lastReset.getMonth();
      case 'weekly':
        const weekDiff = Math.floor((now.getTime() - lastReset.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return weekDiff >= 1;
      case 'monthly':
        return now.getMonth() !== lastReset.getMonth() ||
               now.getFullYear() !== lastReset.getFullYear();
      case 'never':
        return false;
      default:
        return false;
    }
  }

  // 获取可用免费额度模型（按过期时间排序，先过期的优先）
  getAvailableFreeTiers(requiredCapability?: string): Array<{ 
    provider: string; 
    model: string; 
    remaining: number;
    expiresAt: Date;
  }> {
    const available: Array<{ 
      provider: string; 
      model: string; 
      remaining: number; 
      priority: number;
      expiresAt: Date;
    }> = [];
    
    for (const [key, config] of this.freeTiers) {
      if (!config.enabled) continue;
      
      const tracker = this.trackers.get(key);
      if (!tracker || tracker.remainingTokens <= 0) continue;
      
      // 检查是否需要重置
      if (this.checkResetNeeded(config)) {
        this.resetQuota(key);
        continue;
      }
      
      const expiresAt = this.calculateNextReset(config);
      
      available.push({
        provider: config.provider,
        model: config.model,
        remaining: tracker.remainingTokens,
        priority: config.priority,
        expiresAt
      });
    }
    
    // 先按过期时间排序（先过期的优先），再按优先级排序
    return available
      .sort((a, b) => {
        // 首先比较过期时间，先过期的排在前面
        const timeDiff = a.expiresAt.getTime() - b.expiresAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        // 过期时间相同，按优先级排序
        return a.priority - b.priority;
      })
      .map(({ provider, model, remaining, expiresAt }) => ({
        provider, model, remaining, expiresAt
      }));
  }

  // 检查模型是否有免费额度
  hasFreeTier(provider: string, model: string): boolean {
    const key = `${provider}:${model}`;
    const config = this.freeTiers.get(key);
    const tracker = this.trackers.get(key);
    
    if (!config || !config.enabled || !tracker) return false;
    
    // 检查是否需要重置
    if (this.checkResetNeeded(config)) {
      this.resetQuota(key);
      return true;
    }
    
    return tracker.remainingTokens > 0;
  }

  // 获取剩余额度
  getRemainingQuota(provider: string, model: string): number {
    const key = `${provider}:${model}`;
    const tracker = this.trackers.get(key);
    
    if (!tracker) return 0;
    
    // 检查是否需要重置
    const config = this.freeTiers.get(key);
    if (config && this.checkResetNeeded(config)) {
      this.resetQuota(key);
      return config.totalQuota;
    }
    
    return tracker.remainingTokens;
  }

  // 使用额度
  async useQuota(provider: string, model: string, tokens: number): Promise<boolean> {
    const key = `${provider}:${model}`;
    const tracker = this.trackers.get(key);
    const config = this.freeTiers.get(key);
    
    if (!tracker || !config) return false;
    
    // 检查是否需要重置
    if (this.checkResetNeeded(config)) {
      this.resetQuota(key);
    }
    
    // 检查剩余额度
    if (tracker.remainingTokens < tokens) {
      console.log(`⚠️  额度不足: ${key} (剩余: ${tracker.remainingTokens}, 需要: ${tokens})`);
      return false;
    }
    
    // 扣除额度
    tracker.remainingTokens -= tokens;
    config.usedQuota += tokens;
    tracker.lastCheckedAt = new Date();
    
    console.log(`💰 使用额度: ${key} (-${tokens} tokens, 剩余: ${tracker.remainingTokens})`);
    
    // 持久化存储
    await this.saveQuotaData();
    
    return true;
  }

  // 重置额度
  private resetQuota(key: string): void {
    const config = this.freeTiers.get(key);
    const tracker = this.trackers.get(key);
    
    if (!config || !tracker) return;
    
    config.usedQuota = 0;
    config.lastResetAt = new Date();
    tracker.remainingTokens = config.totalQuota;
    tracker.lastCheckedAt = new Date();
    
    console.log(`🔄 额度已重置: ${key} (${config.totalQuota} tokens)`);
  }

  // 手动设置额度（用于从 API 获取最新额度）
  async updateQuota(provider: string, model: string, remainingTokens: number): Promise<void> {
    const key = `${provider}:${model}`;
    const tracker = this.trackers.get(key);
    
    if (tracker) {
      tracker.remainingTokens = remainingTokens;
      tracker.lastCheckedAt = new Date();
      await this.saveQuotaData();
    }
  }

  // 获取所有额度状态
  getAllQuotaStatus(): Array<{
    provider: string;
    model: string;
    total: number;
    used: number;
    remaining: number;
    resetPeriod: string;
    nextReset: Date;
  }> {
    const status = [];
    
    for (const [key, config] of this.freeTiers) {
      const tracker = this.trackers.get(key);
      if (!tracker) continue;
      
      // 计算下次重置时间
      const nextReset = this.calculateNextReset(config);
      
      status.push({
        provider: config.provider,
        model: config.model,
        total: config.totalQuota,
        used: config.usedQuota,
        remaining: tracker.remainingTokens,
        resetPeriod: config.resetPeriod,
        nextReset
      });
    }
    
    return status;
  }

  // 计算下次重置时间
  private calculateNextReset(config: FreeTierConfig): Date {
    const now = new Date();
    const lastReset = new Date(config.lastResetAt);
    
    switch (config.resetPeriod) {
      case 'daily':
        return new Date(lastReset.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(lastReset.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly': {
        const nextMonth = new Date(lastReset);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      }
      case 'never':
        return new Date(9999, 11, 31);
      default:
        return now;
    }
  }

  // 保存额度数据到文件
  private async saveQuotaData(): Promise<void> {
    try {
      const data = {
        freeTiers: Array.from(this.freeTiers.entries()),
        trackers: Array.from(this.trackers.entries()),
        savedAt: new Date().toISOString()
      };
      await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('保存额度数据失败:', error);
    }
  }

  // 从文件加载额度数据
  private async loadQuotaData(): Promise<void> {
    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const parsed = JSON.parse(data);

      if (parsed.freeTiers) {
        // 转换日期字符串为 Date 对象
        this.freeTiers = new Map(
          parsed.freeTiers.map(([key, config]: [string, any]) => [
            key,
            {
              ...config,
              lastResetAt: new Date(config.lastResetAt)
            }
          ])
        );
      }
      if (parsed.trackers) {
        // 转换日期字符串为 Date 对象
        this.trackers = new Map(
          parsed.trackers.map(([key, tracker]: [string, any]) => [
            key,
            {
              ...tracker,
              lastCheckedAt: new Date(tracker.lastCheckedAt),
              expiresAt: tracker.expiresAt ? new Date(tracker.expiresAt) : undefined
            }
          ])
        );
      }

      console.log(`📊 已加载额度数据`);
    } catch (error) {
      // 文件不存在，使用空数据
      console.log('未找到额度数据文件，将创建新文件');
    }
  }

  // 获取额度预警（低于阈值或即将过期）
  getLowQuotaAlerts(
    threshold: number = 1000,
    expiryWarningHours: number = 24
  ): Array<{
    provider: string;
    model: string;
    remaining: number;
    reason: 'low_quota' | 'expiring_soon';
    message: string;
  }> {
    const alerts: Array<{
      provider: string;
      model: string;
      remaining: number;
      reason: 'low_quota' | 'expiring_soon';
      message: string;
    }> = [];
    
    for (const [key, tracker] of this.trackers) {
      const [provider, model] = key.split(':');
      const config = this.freeTiers.get(key);
      
      if (!config) continue;
      
      // 检查额度不足
      if (tracker.remainingTokens < threshold) {
        alerts.push({
          provider,
          model,
          remaining: tracker.remainingTokens,
          reason: 'low_quota',
          message: `额度不足: 仅剩 ${tracker.remainingTokens.toLocaleString()} tokens`
        });
        continue;
      }
      
      // 检查即将过期
      const nextReset = this.calculateNextReset(config);
      const hoursUntilExpiry = Math.floor((nextReset.getTime() - Date.now()) / (1000 * 60 * 60));
      
      if (hoursUntilExpiry <= expiryWarningHours && tracker.remainingTokens > 0) {
        alerts.push({
          provider,
          model,
          remaining: tracker.remainingTokens,
          reason: 'expiring_soon',
          message: `即将过期: ${hoursUntilExpiry}小时后重置，剩余 ${tracker.remainingTokens.toLocaleString()} tokens 未使用，建议尽快使用！`
        });
      }
    }
    
    return alerts;
  }
}
