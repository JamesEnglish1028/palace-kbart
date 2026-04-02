import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const fetchWithRedirects = async (target, headers, depth = 0) => {
  const response = await fetch(target, {
    method: 'GET',
    redirect: 'manual',
    headers,
  });
  if (
    [301, 302, 303, 307, 308].includes(response.status) &&
    response.headers.get('location') &&
    depth < 3
  ) {
    const location = response.headers.get('location');
    const nextUrl = new URL(location, target).toString();
    return fetchWithRedirects(nextUrl, headers, depth + 1);
  }
  return response;
};

const proxyHandler = async (req, res, next) => {
  if (!req.url || (!req.url.startsWith('/opds-proxy') && !req.url.startsWith('/web-proxy'))) {
    next();
    return;
  }
  const url = new URL(req.url || '', 'http://localhost');
  const target = url.searchParams.get('url');
  if (!target) {
    res.statusCode = 400;
    res.end('Missing url parameter');
    return;
  }
  try {
    const isWebProxy = req.url.startsWith('/web-proxy');
    const response = await fetchWithRedirects(
      target,
      {
        Accept: isWebProxy ? '*/*' : 'application/opds+json',
        'Accept-Encoding': 'identity',
        'User-Agent': 'curl/8.4.0',
      },
      0
    );
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-encoding') return;
      res.setHeader(key, value);
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const location = response.headers.get('location');
      const snippet = buffer.toString('utf8').slice(0, 500);
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(
        `Upstream status: ${response.status}\nLocation: ${location || ''}\nBody:\n${snippet}`
      );
      return;
    }
    res.end(buffer);
  } catch (error) {
    res.statusCode = 502;
    res.end(String(error));
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'opds-proxy',
      configureServer(server) {
        server.middlewares.use(proxyHandler);
      },
    },
    react(),
  ],
  server: {
    proxy: {
      '/cm': {
        target: 'http://localhost:6500',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/cm/, ''),
      },
      '/admin': {
        target: 'http://localhost:6500',
        changeOrigin: true,
        secure: false,
      },
      '/public': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/public/, ''),
      },
      '/registry': {
        target: 'https://registry.palaceproject.io',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/registry/, ''),
      },
    },
  },
})
