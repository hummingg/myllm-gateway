const PII_DETECTION_ENABLED = process.env.PII_DETECTION_ENABLED === 'true';
const PII_DETECTION_TIMEOUT_MS = parseInt(process.env.PII_DETECTION_TIMEOUT_MS || '3000');
const OLLAMA_MODEL = 'qwen2.5:7b';

const SYSTEM_PROMPT = `你是一个隐私信息检测器。判断文本是否包含个人隐私信息（PII）。
PII包括：姓名、手机号、身份证号、家庭/工作地址、银行卡号、病历/诊断、邮箱、护照号、微信/支付宝账号。
只回答 YES 或 NO，不要解释。`;

export interface PiiResult {
  hasPii: boolean;
  skipped: boolean;
  latencyMs: number;
}

export class PiiDetector {
  private enabled: boolean;

  constructor(private ollamaBaseUrl: string, enabled: boolean = PII_DETECTION_ENABLED) {
    this.ollamaBaseUrl = ollamaBaseUrl.replace(/\/$/, '');
    this.enabled = enabled;
  }

  async detect(messages: Array<{ role: string; content: string }>): Promise<PiiResult> {
    const start = Date.now();

    // 如果 PII 检测未启用，直接返回无 PII
    if (!this.enabled) {
      return { hasPii: false, skipped: true, latencyMs: 0 };
    }
    const content = messages.map(m => m.content).join('\n').slice(0, 4000);

    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), PII_DETECTION_TIMEOUT_MS);

      const res = await fetch(`http://localhost:3000/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Skip-PII-Detection': 'true' },
        signal: controller.signal,
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `以下文本是否包含PII？只回答YES或NO。\n\n<text>\n${content}\n</text>` }
          ],
          temperature: 0,
          max_tokens: 5,
          stream: false
        })
      });

      clearTimeout(tid);

      if (!res.ok) {
        console.warn(`[PiiDetector] Ollama returned ${res.status}, failing open`);
        return { hasPii: false, skipped: true, latencyMs: Date.now() - start };
      }

      const data = await res.json() as any;
      const answer = (data?.choices?.[0]?.message?.content ?? '').trim().toUpperCase();
      return { hasPii: answer.startsWith('YES'), skipped: false, latencyMs: Date.now() - start };

    } catch (err: any) {
      const reason = err?.name === 'AbortError' ? 'timeout' : err?.message;
      console.warn(`[PiiDetector] Detection failed (${reason}), failing open`);
      return { hasPii: false, skipped: true, latencyMs: Date.now() - start };
    }
  }
}
