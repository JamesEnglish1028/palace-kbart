import { useEffect, useState } from "react";

import {
  buildFeedDisplayUrl,
  buildFeedRequestUrl,
  collectOpdsLinks,
  identifySourceIdType,
  identifierForWorkUrl,
  isLikelyIdentifier,
  normalizeFeedUrl,
  parseOpds2Feed,
} from "./utils/opds";
import {
  deriveFeedBaseFromUrl,
  extractLibraryName,
  extractLibraryOpdsUrl,
  extractLibraryShortName,
  normalizeRegistryLibraries,
} from "./utils/registry";

const DEFAULT_FEED_BASE = import.meta.env.VITE_FEED_BASE || "/public";

const STATUS_IDLE = "idle";
const STATUS_WORKING = "working";
const STATUS_SUCCESS = "success";
const STATUS_ERROR = "error";
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

function App() {
  const [libraryShortName, setLibraryShortName] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryOpdsUrl, setLibraryOpdsUrl] = useState("");
  const [registryBase, setRegistryBase] = useState(
    import.meta.env.VITE_REGISTRY_BASE || "/registry/libraries"
  );
  const [registryLibraries, setRegistryLibraries] = useState([]);
  const [registryResults, setRegistryResults] = useState([]);
  const [selectedLibraryKey, setSelectedLibraryKey] = useState("");
  const [registryStatus, setRegistryStatus] = useState(STATUS_IDLE);
  const [registryMessage, setRegistryMessage] = useState("");
  const [registryPages, setRegistryPages] = useState(0);
  const [registryCount, setRegistryCount] = useState(0);
  const [registryUpdatedAt, setRegistryUpdatedAt] = useState("");

  const [collections, setCollections] = useState([]);
  const [collectionsStatus, setCollectionsStatus] = useState(STATUS_IDLE);
  const [collectionsMessage, setCollectionsMessage] = useState("");
  const [selectedCollectionHref, setSelectedCollectionHref] = useState("");
  const [libraryFeedUrl, setLibraryFeedUrl] = useState("");
  const [crawlableFeedUrl, setCrawlableFeedUrl] = useState("");
  const [crawlableMessage, setCrawlableMessage] = useState("");

  const [exportStatus, setExportStatus] = useState(STATUS_IDLE);
  const [exportMessage, setExportMessage] = useState("");
  const [exportCount, setExportCount] = useState(0);
  const [exportPagesFetched, setExportPagesFetched] = useState(0);
  const [exportFeedUrl, setExportFeedUrl] = useState("");
  const [webClientStatus, setWebClientStatus] = useState(STATUS_IDLE);
  const [webClientMessage, setWebClientMessage] = useState("");

  const [webClientUrl, setWebClientUrl] = useState(
    import.meta.env.VITE_WEB_CLIENT_URL || ""
  );
  const [baseUrl, setBaseUrl] = useState(
    import.meta.env.VITE_BASE_URL || ""
  );
  const [feedBaseOverride, setFeedBaseOverride] = useState(
    import.meta.env.VITE_FEED_BASE || ""
  );

  const feedBase = (feedBaseOverride || DEFAULT_FEED_BASE).replace(/\/$/, "");

  useEffect(() => {
    if (libraryShortName.trim()) {
      setCollections([]);
      setSelectedCollectionHref("");
      setCollectionsMessage("");
    }
  }, [libraryShortName]);

  useEffect(() => {
    const cached = localStorage.getItem("palaceRegistryCache");
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed?.libraries)) {
        setRegistryLibraries(parsed.libraries);
        setRegistryResults(parsed.libraries);
        setRegistryCount(parsed.libraries.length);
        if (parsed.updatedAt) {
          setRegistryUpdatedAt(parsed.updatedAt);
        }
      }
    } catch (_error) {
      // Ignore cache parsing errors.
    }
  }, []);

  const handleFetchCollections = async () => {
    setCollectionsStatus(STATUS_WORKING);
    setCollectionsMessage("");

    try {
      const fetchLibraryFeed = async (url) =>
        fetch(url, {
          method: "GET",
          credentials: "omit",
          headers: {
            Accept: "application/opds+json",
          },
        });

      let libraryUrl = "";
      let crawlableUrl = "";
      if (libraryOpdsUrl) {
        const trimmed = libraryOpdsUrl.replace(/\/+$/, "");
        libraryUrl = buildFeedRequestUrl(`${trimmed}/`, feedBase);
        crawlableUrl = buildFeedRequestUrl(`${trimmed}/crawlable`, feedBase);
      } else if (libraryShortName.trim()) {
        const basePath = `/${encodeURIComponent(libraryShortName.trim())}`;
        libraryUrl = buildFeedRequestUrl(`${basePath}/`, feedBase);
        crawlableUrl = buildFeedRequestUrl(`${basePath}/crawlable`, feedBase);
      } else {
        throw new Error("Enter a library short name or OPDS URL first.");
      }

      let response = await fetchLibraryFeed(libraryUrl);
      let effectiveUrl = libraryUrl;

      setCrawlableMessage("");
      if (
        response.status === 404 &&
        libraryOpdsUrl &&
        !libraryOpdsUrl.endsWith("/")
      ) {
        const withSlash = buildFeedRequestUrl(
          `${libraryOpdsUrl}/`,
          feedBase
        );
        const retry = await fetchLibraryFeed(withSlash);
        if (retry.ok) {
          response = retry;
          effectiveUrl = withSlash;
        }
      }

      if (!response.ok) {
        throw new Error(
          `Collections request failed with ${response.status} at ${effectiveUrl}`
        );
      }

      const data = await response.json();
      setLibraryFeedUrl(buildFeedDisplayUrl(effectiveUrl, feedBase));

      const extractFromFacets = (payload) => {
        if (!Array.isArray(payload?.facets) || payload.facets.length === 0) {
          return [];
        }
        const facetLinks = payload.facets.flatMap((facet) =>
          Array.isArray(facet?.links) ? facet.links : []
        );
        return facetLinks
          .filter((link) => link?.href && link?.title)
          .map((link) => ({
            name: link.title,
            href: link.href,
            publications: [],
          }));
      };

      const extractFromGroups = (payload) => {
        if (!Array.isArray(payload?.groups) || payload.groups.length === 0) {
          return [];
        }
        return payload.groups.map((group) => {
          const name =
            group?.metadata?.title ||
            group?.metadata?.name ||
            "Collection";
          const links = Array.isArray(group?.links) ? group.links : [];
          const bestLink =
            links.find((link) =>
              String(link?.rel || "").includes("collection")
            ) ||
            links.find((link) =>
              String(link?.rel || "").includes("subsection")
            ) ||
            links[0];
          return {
            name,
            href: bestLink?.href || "",
            publications: [],
          };
        });
      };

      let collectionItems = [];
      let crawlableData = null;
      if (crawlableUrl) {
        setCrawlableFeedUrl(buildFeedDisplayUrl(crawlableUrl, feedBase));
        const crawlableResponse = await fetchLibraryFeed(crawlableUrl);
        if (crawlableResponse.ok) {
          crawlableData = await crawlableResponse.json();
          collectionItems = extractFromFacets(crawlableData);
        } else {
          const text = await crawlableResponse.text();
          const snippet = text ? text.slice(0, 200) : "";
          setCrawlableMessage(
            `Crawlable feed failed with ${crawlableResponse.status}. ${snippet}`.trim()
          );
        }
      }
      if (collectionItems.length === 0) {
        collectionItems = extractFromGroups(data);
      }

      if (collectionItems.length === 0) {
        const links = collectOpdsLinks(data)
          .filter((link) => link?.href)
          .filter((link) => {
            const rel = String(link?.rel || "").toLowerCase();
            const href = String(link?.href || "");
            if (
              rel.includes("self") ||
              rel.includes("next") ||
              rel.includes("previous")
            ) {
              return false;
            }
            if (href.includes("/collections/")) return true;
            if (rel.includes("collection") || rel.includes("subsection"))
              return true;
            return Boolean(link?.title || link?.metadata?.title);
          })
          .map((link) => ({
            name: link?.title || link?.metadata?.title || link?.href,
            href: link?.href,
            publications: [],
          }))
          .filter((link) => link.name);
        collectionItems = links;
      }

      const deduped = [];
      const seen = new Set();
      collectionItems.forEach((link) => {
        const key = `${link.name}::${link.href}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(link);
        }
      });

      setCollections(deduped);
      if (deduped.length > 0) {
        setSelectedCollectionHref(deduped[0].href);
      }
      setCollectionsStatus(STATUS_SUCCESS);
      setCollectionsMessage(`Loaded ${deduped.length} collections.`);
      return;
    } catch (error) {
      setCollectionsStatus(STATUS_ERROR);
      setCollectionsMessage(error.message || "Unable to load collections.");
      return;
    }
  };

  const fetchOpdsEntries = async (feedUrl, accumulator = []) => {
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
    setExportPagesFetched((prev) => prev + 1);

    if (nextHref) {
      const nextUrl = buildFeedRequestUrl(nextHref, feedBase);
      return fetchOpdsEntries(nextUrl, accumulator);
    }
    return accumulator;
  };

  const handleExport = async () => {
    setExportStatus(STATUS_WORKING);
    setExportMessage("");
    setExportCount(0);
    setExportPagesFetched(0);
    setExportFeedUrl("");

    try {
      const collection = collections.find(
        (item) => item.href === selectedCollectionHref
      );
      if (!collection) {
        throw new Error("Select a collection to export.");
      }
      if (!webClientUrl.trim() || !baseUrl.trim()) {
        throw new Error("Load the web client and base URLs before exporting.");
      }
      const collectionFeedUrl = buildFeedRequestUrl(
        collection.href,
        feedBase
      );
      const displayUrl = buildFeedDisplayUrl(collection.href, feedBase);
      setExportFeedUrl(displayUrl);
      const entries = await fetchOpdsEntries(collectionFeedUrl, []);
      setExportCount(entries.length);

      const rows = entries
        .filter((entry) => isLikelyIdentifier(entry.identifier))
        .map((entry) => {
          const identifier = entry.identifier;
          const workIdentifier = identifierForWorkUrl(identifier);
          if (!workIdentifier) return null;
          const qualifiedIdentifier = encodeURIComponent(
            `${workIdentifier.type}/${workIdentifier.value}`
          );
          const worksUrl = `${baseUrl}/${libraryShortName.trim()}/works/${qualifiedIdentifier}`;
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
            collection.name,
            identifySourceIdType(identifier),
          ];
        })
        .filter(Boolean);

      const csv =
        [DEFAULT_KBART_HEADERS, ...rows]
          .map((row) =>
            row
              .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\n") + "\n";

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${collection.name}-kbart.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setExportStatus(STATUS_SUCCESS);
      setExportMessage(
        `Exported ${rows.length} rows for ${collection.name}.`
      );
    } catch (error) {
      setExportStatus(STATUS_ERROR);
      setExportMessage(error.message || "Export failed.");
    }
  };

  const crawlRegistry = async (startUrl, accumulator = []) => {
    const response = await fetch(startUrl, {
      method: "GET",
      headers: {
        Accept: "application/json, application/opds+json",
      },
    });
    if (!response.ok) {
      throw new Error(`Registry request failed with ${response.status}`);
    }
    const data = await response.json();
    const items = normalizeRegistryLibraries(data).map((entry) => {
      const name = extractLibraryName(entry);
      const shortName = extractLibraryShortName(entry);
      const opdsUrl = extractLibraryOpdsUrl(entry);
      return {
        name,
        shortName,
        opdsUrl,
      };
    });
    items.forEach((item) => accumulator.push(item));
    setRegistryPages((prev) => prev + 1);
    setRegistryCount(accumulator.length);

    const links = collectOpdsLinks(data);
    const next = links.find((link) => String(link?.rel || "").includes("next"));
    if (next?.href) {
      const nextUrl = normalizeFeedUrl(next.href, startUrl);
      return crawlRegistry(nextUrl, accumulator);
    }
    return accumulator;
  };

  const handleSyncRegistry = async () => {
    setRegistryStatus(STATUS_WORKING);
    setRegistryMessage("");
    setRegistryResults([]);
    setRegistryPages(0);
    setRegistryCount(0);

    try {
      if (!registryBase.trim()) {
        throw new Error("Enter a registry base URL to sync.");
      }
      const normalizedRegistryBase = registryBase.replace(/\/$/, "");
      const startUrl = normalizedRegistryBase.endsWith("/libraries")
        ? normalizedRegistryBase
        : `${normalizedRegistryBase}/libraries`;
      const libraries = await crawlRegistry(startUrl, []);
      const deduped = [];
      const seen = new Set();
      libraries.forEach((library) => {
        const key = `${library.name}-${library.shortName || ""}-${library.opdsUrl || ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(library);
        }
      });
      const updatedAt = new Date().toISOString();
      setRegistryLibraries(deduped);
      setRegistryResults(deduped);
      setRegistryStatus(STATUS_SUCCESS);
      setRegistryMessage(`Indexed ${deduped.length} libraries.`);
      setRegistryUpdatedAt(updatedAt);
      localStorage.setItem(
        "palaceRegistryCache",
        JSON.stringify({ libraries: deduped, updatedAt })
      );
    } catch (error) {
      setRegistryStatus(STATUS_ERROR);
      setRegistryMessage(error.message || "Registry sync failed.");
    }
  };

  useEffect(() => {
    if (!libraryQuery.trim()) {
      setRegistryResults([]);
      return;
    }
    const query = libraryQuery.trim().toLowerCase();
    setRegistryResults(
      registryLibraries.filter((library) => {
        const name = String(library.name || "").toLowerCase();
        const shortName = String(library.shortName || "").toLowerCase();
        return name.includes(query) || shortName.includes(query);
      })
    );
  }, [libraryQuery, registryLibraries]);

  const handleSelectLibrary = (library) => {
    if (!library) return;
    const key = `${library.name}-${library.shortName || ""}-${library.opdsUrl || ""}`;
    setSelectedLibraryKey(key);
    if (library.shortName) {
      setLibraryShortName(library.shortName);
    }
    if (library.opdsUrl) {
      setLibraryOpdsUrl(library.opdsUrl);
      const derived = deriveFeedBaseFromUrl(library.opdsUrl);
      if (derived) {
        setFeedBaseOverride(derived);
        setBaseUrl(derived);
      }
    }
    if (library.name) {
      void autoFillWebClientUrl(library.name, library.shortName || "");
    }
  };

  const autoFillWebClientUrl = async (libraryName, shortName) => {
    try {
      setWebClientStatus(STATUS_WORKING);
      setWebClientMessage("");
      const response = await fetch(
        `/web-proxy?url=${encodeURIComponent(
          "https://patron-academic.thepalaceproject.org/"
        )}`,
        {
          method: "GET",
          credentials: "omit",
        }
      );
      if (!response.ok) {
        setWebClientStatus(STATUS_ERROR);
        setWebClientMessage(
          `Web client lookup failed with ${response.status}.`
        );
        return;
      }
      const html = await response.text();
      const matches = Array.from(html.matchAll(/href="\/([^"]+)"/g)).map(
        (match) => match[1]
      );
      const unique = Array.from(new Set(matches)).filter(Boolean);
      const slugCandidates = unique.map((slug) => ({
        slug,
        lower: slug.toLowerCase(),
      }));

      const normalizedName = String(libraryName || "").toLowerCase();
      const normalizedShort = String(shortName || "").toLowerCase();
      const exact =
        slugCandidates.find((item) => item.lower === normalizedShort) ||
        slugCandidates.find((item) => item.lower === normalizedName);
      if (exact) {
        setWebClientUrl(
          `https://patron-academic.thepalaceproject.org/${exact.slug}`
        );
        setWebClientStatus(STATUS_SUCCESS);
        setWebClientMessage(`Matched ${exact.slug}.`);
        return;
      }

      const contains =
        slugCandidates.find(
          (item) =>
            normalizedShort && item.lower.includes(normalizedShort)
        ) ||
        slugCandidates.find(
          (item) => normalizedName && item.lower.includes(normalizedName)
        );
      if (contains) {
        setWebClientUrl(
          `https://patron-academic.thepalaceproject.org/${contains.slug}`
        );
        setWebClientStatus(STATUS_SUCCESS);
        setWebClientMessage(`Matched ${contains.slug}.`);
        return;
      }
      setWebClientStatus(STATUS_ERROR);
      setWebClientMessage("No matching web client URL found.");
    } catch (_error) {
      setWebClientStatus(STATUS_ERROR);
      setWebClientMessage("Web client lookup failed.");
    }
  };

  const handleClearRegistryCache = () => {
    localStorage.removeItem("palaceRegistryCache");
    setRegistryLibraries([]);
    setRegistryResults([]);
    setRegistryUpdatedAt("");
    setRegistryMessage("Cleared cached registry data.");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:max-w-5xl">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
                <img
                  src="/palace-logo.png"
                  alt="Palace"
                  className="h-6 w-6"
                />
                <span>Palace Manager Tooling</span>
              </div>
              <h1 className="mt-3 text-4xl font-semibold text-slate-900 md:text-5xl">
                Palace KBART Exporter
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-600">
                Download KBART reports from Palace Manager collections with
                Palace Web Catalog URLs.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
              <p className="font-semibold">Connections</p>
              <p className="mt-1">`/cm` → localhost:6500</p>
              <p className="mt-1">`/public` → localhost:8080</p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            Library Registry Index
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Sync the registry once, then search locally for your library.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-[1.2fr_1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Registry base URL
              <input
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                value={registryBase}
                onChange={(event) => setRegistryBase(event.target.value)}
                placeholder="https://registry.palaceproject.io"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Library search
              <input
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
                placeholder="Search by name"
              />
            </label>
            <div className="grid gap-2">
              <button
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={handleSyncRegistry}
                disabled={registryStatus === STATUS_WORKING}
              >
                {registryStatus === STATUS_WORKING
                  ? "Updating..."
                  : "Update libraries"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={handleClearRegistryCache}
              >
                Clear cached libraries
              </button>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {registryUpdatedAt
              ? `Last synced: ${new Date(registryUpdatedAt).toLocaleString()}`
              : "No registry cache yet."}
            {registryStatus === STATUS_WORKING && (
              <span className="ml-2">
                Pages fetched: {registryPages} · Libraries indexed: {registryCount}
              </span>
            )}
          </div>
          {registryMessage && (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                registryStatus === STATUS_ERROR
                  ? "border border-rose-200 bg-rose-50 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {registryMessage}
            </div>
          )}
          {registryResults.length > 0 && (
            <div className="mt-4 grid gap-2">
              {registryResults.map((library) => (
                (() => {
                  const key = `${library.name}-${library.shortName || ""}-${library.opdsUrl || ""}`;
                  const isSelected = selectedLibraryKey === key;
                  return (
                <button
                  key={key}
                  type="button"
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                  onClick={() => handleSelectLibrary(library)}
                >
                  <span>
                    <span className="font-semibold">{library.name}</span>
                    {library.shortName && (
                      <span className="ml-2 text-xs text-slate-500">
                        {library.shortName}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isSelected ? "text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select"}
                  </span>
                </button>
                  );
                })()
              ))}
            </div>
          )}
          <div className="mt-6 grid gap-3 text-sm font-medium text-slate-700">
            <label className="grid gap-2">
              Library short name
              <input
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                value={libraryShortName}
                onChange={(event) => setLibraryShortName(event.target.value)}
                placeholder="Lib2"
              />
            </label>
            <label className="grid gap-2">
              Library OPDS root URL (optional)
              <input
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                value={libraryOpdsUrl}
                onChange={(event) => setLibraryOpdsUrl(event.target.value)}
                placeholder="http://localhost:8080/Lib2/crawlable"
              />
            </label>
            {libraryFeedUrl && (
              <p className="text-xs text-slate-500">
                Using OPDS root: {libraryFeedUrl}
              </p>
            )}
            {crawlableFeedUrl && (
              <p className="text-xs text-slate-500">
                Crawlable feed: {crawlableFeedUrl}
              </p>
            )}
            {crawlableMessage && (
              <p className="text-xs text-rose-600">
                {crawlableMessage}
              </p>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-slate-900">
                Collections
              </h2>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={handleFetchCollections}
                disabled={collectionsStatus === STATUS_WORKING}
              >
                {collectionsStatus === STATUS_WORKING
                  ? "Loading..."
                  : "Load collections"}
              </button>
            </div>
            {collectionsMessage && (
              <div
                className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                  collectionsStatus === STATUS_ERROR
                    ? "border border-rose-200 bg-rose-50 text-rose-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {collectionsMessage}
              </div>
            )}
            <div className="mt-6 grid gap-3">
              {collections.map((collection) => (
                <label
                  key={`${collection.name}-${collection.href}`}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                    selectedCollectionHref === collection.href
                      ? "border-blue-600 bg-white"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                    <span className="font-semibold">{collection.name}</span>
                  <input
                    type="radio"
                    name="collection"
                    className="h-4 w-4"
                    checked={selectedCollectionHref === collection.href}
                    onChange={() =>
                      setSelectedCollectionHref(collection.href)
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">
              Export KBART
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Configure the URLs used to build Palace reader links, then
              download a KBART CSV for the selected collection.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                OPDS feed base URL
                <input
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  value={feedBaseOverride}
                  onChange={(event) => setFeedBaseOverride(event.target.value)}
                  placeholder="http://localhost:8080"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Palace base URL (CM)
                <input
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="http://localhost:8080"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Palace web client URL
                <input
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  value={webClientUrl}
                  onChange={(event) => setWebClientUrl(event.target.value)}
                  placeholder="http://localhost:3000"
                />
              </label>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={() =>
                  autoFillWebClientUrl(libraryQuery || "", libraryShortName)
                }
                disabled={webClientStatus === STATUS_WORKING}
              >
                {webClientStatus === STATUS_WORKING
                  ? "Finding web client..."
                  : "Auto-fill web client URL"}
              </button>
              {webClientMessage && (
                <p
                  className={`text-xs ${
                    webClientStatus === STATUS_ERROR
                      ? "text-rose-600"
                      : "text-slate-500"
                  }`}
                >
                  {webClientMessage}
                </p>
              )}
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                onClick={handleExport}
                disabled={exportStatus === STATUS_WORKING}
              >
                {exportStatus === STATUS_WORKING
                  ? "Building KBART..."
                  : "Download KBART CSV"}
              </button>
              {exportFeedUrl && (
                <p className="text-xs text-slate-500">
                  Feed: {exportFeedUrl}
                </p>
              )}
              {exportStatus === STATUS_WORKING && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Pages fetched: {exportPagesFetched}
                </div>
              )}
              {exportMessage && (
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    exportStatus === STATUS_ERROR
                      ? "border border-rose-200 bg-rose-50 text-rose-700"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {exportMessage}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
