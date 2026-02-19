import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface CacheEntry {
  id: string;
  embedding: number[];
  messages: Array<{ role: string; content: string }>;
  model: string;
  response: {
    content: string;
    model: string;
    usage?: any;
  };
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
}

export interface SemanticCacheConfig {
  enabled: boolean;
  similarityThreshold: number;  // 默认 0.95
  maxEntries: number;           // 默认 1000
  ttlMs: number;                // 默认 1小时
  dataDir: string;              // 缓存文件目录
  embeddingModel: string;       // 使用的 embedding 模型
  embeddingBaseUrl: string;     // embedding API 地址
  embeddingApiKey: string;      // API Key
}

export class SemanticCache {
  private config: SemanticCacheConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private dataFile: string;
  private dirty: boolean = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<SemanticCacheConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      similarityThreshold: config.similarityThreshold ?? 0.95,
      maxEntries: config.maxEntries ?? 1000,
      ttlMs: config.ttlMs ?? 3600 * 1000, // 1小时
      dataDir: config.dataDir ?? './data/cache',
      embeddingModel: config.embeddingModel ?? 'text-embedding-3-small',
      embeddingBaseUrl: config.embeddingBaseUrl ?? 'https://api.openai.com/v1',
      embeddingApiKey: config.embeddingApiKey ?? ''
    };

    this.dataFile = path.join(this.config.dataDir, 'semantic-cache.json');
    
    if (this.config.enabled) {
      this.loadCache();
    }
  }

  /**
   * 获取 embedding 向量
   */
  private async getEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.config.embeddingBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.embeddingApiKey}`
      },
      body: JSON.stringify({
        model: this.config.embeddingModel,
        input: text,
        encoding_format: 'float'
      })
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = await response.json() as any;
    return data.data[0].embedding;
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions mismatch');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 生成缓存键（基于消息内容）
   */
  private generateKey(messages: Array<{ role: string; content: string }>): string {
    const content = messages.map(m => `${m.role}:${m.content}`).join('\n');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 查找最相似的缓存条目
   */
  private findMostSimilar(queryEmbedding: number[]): { entry: CacheEntry; similarity: number } | null {
    let bestMatch: { entry: CacheEntry; similarity: number } | null = null;

    for (const entry of this.cache.values()) {
      // 检查是否过期
      if (Date.now() - entry.createdAt > this.config.ttlMs) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);
      
      if (similarity >= this.config.similarityThreshold) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { entry, similarity };
        }
      }
    }

    return bestMatch;
  }

  /**
   * 获取精确匹配的缓存（无需 embedding）
   */
  private getExactMatch(
    messages: Array<{ role: string; content: string }>,
    model: string
  ): CacheEntry | null {
    const key = this.generateKey(messages);
    const entry = this.cache.get(key);
    
    if (entry && entry.model === model) {
      // 检查是否过期
      if (Date.now() - entry.createdAt <= this.config.ttlMs) {
        return entry;
      }
    }
    
    return null;
  }

  /**
   * 获取缓存
   */
  async get(
    messages: Array<{ role: string; content: string }>,
    model: string
  ): Promise<{ hit: boolean; entry?: CacheEntry; similarity?: number; exactMatch?: boolean }> {
    if (!this.config.enabled) {
      return { hit: false };
    }

    try {
      // 清理过期条目
      this.cleanupExpired();

      // 首先尝试精确匹配（无需 embedding）
      const exactMatch = this.getExactMatch(messages, model);
      if (exactMatch) {
        exactMatch.accessCount++;
        exactMatch.lastAccessedAt = Date.now();
        this.dirty = true;
        this.scheduleSave();
        
        return {
          hit: true,
          entry: exactMatch,
          similarity: 1.0,
          exactMatch: true
        };
      }

      // 尝试语义匹配（需要 embedding）
      if (this.config.embeddingApiKey && this.config.embeddingApiKey !== 'sk-your-openai-key-here') {
        const queryText = messages.map(m => m.content).join('\n');
        const queryEmbedding = await this.getEmbedding(queryText);
        const match = this.findMostSimilar(queryEmbedding);

        if (match) {
          match.entry.accessCount++;
          match.entry.lastAccessedAt = Date.now();
          this.dirty = true;
          this.scheduleSave();

          return {
            hit: true,
            entry: match.entry,
            similarity: match.similarity,
            exactMatch: false
          };
        }
      }

      return { hit: false };
    } catch (error) {
      console.warn('[SemanticCache] Get failed:', error);
      return { hit: false };
    }
  }

  /**
   * 设置缓存
   */
  async set(
    messages: Array<{ role: string; content: string }>,
    model: string,
    response: { content: string; model: string; usage?: any }
  ): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const id = this.generateKey(messages);
      
      // 检查是否已存在精确匹配
      const existing = this.cache.get(id);
      if (existing) {
        existing.response = response;
        existing.lastAccessedAt = Date.now();
        this.dirty = true;
        this.scheduleSave();
        return;
      }

      // 尝试获取 embedding（如果配置有效）
      let embedding: number[] | undefined;
      if (this.config.embeddingApiKey && this.config.embeddingApiKey !== 'sk-your-openai-key-here') {
        try {
          const text = messages.map(m => m.content).join('\n');
          embedding = await this.getEmbedding(text);
          
          // 检查语义相似度
          const similar = this.findMostSimilar(embedding);
          if (similar && similar.similarity > 0.98) {
            similar.entry.response = response;
            similar.entry.lastAccessedAt = Date.now();
            this.dirty = true;
            this.scheduleSave();
            return;
          }
        } catch (err) {
          console.warn('[SemanticCache] Embedding failed, using exact match only');
        }
      }

      // 创建新条目
      const entry: CacheEntry = {
        id,
        embedding: embedding || [],
        messages: [...messages],
        model,
        response,
        createdAt: Date.now(),
        accessCount: 1,
        lastAccessedAt: Date.now()
      };

      // 检查容量限制
      if (this.cache.size >= this.config.maxEntries) {
        this.evictLRU();
      }

      this.cache.set(id, entry);
      this.dirty = true;
      this.scheduleSave();

      console.log(`[SemanticCache] Cached: ${id.slice(0, 8)}... (${this.cache.size} entries)`);
    } catch (error) {
      console.warn('[SemanticCache] Set failed:', error);
    }
  }

  /**
   * 清理过期条目
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;

    for (const [id, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.config.ttlMs) {
        this.cache.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[SemanticCache] Cleaned ${removed} expired entries`);
      this.dirty = true;
      this.scheduleSave();
    }
  }

  /**
   * LRU 淘汰
   */
  private evictLRU(): void {
    let oldest: CacheEntry | null = null;
    let oldestId: string | null = null;

    for (const [id, entry] of this.cache.entries()) {
      if (!oldest || entry.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = entry;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.cache.delete(oldestId);
      console.log(`[SemanticCache] Evicted LRU: ${oldestId.slice(0, 8)}...`);
    }
  }

  /**
   * 加载缓存
   */
  private async loadCache(): Promise<void> {
    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });
      
      const data = await fs.readFile(this.dataFile, 'utf-8');
      const entries: CacheEntry[] = JSON.parse(data);

      for (const entry of entries) {
        // 跳过过期条目
        if (Date.now() - entry.createdAt <= this.config.ttlMs) {
          this.cache.set(entry.id, entry);
        }
      }

      console.log(`[SemanticCache] Loaded ${this.cache.size} entries from disk`);
    } catch (error) {
      // 文件不存在是正常的
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[SemanticCache] Load failed:', error);
      }
    }
  }

  /**
   * 保存缓存
   */
  private async saveCache(): Promise<void> {
    if (!this.dirty) return;

    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });

      const entries = Array.from(this.cache.values());
      await fs.writeFile(
        this.dataFile,
        JSON.stringify(entries, null, 2),
        'utf-8'
      );

      this.dirty = false;
      console.log(`[SemanticCache] Saved ${entries.length} entries to disk`);
    } catch (error) {
      console.error('[SemanticCache] Save failed:', error);
    }
  }

  /**
   * 延迟保存（防抖）
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveCache();
    }, 5000); // 5秒后保存
  }

  /**
   * 手动保存（用于优雅关闭）
   */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.saveCache();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    enabled: boolean;
    totalEntries: number;
    totalAccesses: number;
    hitRate?: number;
  } {
    const entries = Array.from(this.cache.values());
    const totalAccesses = entries.reduce((sum, e) => sum + e.accessCount, 0);

    return {
      enabled: this.config.enabled,
      totalEntries: this.cache.size,
      totalAccesses
    };
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.dirty = true;
    await this.saveCache();
    console.log('[SemanticCache] Cleared all entries');
  }
}
