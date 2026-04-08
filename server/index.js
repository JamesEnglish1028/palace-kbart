import express from "express";

const app = express();
const PORT = process.env.PORT || 8787;

const allowCors = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

const fetchWithRedirects = async (target, headers, depth = 0) => {
  const response = await fetch(target, {
    method: "GET",
    redirect: "manual",
    headers,
  });
  if (
    [301, 302, 303, 307, 308].includes(response.status) &&
    response.headers.get("location") &&
    depth < 3
  ) {
    const location = response.headers.get("location");
    const nextUrl = new URL(location, target).toString();
    return fetchWithRedirects(nextUrl, headers, depth + 1);
  }
  return response;
};

app.use(allowCors);

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "palace-kbart-proxy" });
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, status: "healthy" });
});

app.get("/opds-proxy", async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== "string") {
    res.status(400).send("Missing url parameter");
    return;
  }
  try {
    const response = await fetchWithRedirects(
      target,
      {
        Accept: "application/opds+json",
        "Accept-Encoding": "identity",
        "User-Agent": "curl/8.4.0",
      },
      0
    );
    res.status(response.status);
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === "content-encoding" || lower === "access-control-allow-origin")
        return;
      res.setHeader(key, value);
    });
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const location = response.headers.get("location");
      const snippet = buffer.toString("utf8").slice(0, 500);
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(
        `Upstream status: ${response.status}\nLocation: ${location || ""}\nBody:\n${snippet}`
      );
      return;
    }
    res.end(buffer);
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(502).send(String(error));
  }
});

app.get("/web-proxy", async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== "string") {
    res.status(400).send("Missing url parameter");
    return;
  }
  try {
    const response = await fetchWithRedirects(
      target,
      {
        Accept: "*/*",
        "Accept-Encoding": "identity",
        "User-Agent": "curl/8.4.0",
      },
      0
    );
    res.status(response.status);
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === "content-encoding" || lower === "access-control-allow-origin")
        return;
      res.setHeader(key, value);
    });
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const location = response.headers.get("location");
      const snippet = buffer.toString("utf8").slice(0, 500);
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(
        `Upstream status: ${response.status}\nLocation: ${location || ""}\nBody:\n${snippet}`
      );
      return;
    }
    res.end(buffer);
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(502).send(String(error));
  }
});

app.get("/registry-proxy", async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== "string") {
    res.status(400).send("Missing url parameter");
    return;
  }
  try {
    const response = await fetchWithRedirects(
      target,
      {
        Accept: "application/json, application/opds+json",
        "Accept-Encoding": "identity",
        "User-Agent": "curl/8.4.0",
      },
      0
    );
    res.status(response.status);
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === "content-encoding" || lower === "access-control-allow-origin")
        return;
      res.setHeader(key, value);
    });
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const location = response.headers.get("location");
      const snippet = buffer.toString("utf8").slice(0, 500);
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(
        `Upstream status: ${response.status}\nLocation: ${location || ""}\nBody:\n${snippet}`
      );
      return;
    }
    res.end(buffer);
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(502).send(String(error));
  }
});

app.get("/loc-proxy", async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== "string") {
    res.status(400).send("Missing url parameter");
    return;
  }
  try {
    const response = await fetchWithRedirects(
      target,
      {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        "User-Agent": "curl/8.4.0",
      },
      0
    );
    res.status(response.status);
    response.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === "content-encoding" || lower === "access-control-allow-origin")
        return;
      res.setHeader(key, value);
    });
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      const location = response.headers.get("location");
      const snippet = buffer.toString("utf8").slice(0, 500);
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(
        `Upstream status: ${response.status}\nLocation: ${location || ""}\nBody:\n${snippet}`
      );
      return;
    }
    res.end(buffer);
  } catch (error) {
    res.status(502).send(String(error));
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Proxy listening on ${PORT}`);
});
