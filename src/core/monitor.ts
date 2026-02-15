import winston from 'winston';

// 请求记录
export interface RequestLog {
  id: string;
  timestamp: Date;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  latency: number;
  status: 'success' | 'failure' | 'cached';
  routingReason: string;
  userAgent?: string;
  error?: string;
}

// 使用统计
export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  modelDistribution: Record<string, number>;
  providerDistribution: Record<string, number>;
  hourlyRequests: Record<number, number>;
}

export class Monitor {
  private logger: winston.Logger;
  private requests: RequestLog[] = [];
  private maxRetention: number;

  constructor(logLevel: string = 'info', retentionDays: number = 30) {
    this.maxRetention = retentionDays * 24 * 60 * 60 * 1000;
    
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({ filename: 'logs/gateway.log' })
      ]
    });
  }

  // 记录请求
  logRequest(log: RequestLog): void {
    this.requests.push(log);
    this.cleanupOldLogs();
    
    this.logger.info('Request completed', {
      id: log.id,
      model: log.model,
      provider: log.provider,
      cost: log.cost,
      latency: `${log.latency}ms`,
      status: log.status
    });
  }

  // 记录错误
  logError(error: Error, context?: Record<string, any>): void {
    this.logger.error('Error occurred', {
      message: error.message,
      stack: error.stack,
      ...context
    });
  }

  // 获取统计数据
  getStats(timeRange?: { start: Date; end: Date }): UsageStats {
    const filtered = timeRange 
      ? this.requests.filter(r => 
          r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
        )
      : this.requests;

    const successful = filtered.filter(r => r.status === 'success');
    
    const stats: UsageStats = {
      totalRequests: filtered.length,
      totalTokens: filtered.reduce((sum, r) => sum + r.inputTokens + r.outputTokens, 0),
      totalCost: filtered.reduce((sum, r) => sum + r.cost, 0),
      averageLatency: successful.length > 0
        ? successful.reduce((sum, r) => sum + r.latency, 0) / successful.length
        : 0,
      modelDistribution: {},
      providerDistribution: {},
      hourlyRequests: {}
    };

    // 模型分布
    filtered.forEach(r => {
      stats.modelDistribution[r.model] = (stats.modelDistribution[r.model] || 0) + 1;
    });

    // 供应商分布
    filtered.forEach(r => {
      stats.providerDistribution[r.provider] = (stats.providerDistribution[r.provider] || 0) + 1;
    });

    // 小时分布
    filtered.forEach(r => {
      const hour = r.timestamp.getHours();
      stats.hourlyRequests[hour] = (stats.hourlyRequests[hour] || 0) + 1;
    });

    return stats;
  }

  // 获取实时指标
  getRealtimeMetrics() {
    const last24h = this.requests.filter(r => 
      r.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    return {
      requests24h: last24h.length,
      cost24h: last24h.reduce((sum, r) => sum + r.cost, 0),
      averageLatency24h: last24h.length > 0
        ? last24h.reduce((sum, r) => sum + r.latency, 0) / last24h.length
        : 0,
      topModels: Object.entries(
        last24h.reduce((acc, r) => {
          acc[r.model] = (acc[r.model] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }

  // 导出使用报告
  generateReport(period: 'day' | 'week' | 'month'): string {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const stats = this.getStats({ start: startDate, end: now });
    
    return `
## LLM Gateway Usage Report (${period})

### 概览
- 总请求数: ${stats.totalRequests}
- 总Token数: ${stats.totalTokens.toLocaleString()}
- 总成本: $${stats.totalCost.toFixed(4)}
- 平均延迟: ${stats.averageLatency.toFixed(0)}ms

### 模型使用分布
${Object.entries(stats.modelDistribution)
  .map(([model, count]) => `- ${model}: ${count} 次 (${(count/stats.totalRequests*100).toFixed(1)}%)`)
  .join('\n')}

### 供应商分布
${Object.entries(stats.providerDistribution)
  .map(([provider, count]) => `- ${provider}: ${count} 次`)
  .join('\n')}
    `.trim();
  }

  // 清理旧日志
  private cleanupOldLogs(): void {
    const cutoff = Date.now() - this.maxRetention;
    this.requests = this.requests.filter(r => r.timestamp.getTime() > cutoff);
  }
}
