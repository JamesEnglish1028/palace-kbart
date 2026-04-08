import {
  buildFeedDisplayUrl,
  buildFeedRequestUrl,
  identifySourceIdType,
  identifierForWorkUrl,
  isLikelyIdentifier,
  parseOpds2Feed,
} from "../utils/opds";

type ExportOptions = {
  libraryShortName: string;
  collectionName: string;
  collectionHref: string;
  feedBase: string;
  baseUrl: string;
  webClientUrl: string;
  fromDate?: string;
  onProgress?: (pagesFetched: number) => void;
};

const DEFAULT_KBART_HEADERS = [
  "title_id",
  "publication_title",
  "title_url",
  "first_author",
  "online_identifier",
  "isbn",
  "publisher_name",
  "publication_type",
  "date_monograph_published_online",
  "first_editor",
  "access_type",
  "source_id",
  "source_id_type",
  "vendor_id",
];

const extractProviderId = (identifier: string, sourceIdType: string) => {
  if (sourceIdType === "DOI") {
    const trimmed = identifier.trim();
    const doiUrlMatch = trimmed.match(
      /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i
    );
    if (doiUrlMatch) {
      return doiUrlMatch[1];
    }
    const doiUrnMatch = trimmed.match(/^urn:doi:(.+)$/i);
    if (doiUrnMatch) {
      return doiUrnMatch[1];
    }
    return "";
  }
  if (sourceIdType === "CNRI Handle") {
    const trimmed = identifier.trim();
    const handleMatch = trimmed.match(/^https?:\/\/hdl\.handle\.net\/(.+)$/i);
    if (handleMatch) {
      return handleMatch[1];
    }
  }
  if (sourceIdType === "UUID") {
    const trimmed = identifier.trim();
    const uuidMatch = trimmed.match(/^urn:uuid:(.+)$/i);
    if (uuidMatch) {
      return uuidMatch[1];
    }
  }
  return "";
};

const LOC_PROXY_BASE =
  (import.meta as ImportMeta).env?.VITE_LOC_PROXY_BASE ||
  (import.meta as ImportMeta).env?.VITE_OPDS_PROXY_BASE ||
  "";

const buildLocIsbnUrl = () => {
  if (!LOC_PROXY_BASE) return "";
  if (LOC_PROXY_BASE.endsWith("/loc-proxy")) {
    return LOC_PROXY_BASE.replace(/\/loc-proxy$/, "/loc-isbn");
  }
  return LOC_PROXY_BASE;
};

