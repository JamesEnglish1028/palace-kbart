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
  onProgress?: (pagesFetched: number) => void;
};

const DEFAULT_KBART_HEADERS = [
  "title_id",
  "publication_title",
  "title_url",
  "first_author",
  "online_identifier",
  "publisher_name",
  "publication_type",
  "date_monograph_published_online",
  "first_editor",
  "access_type",
  "source_id",
  "source_id_type",
];

const fetchOpdsEntries = async (
  feedUrl: string,
  feedBase: string,
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

  if (nextHref) {
    const nextUrl = buildFeedRequestUrl(nextHref, feedBase);
    return fetchOpdsEntries(
      nextUrl,
      feedBase,
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
  onProgress,
}: ExportOptions) => {
  const collectionFeedUrl = buildFeedRequestUrl(collectionHref, feedBase);
  const displayUrl = buildFeedDisplayUrl(collectionHref, feedBase);
  const entries = await fetchOpdsEntries(
    collectionFeedUrl,
    feedBase,
    onProgress
  );

  const rows = entries
    .filter((entry) => isLikelyIdentifier(entry.identifier))
    .map((entry) => {
      const identifier = entry.identifier;
      const workIdentifier = identifierForWorkUrl(identifier);
      if (!workIdentifier) return null;
      const qualifiedIdentifier = encodeURIComponent(
        `${workIdentifier.type}/${workIdentifier.value}`
      );
      const worksUrl = `${baseUrl}/${libraryShortName}/works/${qualifiedIdentifier}`;
      const encodedLink = encodeURIComponent(worksUrl);
      const titleUrl = `${webClientUrl}/book/${encodedLink}`;

      return [
        identifier,
        entry.title,
        titleUrl,
        entry.authors,
        identifier,
        entry.publisher,
        "monograph",
        entry.published,
        entry.editors,
        "P",
        collectionName,
        identifySourceIdType(identifier),
      ];
    })
    .filter(Boolean) as string[][];

  return {
    csv: buildKbartCsv(rows),
    rowsCount: rows.length,
    displayUrl,
  };
};

export { exportKbart };
export type { ExportOptions };
