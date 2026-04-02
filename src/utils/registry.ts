const normalizeRegistryLibraries = (data: any) => {
  if (!data) return [];
  if (Array.isArray(data?.libraries)) return data.libraries;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.catalogs)) return data.catalogs;
  if (Array.isArray(data?.publications)) return data.publications;
  if (Array.isArray(data)) return data;
  return [];
};

const extractLibraryName = (entry: any) =>
  entry?.name ||
  entry?.title ||
  entry?.metadata?.title ||
  entry?.metadata?.name ||
  entry?.short_name ||
  entry?.shortName ||
  "Library";

const extractShortNameFromOpdsUrl = (value: string) => {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return "";
    return segments[segments.length - 1];
  } catch (_error) {
    const parts = String(value).split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }
};

const extractLibraryOpdsUrl = (entry: any) => {
  if (!entry) return "";
  if (entry?.opds_url) return entry.opds_url;
  if (entry?.opdsUrl) return entry.opdsUrl;
  if (entry?.opds2_url) return entry.opds2_url;
  if (entry?.opds2Url) return entry.opds2Url;
  if (Array.isArray(entry?.catalogs) && entry.catalogs.length > 0) {
    const catalog = entry.catalogs.find((item: any) => item?.href || item?.url);
    return catalog?.href || catalog?.url || "";
  }
  if (Array.isArray(entry?.links) && entry.links.length > 0) {
    const link = entry.links.find((item: any) =>
      String(item?.type || "").includes("opds")
    );
    return link?.href || "";
  }
  return "";
};

const extractLibraryShortName = (entry: any) => {
  const direct =
    entry?.short_name ||
    entry?.shortName ||
    entry?.metadata?.short_name ||
    entry?.metadata?.shortName ||
    "";
  const directValue = String(direct || "");
  if (directValue) return directValue;
  const opdsUrl = extractLibraryOpdsUrl(entry);
  return extractShortNameFromOpdsUrl(opdsUrl);
};

const deriveFeedBaseFromUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch (_error) {
    return "";
  }
};

export {
  deriveFeedBaseFromUrl,
  extractLibraryName,
  extractLibraryOpdsUrl,
  extractLibraryShortName,
  normalizeRegistryLibraries,
};
