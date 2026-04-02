const identifySourceIdType = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().startsWith("urn:isbn:")) return "ISBN";
  if (trimmed.toLowerCase().startsWith("urn:uuid:")) return "URN";
  if (trimmed.toLowerCase().startsWith("urn:")) return "URN";
  if (/^https?:\/\//i.test(trimmed)) return "URI";
  if (trimmed.toLowerCase().includes("document-id")) return "DocID";
  if (trimmed.toLowerCase().includes("media")) return "Media ID";
  return "URI";
};

const isLikelyIdentifier = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("urn:")) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return false;
};

const extractIdentifierValue = (identifier) => {
  if (!identifier) return "";
  if (typeof identifier === "string") return identifier;
  if (Array.isArray(identifier)) {
    const stringId = identifier.find((item) => typeof item === "string");
    if (stringId) return stringId;
    const objectId = identifier.find((item) => item?.value || item?.identifier);
    return objectId?.value || objectId?.identifier || "";
  }
  if (typeof identifier === "object") {
    return identifier.value || identifier.identifier || "";
  }
  return "";
};

const normalizeIsbn = (value) => {
  const cleaned = String(value || "").replace(/[^0-9Xx]/g, "");
  if (cleaned.length === 13) return cleaned;
  if (cleaned.length !== 10) return cleaned;
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

const identifierForWorkUrl = (rawIdentifier) => {
  const trimmed = String(rawIdentifier || "").trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("urn:isbn:")) {
    const isbn = normalizeIsbn(trimmed.slice("urn:isbn:".length));
    return { type: "ISBN", value: isbn || trimmed };
  }
  if (lower.startsWith("urn:librarysimplified.org/terms/id/")) {
    const remainder = trimmed.slice(
      "urn:librarysimplified.org/terms/id/".length
    );
    const decoded = decodeURIComponent(remainder);
    const [type, ...rest] = decoded.split("/");
    const value = rest.join("/") || remainder;
    return { type: type || "URI", value };
  }
  return { type: "URI", value: trimmed };
};

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const normalizeFeedUrl = (href, base) => {
  if (!href) return "";
  if (href.startsWith(base)) return href;
  if (href.startsWith("/")) return `${base}${href}`;
  try {
    const parsed = new URL(href);
    if (parsed.origin) {
      return href;
    }
    return `${base}${parsed.pathname}${parsed.search}`;
  } catch (_error) {
    return href;
  }
};

const buildFeedRequestUrl = (href, base) => {
  if (!href) return "";
  if (isAbsoluteUrl(base)) {
    const absolute = isAbsoluteUrl(href)
      ? href
      : new URL(href, base).toString();
    return `/opds-proxy?url=${encodeURIComponent(absolute)}`;
  }
  return normalizeFeedUrl(href, base);
};

const buildFeedDisplayUrl = (href, base) => {
  if (!href) return "";
  if (href.startsWith("/opds-proxy?url=")) {
    const raw = href.split("/opds-proxy?url=")[1] || "";
    try {
      return decodeURIComponent(raw);
    } catch (_error) {
      return raw;
    }
  }
  if (isAbsoluteUrl(base)) {
    return isAbsoluteUrl(href) ? href : new URL(href, base).toString();
  }
  return normalizeFeedUrl(href, base);
};

const parseOpds2Publication = (publication) => {
  const metadata = publication?.metadata || {};
  const title = metadata.title || "";
  const authors =
    Array.isArray(metadata.author) && metadata.author.length > 0
      ? metadata.author
          .map((author) => author?.name || author)
          .filter(Boolean)
          .join("; ")
      : "";
  const identifier = extractIdentifierValue(metadata.identifier || metadata.id);
  const publisher = metadata.publisher || "";
  const published = metadata.published || metadata.published_date || "";
  const editors =
    Array.isArray(metadata.editor) && metadata.editor.length > 0
      ? metadata.editor
          .map((editor) => editor?.name || editor)
          .filter(Boolean)
          .join("; ")
      : "";

  let urn = identifier;
  if (!urn && publication?.links?.length) {
    const workLink = publication.links.find((link) =>
      (link.rel || "").includes("self")
    );
    if (workLink?.href) {
      urn = workLink.href;
    }
  }

  return {
    title,
    authors,
    identifier: urn,
    publisher,
    published,
    editors,
  };
};

const parseOpds2Feed = (data) => {
  const publications = Array.isArray(data?.publications)
    ? data.publications
    : [];
  const items = publications.map(parseOpds2Publication);
  const nextLink =
    Array.isArray(data?.links) &&
    data.links.find((link) => (link.rel || "").includes("next"));
  return { items, nextHref: nextLink?.href || "" };
};

const collectOpdsLinks = (data) => {
  const links = [];
  if (Array.isArray(data?.links)) {
    links.push(...data.links);
  }
  if (Array.isArray(data?.navigation)) {
    links.push(...data.navigation);
  }
  if (Array.isArray(data?.groups)) {
    data.groups.forEach((group) => {
      const groupTitle = group?.metadata?.title || group?.metadata?.name || "";
      if (Array.isArray(group?.links)) {
        group.links.forEach((link) => {
          links.push({
            ...link,
            title: link?.title || groupTitle,
          });
        });
      }
    });
  }
  if (Array.isArray(data?.facets)) {
    data.facets.forEach((facet) => {
      if (Array.isArray(facet?.links)) {
        links.push(...facet.links);
      }
    });
  }
  return links;
};

export {
  buildFeedDisplayUrl,
  buildFeedRequestUrl,
  collectOpdsLinks,
  extractIdentifierValue,
  identifySourceIdType,
  identifierForWorkUrl,
  isLikelyIdentifier,
  normalizeFeedUrl,
  parseOpds2Feed,
  parseOpds2Publication,
};
