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
  private client: Anthropic;

  constructor(config: ProviderConfig, models: ModelConfig[]) {
    super(config, models);
    this.client = new Anthropic({
      apiKey: config.apiKey
    });
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const systemMessage = request.messages.find(m => m.role === 'system');
    const conversationMessages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    const response = await this.client.messages.create({
      model: request.model,
      messages: conversationMessages,
      system: systemMessage?.content,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature
    });

    return {
      id: response.id,
      model: response.model,
      content: response.content[0]?.type === 'text' ? response.content[0].text : '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens
      },
      finishReason: response.stop_reason || 'stop'
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

    const stream = await this.client.messages.create({
      model: request.model,
      messages: conversationMessages,
      system: systemMessage?.content,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature,
      stream: true
    });

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        const text = chunk.delta.type === 'text_delta' ? chunk.delta.text : '';
        if (text) {
          fullContent += text;
          onChunk(text);
        }
      }
      if (chunk.type === 'message_start') {
        inputTokens = chunk.message.usage.input_tokens;
      }
      if (chunk.type === 'message_delta') {
        outputTokens = chunk.usage.output_tokens;
      }
    }

    return {
      id: '',
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
