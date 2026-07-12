// Vercel serverless function: /api/video-status
// Polls the status of a video generation task started via /api/video-create.

export default async function handler(req, res) {
  const apiKey = process.env.COMETAPI_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing COMETAPI_KEY. Add it in Vercel project settings.' });
    return;
  }

  const taskId = req.query?.task_id;
  if (!taskId) {
    res.status(400).json({ error: 'Missing task_id' });
    return;
  }

  try {
    const upstream = await fetch(`https://api.cometapi.com/v1/videos/${encodeURIComponent(taskId)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || data?.error || 'Failed to fetch video status.' });
      return;
    }

    const status = String(data.status || 'unknown').toLowerCase();
    const successStatuses = ['success', 'completed'];
    const failedStatuses = ['failed', 'error'];

    let videoUrl = data.video_url || null;
    // If the API didn't hand back a direct URL, fall back to our own proxy
    // (which attaches the auth header the browser can't send itself).
    if (!videoUrl && successStatuses.includes(status)) {
      videoUrl = `/api/video-content?task_id=${encodeURIComponent(taskId)}`;
    }

    res.status(200).json({
      status,
      progress: data.progress ?? null,
      done: successStatuses.includes(status),
      failed: failedStatuses.includes(status),
      video_url: videoUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
