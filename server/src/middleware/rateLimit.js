const maxTrackedClients = 10000;

export function createRateLimiter({ windowMs, maxRequests, message }) {
  const clientWindows = new Map();
  let lastCleanupAt = 0;

  return function rateLimitRequest(request, response, next) {
    const now = Date.now();
    if (now - lastCleanupAt > 60_000) {
      for (const [ip, window] of clientWindows) {
        if (window.resetAt <= now) clientWindows.delete(ip);
      }
      lastCleanupAt = now;
    }

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    let window = clientWindows.get(ip);
    if (!window || window.resetAt <= now) window = { count: 0, resetAt: now + windowMs };
    window.count += 1;
    clientWindows.set(ip, window);

    if (clientWindows.size > maxTrackedClients) {
      const oldestIp = clientWindows.keys().next().value;
      if (oldestIp !== ip) clientWindows.delete(oldestIp);
    }

    const remaining = Math.max(0, maxRequests - window.count);
    const retryAfter = Math.max(1, Math.ceil((window.resetAt - now) / 1000));
    response.setHeader('RateLimit-Limit', maxRequests);
    response.setHeader('RateLimit-Remaining', remaining);
    response.setHeader('RateLimit-Reset', retryAfter);

    if (window.count > maxRequests) {
      response.setHeader('Retry-After', retryAfter);
      return response.status(429).json({ message });
    }
    return next();
  };
}
