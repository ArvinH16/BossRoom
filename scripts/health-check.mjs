import 'dotenv/config';
import pg from 'pg';
import OpenAI from 'openai';

const results = [];

function ok(name, detail) {
  results.push({ name, status: 'OK', detail });
  console.info(`  ✓ ${name}: ${detail}`);
}

function fail(name, detail) {
  results.push({ name, status: 'FAIL', detail });
  console.error(`  ✗ ${name}: ${detail}`);
}

// --- 1. Check required env vars ---
console.info('\n[ENV VARS]');
const required = [
  'DATABASE_URL',
  'CF_AI_GATEWAY_ACCOUNT_ID',
  'CF_AI_GATEWAY_ID',
];
const optional = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_AI_API_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
];

for (const key of required) {
  if (process.env[key]) {
    ok(key, 'set');
  } else {
    fail(key, 'MISSING (required)');
  }
}

let hasAiKey = false;
for (const key of optional) {
  if (process.env[key]) {
    ok(key, 'set');
    if (key.includes('API_KEY') && !key.includes('FIREBASE')) hasAiKey = true;
  } else {
    console.info(`  - ${key}: not set (optional)`);
  }
}

if (!hasAiKey) {
  fail('AI API Keys', 'At least one of OPENAI/ANTHROPIC/GOOGLE_AI API key is required');
}

// --- 2. Database connection ---
console.info('\n[DATABASE]');
if (process.env.DATABASE_URL) {
  try {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
      ssl: false,
    });
    const res = await pool.query('SELECT NOW() as time, current_database() as db');
    ok('Cloud SQL', `Connected to "${res.rows[0].db}" at ${res.rows[0].time}`);
    await pool.end();
  } catch (err) {
    fail('Cloud SQL', err.message);
  }
} else {
  fail('Cloud SQL', 'DATABASE_URL not set');
}

// --- 3. Cloudflare AI Gateway ---
console.info('\n[AI GATEWAY]');
const accountId = process.env.CF_AI_GATEWAY_ACCOUNT_ID;
const gatewayId = process.env.CF_AI_GATEWAY_ID;

if (accountId && gatewayId) {
  // Gateway is unauthenticated (pass-through) — provider API key is sent directly
  const providers = [
    { key: 'GOOGLE_AI_API_KEY', model: 'google-ai-studio/gemini-2.5-flash', name: 'Gemini' },
    { key: 'OPENAI_API_KEY', model: 'openai/gpt-4o', name: 'GPT-4o' },
    { key: 'ANTHROPIC_API_KEY', model: 'anthropic/claude-sonnet-4-5', name: 'Claude' },
  ];

  let tested = false;
  for (const p of providers) {
    const apiKey = process.env[p.key];
    if (!apiKey) continue;

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat`,
        timeout: 15000,
      });

      const res = await client.chat.completions.create({
        model: p.model,
        messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
        max_tokens: 5,
      });

      const reply = res.choices[0]?.message?.content?.trim();
      ok(`AI Gateway (${p.name})`, `Response: "${reply}"`);
      tested = true;
      break;
    } catch (err) {
      fail(`AI Gateway (${p.name})`, err.message);
    }
  }

  if (!tested) {
    fail('AI Gateway', 'No working AI provider key found');
  }
} else {
  fail('AI Gateway', 'Missing CF_AI_GATEWAY_ACCOUNT_ID or CF_AI_GATEWAY_ID');
}

// --- 4. Firebase config ---
console.info('\n[FIREBASE]');
if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  ok('Firebase Config', `Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
} else {
  fail('Firebase Config', 'NEXT_PUBLIC_FIREBASE_API_KEY or PROJECT_ID not set');
}

// --- Summary ---
const failed = results.filter((r) => r.status === 'FAIL');
console.info('\n' + '='.repeat(50));
if (failed.length === 0) {
  console.info('All systems operational!');
} else {
  console.info(`${failed.length} check(s) failed:`);
  for (const f of failed) {
    console.info(`  - ${f.name}: ${f.detail}`);
  }
}
console.info('='.repeat(50) + '\n');

process.exit(failed.length > 0 ? 1 : 0);
