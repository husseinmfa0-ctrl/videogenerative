// Vercel serverless function: /api/video-content
// Streams the finished video's bytes from CometAPI. The browser's <video> tag
// can't send an Authorization header on its own, so this proxy attaches it
// server-side and passes the file straight through.

export default async function handler(req, res) {
  const apiKey = process.env.COMETAPI_KEY;
  if (!apiKey) {
    res.status(500).send('Server is missing COMETAPI_KEY.');
    return;
  }

  const taskId = req.query?.task_id;
  if (!taskId) {
    res.status(400).send('Missing task_id');
    return;
  }

  try {
    const upstream = await fetch(`https://api.cometapi.com/v1/videos/${encodeURIComponent(taskId)}/content`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!upstream.ok) {
      res.status(upstream.status).send('Failed to fetch video content.');
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).send(err.message || 'Unexpected server error');
  }
}
