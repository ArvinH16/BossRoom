import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { type AgentModel, GATEWAY_MODEL_MAP } from '@bossroom/shared-types';
import { env } from '../env.js';
import { log } from '../logger.js';

const GATEWAY_BASE = `https://gateway.ai.cloudflare.com/v1/${env.CF_AI_GATEWAY_ACCOUNT_ID}/${env.CF_AI_GATEWAY_ID}/compat`;

const PROVIDER_CONFIGS: Record<string, { name: string; envKey: 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' | 'GOOGLE_AI_API_KEY' }> = {
  'anthropic': { name: 'cf-anthropic', envKey: 'ANTHROPIC_API_KEY' },
  'openai': { name: 'cf-openai', envKey: 'OPENAI_API_KEY' },
  'google-ai-studio': { name: 'cf-google', envKey: 'GOOGLE_AI_API_KEY' },
};

const providers: Record<string, ReturnType<typeof createOpenAICompatible>> = {};

for (const [key, config] of Object.entries(PROVIDER_CONFIGS)) {
  const apiKey = env[config.envKey];
  if (apiKey) {
    providers[key] = createOpenAICompatible({
      name: config.name,
      apiKey,
      baseURL: GATEWAY_BASE,
    });
  } else {
    log.warn(`${config.envKey} not set — ${key} models unavailable`);
  }
}

function getProviderName(gatewayModel: string): string {
  return gatewayModel.split('/')[0];
}

export function getModel(agentModel: AgentModel): LanguageModel {
  const gatewayModel = GATEWAY_MODEL_MAP[agentModel];
  const providerName = getProviderName(gatewayModel);
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`No API key configured for provider: ${providerName}`);
  }
  return provider(gatewayModel);
}
