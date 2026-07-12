// Vercel serverless function: /api/video-create
// Starts a real AI video generation job with Seedance 2.0 via CometAPI.
// Set COMETAPI_KEY in Vercel → Project Settings → Environment Variables.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.COMETAPI_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing COMETAPI_KEY. Add it in Vercel project settings.' });
    return;
  }

  const { prompt, seconds, size } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  try {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('model', 'doubao-seedance-2-0');
    form.append('seconds', String(seconds || 5));
    form.append('size', size || '16:9');

    const upstream = await fetch('https://api.cometapi.com/v1/videos', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: form
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || data?.error || 'Failed to start video generation.' });
      return;
    }

    const taskId = data.id || data.task_id;
    if (!taskId) {
      res.status(502).json({ error: 'No task id returned from the video service.' });
      return;
    }

    res.status(200).json({ task_id: taskId, status: data.status || 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