const normalizeIsbnValue = (value: string) => {
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

const extractIsbnFromObject = (value: unknown): string[] => {
  if (!value) return [];
  if (typeof value === "string") {
    const normalized = normalizeIsbnValue(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractIsbnFromObject(item));
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const matches: string[] = [];
    Object.entries(obj).forEach(([key, val]) => {
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

const fetchLocIsbn = async (
  title: string,
  author: string,
  published: string
) => {
  const proxyUrl = buildLocIsbnUrl();
  if (!proxyUrl) return "";
  const yearMatch = published?.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : "";
  const queryParts = [title, author, year].filter(Boolean);
  if (queryParts.length === 0) return "";
  let query = queryParts.join(" ");
  if (query.includes(":")) {
    query = query.split(":")[0].trim();
  }
  if (query.length > 200) {
    query = query.slice(0, 200);
  }
  const params = new URLSearchParams({
    q: query,
    fo: "json",
    fa: "original-format:book",
  });
  const searchUrl = `https://www.loc.gov/search/?${params.toString()}`;
  const requestUrl = `${proxyUrl}?title=${encodeURIComponent(
    title
  )}&author=${encodeURIComponent(author)}&year=${encodeURIComponent(year)}`;
  const finalResponse = await fetch(requestUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!finalResponse.ok) return "";
  const payload = (await finalResponse.json()) as { isbn?: string };
  return payload?.isbn || "";
};

const shouldContinueCrawl = (
  entries: ReturnType<typeof parseOpds2Feed>["items"],
  fromDateValue: number | null
) => {
  if (!fromDateValue) return true;
  if (entries.length === 0) return false;
  const hasUnknownModified = entries.some(
    (entry) => !entry.modified || !Number.isFinite(Date.parse(entry.modified))
  );
  if (hasUnknownModified) return true;
  const hasRecent = entries.some(
    (entry) => Date.parse(entry.modified ?? "") >= fromDateValue
  );
  return hasRecent;
};

const fetchOpdsEntries = async (
  feedUrl: string,
  feedBase: string,
  fromDateValue: number | null,
  onProgress: ((pagesFetched: number) => void) | undefined,
  accumulator: ReturnType<typeof parseOpds2Feed>["items"] = [],
  pagesFetched = 0
) => {
  const response = await fetch(feedUrl, {
    method: "GET",
    credentials: "omit",
    headers: {
      Accept: "application/opds+json",
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    const snippet = errorText ? errorText.slice(0, 300) : "";
    throw new Error(
      `Feed request failed with ${response.status}. ${snippet}`.trim()
    );
  }

  const data = await response.json();
  const { items, nextHref } = parseOpds2Feed(data);
  items.forEach((item) => accumulator.push(item));
  const nextPages = pagesFetched + 1;
  if (onProgress) {
    onProgress(nextPages);
  }

  if (nextHref && shouldContinueCrawl(items, fromDateValue)) {
    const nextUrl = buildFeedRequestUrl(nextHref, feedBase);
    return fetchOpdsEntries(
      nextUrl,
      feedBase,
      fromDateValue,
      onProgress,
      accumulator,
      nextPages
    );
  }
  return accumulator;
};

const buildKbartCsv = (rows: string[][]) =>
  [DEFAULT_KBART_HEADERS, ...rows]
    .map((row) =>
      row
        .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n") + "\n";

const exportKbart = async ({
  libraryShortName,
  collectionName,
  collectionHref,
  feedBase,
  baseUrl,
  webClientUrl,
  fromDate,
  onProgress,
  enrichIsbn,
}: ExportOptions & { enrichIsbn?: boolean }) => {
  const collectionFeedUrl = buildFeedRequestUrl(collectionHref, feedBase);
  const displayUrl = buildFeedDisplayUrl(collectionHref, feedBase);
  const parsedFromDate = fromDate ? Date.parse(fromDate) : NaN;
  const fromDateValue = Number.isFinite(parsedFromDate)
    ? parsedFromDate
    : null;
  const entries = await fetchOpdsEntries(
    collectionFeedUrl,
    feedBase,
    fromDateValue,
    onProgress
  );
  const isbnCache = new Map<string, string>();
  const rows = await Promise.all(
    entries
      .filter((entry) => isLikelyIdentifier(entry.identifier))
      .filter((entry) => {
        if (!fromDateValue) return true;
        const modified = entry.modified ? Date.parse(entry.modified) : NaN;
        return Number.isFinite(modified) && modified >= fromDateValue;
      })
      .map(async (entry) => {
        const identifier = entry.identifier;
        const workIdentifier = identifierForWorkUrl(identifier);
        if (!workIdentifier) return null;
        const qualifiedIdentifier = encodeURIComponent(
          `${workIdentifier.type}/${workIdentifier.value}`
        );
        const worksUrl = `${baseUrl}/${libraryShortName}/works/${qualifiedIdentifier}`;
        const encodedLink = encodeURIComponent(worksUrl);
        const titleUrl = `${webClientUrl}/book/${encodedLink}`;
        let isbnValue = "";
        if (identifySourceIdType(identifier) === "ISBN") {
          isbnValue = normalizeIsbnValue(identifier) || identifier;
        } else if (enrichIsbn) {
          const cacheKey = `${entry.title}|${entry.authors}|${entry.published}`;
          if (isbnCache.has(cacheKey)) {
            isbnValue = isbnCache.get(cacheKey) || "";
          } else {
            const lookedUp = await fetchLocIsbn(
              entry.title,
              entry.authors,
              entry.published
            );
            isbnCache.set(cacheKey, lookedUp);
            isbnValue = lookedUp;
          }
        }

        return [
          identifier,
          entry.title,
          titleUrl,
          entry.authors,
          identifier,
          isbnValue,
          entry.publisher,
          "monograph",
          entry.published,
          entry.editors,
          "P",
          collectionName,
          identifySourceIdType(identifier),
          extractProviderId(identifier, identifySourceIdType(identifier)),
        ];
      })
  );

  const rowsFiltered = rows.filter(Boolean) as string[][];

  return {
    csv: buildKbartCsv(rowsFiltered),
    rowsCount: rowsFiltered.length,
    displayUrl,
  };
};

export { exportKbart };
export type { ExportOptions };
