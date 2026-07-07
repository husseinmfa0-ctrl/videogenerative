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

  // OpenRouter's own maintained free auto-router. Hardcoding specific free model IDs
  // turned out to be fragile — OpenRouter's free catalog rotates often and pinned
  // models can disappear entirely. The auto-router always points at something live.
  // We defend against it landing on a reasoning model (which can leak its internal
  // thought process) by detecting that pattern and retrying.
  function looksLikeLeakedReasoning(text){
    if (!text || text.trim().length < 2) return true;
    const flags = [/\blet'?s\b/i, /\bwe need\b/i, /character count/i, /count characters/i, /<think/i, /\bokay,? (i|so|let)/i];
    return flags.some(r => r.test(text));
  }

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
        max_tokens: Math.min(Math.max(Number(max_tokens) || 1200, 300), 3000),
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
    let result=null, text='';
    for(let attempt=0; attempt<3; attempt++){
      result = await callModel('openrouter/free');
      if(!result.ok) continue;
      text = cleanOutput(result.data?.choices?.[0]?.message?.content || '');
      if(text && !looksLikeLeakedReasoning(text)) break;
    }

    if (!result || !result.ok) {
      res.status(result?.status || 500).json({ error: result?.data?.error?.message || 'The free model is temporarily unavailable — please try again shortly.' });
      return;
    }

    if (!text || looksLikeLeakedReasoning(text)) {
      res.status(502).json({ error: 'The model returned an unusable response — please try again.' });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
