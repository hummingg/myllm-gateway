import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ModelConfig, ProviderConfig } from '../types/config.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected models: ModelConfig[];

  constructor(config: ProviderConfig, models: ModelConfig[]) {
    this.config = config;
    this.models = models.filter(m => config.models.includes(m.id));
  }

  abstract chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  abstract streamChatCompletion(
    request: ChatCompletionRequest, 
    onChunk: (chunk: string) => void
  ): Promise<ChatCompletionResponse>;

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  supportsModel(modelId: string): boolean {
    return this.models.some(m => m.id === modelId);
  }

  getModels(): ModelConfig[] {
    return this.models;
  }
}

// OpenAI 适配器
export class OpenAIProvider extends BaseProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as any,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false
    });

    const choice = response.choices[0];
    return {
      id: response.id,
      model: response.model,
      content: choice.message.content || '',
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      },
      finishReason: choice.finish_reason || 'stop'
    };
  }

  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatCompletionResponse> {
    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages: request.messages as any,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true
    });

    let fullContent = '';
    let finalResponse: any;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
      finalResponse = chunk;
    }

    return {
      id: finalResponse?.id || '',
      model: request.model,
      content: fullContent,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      },
      finishReason: 'stop'
    };
  }
}

// Anthropic 适配器
export class AnthropicProvider extends BaseProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.apiKey = config.apiKey;
    console.log(`[Anthropic] 初始化 - baseUrl: ${this.baseUrl}`);
    console.log(`[Anthropic] 初始化 - apiKey (前10位): ${this.apiKey.substring(0, 10)}...`);
    console.log(`[Anthropic] 初始化 - apiKey 长度: ${this.apiKey.length}`);
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    const url = `${this.baseUrl}/v1/messages`;
    console.log(`[Anthropic] 请求 URL: ${url}`);
    console.log(`[Anthropic] API Key (前10位): ${this.apiKey.substring(0, 10)}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: request.model,
        messages: conversationMessages,
        system: systemMessage?.content,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature
      })
    });

    console.log(`[Anthropic] 响应状态: ${response.status}`);

    if (!response.ok) {
      const error = await response.text();
      console.log(`[Anthropic] 错误响应: ${error}`);
      throw new Error(`${response.status} ${error || response.statusText}`);
    }

    const data: any = await response.json();

    return {
      id: data.id,
      model: data.model,
      content: data.content[0]?.type === 'text' ? data.content[0].text : '',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      },
      finishReason: data.stop_reason || 'stop'
    };
  }

  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatCompletionResponse> {
    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: request.model,
        messages: conversationMessages,
        system: systemMessage?.content,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`${response.status} ${error || response.statusText}`);
    }

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

        for (const line of lines) {
          const data = line.replace(/^data: /, '');
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
              const text = parsed.delta?.text || '';
              if (text) {
                fullContent += text;
                onChunk(text);
              }
            } else if (parsed.type === 'message_start') {
              inputTokens = parsed.message?.usage?.input_tokens || 0;
            } else if (parsed.type === 'message_delta') {
              outputTokens = parsed.usage?.output_tokens || 0;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return {
      id: crypto.randomUUID(),
      model: request.model,
      content: fullContent,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens
      },
      finishReason: 'stop'
    };
  }
}

// Moonshot 适配器（OpenAI 兼容）
export class MoonshotProvider extends OpenAIProvider {
  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
  }
}

// Groq 适配器（OpenAI 兼容）
export class GroqProvider extends OpenAIProvider {
  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
  }
}

// SiliconFlow 适配器（OpenAI 兼容）
export class SiliconFlowProvider extends OpenAIProvider {
  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
  }
}

// Aliyun 阿里云百炼适配器（OpenAI 兼容）
export class AliyunProvider extends OpenAIProvider {
  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
  }
}

// Minimax 适配器（OpenAI 兼容）
export class MinimaxProvider extends OpenAIProvider {
  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
  }
}

// NVIDIA 适配器（OpenAI 兼容）
export class NvidiaProvider extends OpenAIProvider {
  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
  }
}

// iFlow 适配器（OpenAI 兼容，带非标准错误格式处理）
export class IflowProvider extends OpenAIProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
    this.baseUrl = config.baseUrl || 'https://apis.iflow.cn/v1';
    this.apiKey = config.apiKey;
  }

  private async rawRequest(body: object): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });
    const data: any = await response.json();
    // iflow 错误时返回 {status, msg, body} 而非标准 OpenAI 格式
    if (data.status && !data.choices) {
      throw new Error(`iflow error ${data.status}: ${data.msg}`);
    }
    return data;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const data = await this.rawRequest({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false
    });
    const choice = data.choices[0];
    return {
      id: data.id,
      model: data.model,
      content: choice.message.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      finishReason: choice.finish_reason || 'stop'
    };
  }

  async streamChatCompletion(
    request: ChatCompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: true
      })
    });

    const text = await response.text();
    // 检查是否为非标准错误响应
    try {
      const maybeError = JSON.parse(text);
      if (maybeError.status && !maybeError.choices) {
        throw new Error(`iflow error ${maybeError.status}: ${maybeError.msg}`);
      }
    } catch (e: any) {
      if (e.message.startsWith('iflow error')) throw e;
    }

    let fullContent = '';
    const lines = text.split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        const content = chunk.choices?.[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      } catch {}
    }

    return {
      id: '',
      model: request.model,
      content: fullContent,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop'
    };
  }
}

// DeepSeek 适配器（OpenAI 兼容）
export class DeepSeekProvider extends OpenAIProvider {
  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
  }
}

// Ollama 本地模型适配器（OpenAI 兼容，无需 API Key）
export class OllamaProvider extends OpenAIProvider {
  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}
