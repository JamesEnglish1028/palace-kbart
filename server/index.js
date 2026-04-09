/* global process, fetch, URL, setTimeout, Buffer, URLSearchParams, console */
import express from "express";

const app = express();
const PORT = process.env.PORT || 8787;

const allowCors = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, X-Requested-With"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
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

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const LOC_MIN_INTERVAL_MS = 3000;
let locRequestQueue = Promise.resolve();
let locLastRequestAt = 0;

const runLocRequest = async (task) => {
  const run = async () => {
    const waitMs = Math.max(0, locLastRequestAt + LOC_MIN_INTERVAL_MS - Date.now());
    if (waitMs > 0) {
      await delay(waitMs);
    }
    locLastRequestAt = Date.now();
    return task();
  };
  const next = locRequestQueue.then(run, run);
  locRequestQueue = next.catch(() => undefined);
  return next;
};

const isRateLimitedLocStatus = (status) => status === 429 || status === 403;

const isHtmlOrCaptchaResponse = (buffer, contentType) => {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("text/html")) return true;
  const snippet = buffer.toString("utf8").slice(0, 2000).toLowerCase();
  return (
    snippet.includes("<html") ||
    snippet.includes("captcha") ||
    snippet.includes("recaptcha")
  );
};

app.use(allowCors);
app.use(express.json({ limit: "1mb" }));

app.options("*", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, X-Requested-With"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).end();
});

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

