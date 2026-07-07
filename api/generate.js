// Vercel serverless function: /api/generate
// Keeps the OpenRouter API key on the server. The browser never sees it.
// Set OPENROUTER_API_KEY in Vercel → Project Settings → Environment Variables.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing OPENROUTER_API_KEY. Add it in Vercel project settings.' });
    return;
  }

  const { prompt, max_tokens } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  const systemPrompt = 'You are a professional copywriter producing ready-to-use content for a video creator tool. ' +
    'Output ONLY the final, clean result the user asked for — nothing else. ' +
    'Never show your reasoning, planning, character counting, drafts, or any internal thought process. ' +
    'Never wrap anything in <think> tags or similar. Do not explain what you are about to do. ' +
    'Do not add commentary before or after the requested content. Just the finished output, correctly formatted.';

  // A list of pinned, known-good instruction-following free models, tried in order.
  // OpenRouter's free tier availability shifts often, so we don't rely on just one or two.
  // Deliberately avoids "openrouter/free" auto-routing, which can land on a reasoning
  // model that burns its token budget on hidden thinking and leaks it into the output.
  const models=[
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen-2.5-72b-instruct:free',
    'google/gemma-2-9b-it:free',
    'mistralai/mistral-7b-instruct:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'microsoft/phi-3-medium-128k-instruct:free'
  ];

  async function callModel(model) {
    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://videogenerative.com',
        'X-Title': 'VideoGenerative'
      },
      body: JSON.stringify({
        model,
        max_tokens: Math.min(Math.max(Number(max_tokens) || 900, 50), 2000),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });
    const data = await upstream.json().catch(() => ({}));
    return { ok: upstream.ok, status: upstream.status, data };
  }

  function cleanOutput(raw) {
    if (!raw) return raw;
    // Safety net: strip any leaked reasoning blocks a model might emit anyway.
    let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
    out = out.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    return out.trim();
  }

  try {
    let result=null;
    for(const model of models){
      result=await callModel(model);
      if(result.ok)break;
    }

    if (!result.ok) {
      res.status(result.status).json({ error: result.data?.error?.message || 'All free models are currently unavailable — please try again shortly.' });
      return;
    }

    const text = cleanOutput(result.data?.choices?.[0]?.message?.content || '');
    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
