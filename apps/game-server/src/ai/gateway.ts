import OpenAI from 'openai';
import { type AgentModel, GATEWAY_MODEL_MAP } from '@bossroom/shared-types';

const ACCOUNT_ID = process.env['CF_AI_GATEWAY_ACCOUNT_ID'];
const GATEWAY_ID = process.env['CF_AI_GATEWAY_ID'];

// Provider API keys — sent through the gateway to the actual provider
const PROVIDER_KEYS: Record<string, string> = {
  'anthropic': process.env['ANTHROPIC_API_KEY'] || '',
  'openai': process.env['OPENAI_API_KEY'] || '',
  'google-ai-studio': process.env['GOOGLE_AI_API_KEY'] || '',
};

function getProviderFromModel(gatewayModel: string): string {
  return gatewayModel.split('/')[0];
}

/**
 * Create an OpenAI-compatible client routed through Cloudflare AI Gateway.
 * All providers (Claude, GPT-4o, Gemini) are accessible via model string.
 * The provider's own API key is used — gateway is unauthenticated (pass-through).
 */
export function createGatewayClient(agentModel: AgentModel): {
  client: OpenAI;
  model: string;
} {
  const gatewayModel = GATEWAY_MODEL_MAP[agentModel];
  const provider = getProviderFromModel(gatewayModel);
  const providerKey = PROVIDER_KEYS[provider];

  const client = new OpenAI({
    apiKey: providerKey,
    baseURL: `https://gateway.ai.cloudflare.com/v1/${ACCOUNT_ID}/${GATEWAY_ID}/compat`,
  });

  return { client, model: gatewayModel };
}

/**
 * Send a chat completion through the gateway.
 * Works with Claude, GPT-4o, and Gemini — just pass the AgentModel.
 */
export async function chatCompletion(
  agentModel: AgentModel,
  messages: OpenAI.ChatCompletionMessageParam[],
  options?: { stream?: boolean }
) {
  const { client, model } = createGatewayClient(agentModel);

  if (options?.stream) {
    return client.chat.completions.create({
      model,
      messages,
      stream: true,
    });
  }

  return client.chat.completions.create({
    model,
    messages,
    stream: false,
  });
}