app.all("/loc-proxy", async (req, res) => {
  const target =
    req.method === "POST" && req.body && typeof req.body.url === "string"
      ? req.body.url
      : req.query.url;
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

const normalizeIsbnValue = (value) => {
  const cleaned = String(value || "").replace(/[^0-9Xx]/g, "");
  if (!cleaned) return "";
  if (cleaned.length === 13) return cleaned;
  if (cleaned.length !== 10) return "";
  const body = cleaned.slice(0, 9);
  const prefix = `978${body}`;
  let sum = 0;
  for (let index = 0; index < prefix.length; index += 1) {
    const digit = Number(prefix[index]);
    sum += digit * (index % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${prefix}${check}`;
};

const extractIsbnFromObject = (value) => {
  if (!value) return [];
  if (typeof value === "string") {
    const normalized = normalizeIsbnValue(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractIsbnFromObject(item));
  }
  if (typeof value === "object") {
    const matches = [];
    Object.entries(value).forEach(([key, val]) => {
      if (key.toLowerCase().includes("isbn")) {
        matches.push(...extractIsbnFromObject(val));
      } else if (typeof val === "object") {
        matches.push(...extractIsbnFromObject(val));
      }
    });
    return matches;
  }
  return [];
};

const locCache = new Map();
const LOC_CACHE_TTL = 1000 * 60 * 60 * 24;

const getCachedLoc = (key) => {
  const entry = locCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > LOC_CACHE_TTL) {
    locCache.delete(key);
    return null;
  }
  return entry.isbn;
};

const setCachedLoc = (key, isbn) => {
  locCache.set(key, { isbn, ts: Date.now() });
};

app.get("/loc-isbn", async (req, res) => {
  const title = String(req.query.title || "").trim();
  const author = String(req.query.author || "").trim();
  const year = String(req.query.year || "").trim();
  const queryParts = [title, author, year].filter(Boolean);
  if (queryParts.length === 0) {
    res.status(400).send("Missing query parameters");
    return;
  }
  const cacheKey = `${title}|${author}|${year}`.toLowerCase();
  const cached = getCachedLoc(cacheKey);
  if (cached !== null) {
    res.json({ isbn: cached, cached: true });
    return;
  }
  const query = queryParts.join(" ");
  const params = new URLSearchParams({
    q: query,
    fo: "json",
    at: "results",
    c: "1",
  });
  const searchUrl = `https://www.loc.gov/books/?${params.toString()}`;
  try {
    const searchResponse = await runLocRequest(() =>
      fetchWithRedirects(
        searchUrl,
        {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "User-Agent": "curl/8.4.0",
        },
        0
      )
    );
    if (isRateLimitedLocStatus(searchResponse.status)) {
      res.json({ isbn: "", rate_limited: true });
      return;
    }
    const buffer = Buffer.from(await searchResponse.arrayBuffer());
    if (!searchResponse.ok) {
      res.status(searchResponse.status);
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(buffer);
      return;
    }
    const contentType = searchResponse.headers.get("content-type") || "";
    if (!contentType.includes("json") || isHtmlOrCaptchaResponse(buffer, contentType)) {
      res.json({ isbn: "", rate_limited: true });
      return;
    }
    let data;
    try {
      data = JSON.parse(buffer.toString("utf8"));
    } catch {
      res.json({ isbn: "", rate_limited: true });
      return;
    }
    const first = data?.results?.find((item) => item?.id);
    if (!first?.id) {
      setCachedLoc(cacheKey, "");
      res.json({ isbn: "" });
      return;
    }
    const itemUrl = first.id.includes("?")
      ? `${first.id}&fo=json&at=item`
      : `${first.id}?fo=json&at=item`;
    const itemResponse = await runLocRequest(() =>
      fetchWithRedirects(
        itemUrl,
        {
          Accept: "application/json",
          "Accept-Encoding": "identity",
          "User-Agent": "curl/8.4.0",
        },
        0
      )
    );
    if (isRateLimitedLocStatus(itemResponse.status)) {
      res.json({ isbn: "", rate_limited: true });
      return;
    }
    const itemBuffer = Buffer.from(await itemResponse.arrayBuffer());
    if (!itemResponse.ok) {
      res.status(itemResponse.status);
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(itemBuffer);
      return;
    }
    const itemContentType = itemResponse.headers.get("content-type") || "";
    if (
      !itemContentType.includes("json") ||
      isHtmlOrCaptchaResponse(itemBuffer, itemContentType)
    ) {
      res.json({ isbn: "", rate_limited: true });
      return;
    }
    let itemData;
    try {
      itemData = JSON.parse(itemBuffer.toString("utf8"));
    } catch {
      res.json({ isbn: "", rate_limited: true });
      return;
    }
    const candidates = extractIsbnFromObject(itemData);
    const isbn = candidates[0] || "";
    setCachedLoc(cacheKey, isbn);
    res.json({ isbn });
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(502).send(String(error));
  }
});

app.get("/ol-isbn", async (req, res) => {
  const title = String(req.query.title || "").trim();
  const author = String(req.query.author || "").trim();
  const year = String(req.query.year || "").trim();
  const queryParts = [title, author, year].filter(Boolean);
  if (queryParts.length === 0) {
    res.status(400).send("Missing query parameters");
    return;
  }
  const params = new URLSearchParams();
  if (title) params.set("title", title);
  if (author) params.set("author", author);
  if (year) params.set("first_publish_year", year);
  params.set("limit", "5");
  const searchUrl = `https://openlibrary.org/search.json?${params.toString()}`;
  try {
    const response = await fetchWithRedirects(
      searchUrl,
      {
        Accept: "application/json",
        "Accept-Encoding": "identity",
        "User-Agent": "curl/8.4.0",
      },
      0
    );
    res.status(response.status);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!response.ok) {
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(buffer);
      return;
    }
    const data = JSON.parse(buffer.toString("utf8"));
    const docs = Array.isArray(data?.docs) ? data.docs : [];
    const firstWithIsbn = docs.find((doc) => Array.isArray(doc?.isbn));
    if (!firstWithIsbn) {
      res.json({ isbn: "" });
      return;
    }
    const isbnList = firstWithIsbn.isbn || [];
    const normalized = extractIsbnFromObject(isbnList);
    res.json({ isbn: normalized[0] || "" });
  } catch (error) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(502).send(String(error));
  }
});

app.listen(PORT, () => {
  console.log(`Proxy listening on ${PORT}`);
});
