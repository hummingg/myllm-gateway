import winston from 'winston';
import fs from 'fs';
import path from 'path';

// 请求记录（基础信息，用于统计）
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

// 完整请求日志（包含请求/响应体）
export interface FullRequestLog extends RequestLog {
  request: {
    messages: any[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    [key: string]: any;
  };
  response: {
    content: string;
    finishReason?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  };
  routing: {
    requestedModel: string;
    selectedModel: string;
    selectedProvider: string;
    reason: string;
    isFreeTier: boolean;
    estimatedCost: number;
    fallbackModels: string[];
  };
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
  private logsDir: string;

  constructor(logLevel: string = 'info', retentionDays: number = 30, logsDir: string = './logs/requests') {
    this.maxRetention = retentionDays * 24 * 60 * 60 * 1000;
    this.logsDir = logsDir;

    // 确保日志目录存在
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

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

    // 从文件恢复近24小时的请求记录
    this.loadRecentLogs();
  }

  private loadRecentLogs(): void {
    try {
      const now = new Date();
      const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      // 可能跨两天，取今天和昨天的目录
      const dates = [
        since.toISOString().split('T')[0],
        now.toISOString().split('T')[0]
      ].filter((v, i, a) => a.indexOf(v) === i);

      for (const dateStr of dates) {
        const dayDir = path.join(this.logsDir, dateStr);
        if (!fs.existsSync(dayDir)) continue;
        const files = fs.readdirSync(dayDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const raw = JSON.parse(fs.readFileSync(path.join(dayDir, file), 'utf-8')) as FullRequestLog;
            const ts = new Date(raw.timestamp);
            if (ts >= since) {
              this.requests.push({
                id: raw.id,
                timestamp: ts,
                model: raw.model,
                provider: raw.provider,
                inputTokens: raw.inputTokens,
                outputTokens: raw.outputTokens,
                cost: raw.cost,
                latency: raw.latency,
                status: raw.status,
                routingReason: raw.routingReason,
                userAgent: raw.userAgent,
                error: raw.error
              });
            }
          } catch (_e) { /* 跳过损坏的文件 */ }
        }
      }
    } catch (_e) { /* 加载失败不影响启动 */ }
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

  // 保存完整请求日志到文件
  saveFullRequestLog(log: FullRequestLog): void {
    try {
      // 按日期组织目录：logs/requests/YYYY-MM-DD/
      const date = new Date(log.timestamp);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayDir = path.join(this.logsDir, dateStr);

      // 确保日期目录存在
      if (!fs.existsSync(dayDir)) {
        fs.mkdirSync(dayDir, { recursive: true });
      }

      // 生成时间前缀：时_分_秒_毫秒
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
      const timePrefix = `${hours}_${minutes}_${seconds}_${milliseconds}`;

      // 保存完整日志：时_分_秒_毫秒_requestId.json
      const logFile = path.join(dayDir, `${timePrefix}_${log.id}.json`);
      fs.writeFileSync(logFile, JSON.stringify(log, null, 2), 'utf-8');

      this.logger.debug(`Full request log saved: ${logFile}`);
    } catch (error: any) {
      this.logger.error('Failed to save full request log', {
        requestId: log.id,
        error: error.message
      });
    }
  }

  // 获取完整请求日志
  getFullRequestLog(requestId: string, date?: string): FullRequestLog | null {
    try {
      // 如果提供了日期，直接查找
      if (date) {
        const dayDir = path.join(this.logsDir, date);
        if (fs.existsSync(dayDir)) {
          // 查找匹配的文件：*_requestId.json
          const files = fs.readdirSync(dayDir);
          const matchedFile = files.find(f => f.endsWith(`_${requestId}.json`));
          if (matchedFile) {
            const content = fs.readFileSync(path.join(dayDir, matchedFile), 'utf-8');
            return JSON.parse(content);
          }
        }
        return null;
      }

      // 否则遍历最近的目录查找
      const dirs = fs.readdirSync(this.logsDir)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .reverse()
        .slice(0, 7); // 只查找最近7天

      for (const dir of dirs) {
        const dayDir = path.join(this.logsDir, dir);
        const files = fs.readdirSync(dayDir);
        const matchedFile = files.find(f => f.endsWith(`_${requestId}.json`));
        if (matchedFile) {
          const content = fs.readFileSync(path.join(dayDir, matchedFile), 'utf-8');
          return JSON.parse(content);
        }
      }

      return null;
    } catch (error: any) {
      this.logger.error('Failed to read full request log', {
        requestId,
        error: error.message
      });
      return null;
    }
  }

  // 获取某天的所有请求日志
  getRequestLogsByDate(date: string): FullRequestLog[] {
    try {
      const dayDir = path.join(this.logsDir, date);
      if (!fs.existsSync(dayDir)) {
        return [];
      }

      const files = fs.readdirSync(dayDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse(); // 最新的在前

      const logs: FullRequestLog[] = [];
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(dayDir, file), 'utf-8');
          logs.push(JSON.parse(content));
        } catch (error) {
          // 跳过损坏的文件
          continue;
        }
      }

      return logs;
    } catch (error: any) {
      this.logger.error('Failed to read request logs by date', {
        date,
        error: error.message
      });
      return [];
    }
  }

  // 获取最近的请求日志
  getRecentRequestLogs(limit: number = 50): FullRequestLog[] {
    try {
      const dirs = fs.readdirSync(this.logsDir)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .reverse()
        .slice(0, 7); // 最近7天

      const logs: FullRequestLog[] = [];

      for (const dir of dirs) {
        if (logs.length >= limit) break;

        const dayLogs = this.getRequestLogsByDate(dir);
        logs.push(...dayLogs.slice(0, limit - logs.length));
      }

      return logs;
    } catch (error: any) {
      this.logger.error('Failed to read recent request logs', {
        error: error.message
      });
      return [];
    }
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
