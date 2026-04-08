import { useEffect, useState } from "react";

import CollectionsPanel from "./components/CollectionsPanel";
import ExportPanel from "./components/ExportPanel";
import RegistryPanel from "./components/RegistryPanel";
import useRegistrySync, { RegistryLibrary, Status } from "./hooks/useRegistrySync";
import {
  buildFeedDisplayUrl,
  buildFeedRequestUrl,
  collectOpdsLinks,
} from "./utils/opds";
import type { OpdsFeed } from "./types/opds";
import { deriveFeedBaseFromUrl } from "./utils/registry";
import { exportKbart } from "./services/exporter";
import { exportMarc } from "./services/marcExporter";

const DEFAULT_FEED_BASE = import.meta.env.VITE_FEED_BASE || "/public";
const WEB_PROXY_BASE = import.meta.env.VITE_WEB_PROXY_BASE || "/web-proxy";

const STATUS_IDLE: Status = "idle";
const STATUS_WORKING: Status = "working";
const STATUS_SUCCESS: Status = "success";
const STATUS_ERROR: Status = "error";

type CollectionItem = {
  name: string;
  href: string;
};

function App() {
  const [libraryShortName, setLibraryShortName] = useState("");
  const [libraryOpdsUrl, setLibraryOpdsUrl] = useState("");
  const [selectedLibraryKey, setSelectedLibraryKey] = useState("");

  const {
    registryBase,
    setRegistryBase,
    libraryQuery,
    setLibraryQuery,
    registryResults,
    registryStatus,
    registryMessage,
    registryPages,
    registryCount,
    registryUpdatedAt,
    syncRegistry,
    clearRegistryCache,
  } = useRegistrySync(import.meta.env.VITE_REGISTRY_BASE || "/registry/libraries");

  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [collectionsStatus, setCollectionsStatus] = useState<Status>(STATUS_IDLE);
  const [collectionsMessage, setCollectionsMessage] = useState("");
  const [selectedCollectionHref, setSelectedCollectionHref] = useState("");
  const [libraryFeedUrl, setLibraryFeedUrl] = useState("");
  const [crawlableFeedUrl, setCrawlableFeedUrl] = useState("");
  const [crawlableMessage, setCrawlableMessage] = useState("");

  const [exportStatus, setExportStatus] = useState<Status>(STATUS_IDLE);
  const [exportMessage, setExportMessage] = useState("");
  const [exportCount, setExportCount] = useState(0);
  const [exportPagesFetched, setExportPagesFetched] = useState(0);
  const [exportFeedUrl, setExportFeedUrl] = useState("");
  const [marcFormat, setMarcFormat] = useState<"marc21" | "marcxml">("marc21");
  const [marcFromDate, setMarcFromDate] = useState("");
  const [marcStatus, setMarcStatus] = useState<Status>(STATUS_IDLE);
  const [marcMessage, setMarcMessage] = useState("");
  const [marcPagesFetched, setMarcPagesFetched] = useState(0);
  const [marcFeedUrl, setMarcFeedUrl] = useState("");
  const [marcCount, setMarcCount] = useState(0);

  const [webClientUrl, setWebClientUrl] = useState(
    import.meta.env.VITE_WEB_CLIENT_URL || ""
  );
  const [baseUrl, setBaseUrl] = useState(import.meta.env.VITE_BASE_URL || "");
  const [feedBaseOverride, setFeedBaseOverride] = useState(
    import.meta.env.VITE_FEED_BASE || ""
  );
  const [fromDate, setFromDate] = useState("");
  const [webClientStatus, setWebClientStatus] = useState<Status>(STATUS_IDLE);
  const [webClientMessage, setWebClientMessage] = useState("");

  const feedBase = (feedBaseOverride || DEFAULT_FEED_BASE).replace(/\/$/, "");

  useEffect(() => {
    if (libraryShortName.trim()) {
      setCollections([]);
      setSelectedCollectionHref("");
      setCollectionsMessage("");
    }
  }, [libraryShortName]);

  const handleFetchCollections = async () => {
    setCollectionsStatus(STATUS_WORKING);
    setCollectionsMessage("");

    try {
      const fetchLibraryFeed = async (url: string) =>
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

      const data = (await response.json()) as OpdsFeed;
      setLibraryFeedUrl(buildFeedDisplayUrl(effectiveUrl, feedBase));

      const extractFromFacets = (payload: OpdsFeed) => {
        if (!Array.isArray(payload?.facets) || payload.facets.length === 0) {
          return [] as CollectionItem[];
        }
        const facetLinks = payload.facets.flatMap((facet) =>
          Array.isArray(facet?.links) ? facet.links : []
        );
        return facetLinks
          .map((link) => ({
            name: link?.title || "",
            href: link?.href || "",
          }))
          .filter((link) => link.name && link.href);
      };

      const extractFromGroups = (payload: OpdsFeed) => {
        if (!Array.isArray(payload?.groups) || payload.groups.length === 0) {
          return [] as CollectionItem[];
        }
        return payload.groups
          .map((group) => {
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
          };
        })
          .filter((item) => item.href);
      };

      let collectionItems: CollectionItem[] = [];
      if (crawlableUrl) {
        setCrawlableFeedUrl(buildFeedDisplayUrl(crawlableUrl, feedBase));
        const crawlableResponse = await fetchLibraryFeed(crawlableUrl);
        if (crawlableResponse.ok) {
          const crawlableData = (await crawlableResponse.json()) as OpdsFeed;
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
            name: link?.title || link?.metadata?.title || link?.href || "",
            href: link?.href || "",
          }))
          .filter((link) => link.name && link.href);
        collectionItems = links;
      }

      const deduped: CollectionItem[] = [];
      const seen = new Set<string>();
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
    } catch (error) {
      setCollectionsStatus(STATUS_ERROR);
      setCollectionsMessage(
        error instanceof Error ? error.message : "Unable to load collections."
      );
    }
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
      const { csv, rowsCount, displayUrl } = await exportKbart({
        libraryShortName: libraryShortName.trim(),
        collectionName: collection.name,
        collectionHref: collection.href,
        feedBase,
        baseUrl,
        webClientUrl,
        fromDate,
        onProgress: (pages) => setExportPagesFetched(pages),
      });
      setExportFeedUrl(displayUrl);
      setExportCount(rowsCount);

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
      setExportMessage(`Exported ${rowsCount} rows for ${collection.name}.`);
    } catch (error) {
      setExportStatus(STATUS_ERROR);
      setExportMessage(
        error instanceof Error ? error.message : "Export failed."
      );
    }
  };

  const handleExportMarc = async () => {
    setMarcStatus(STATUS_WORKING);
    setMarcMessage("");
    setMarcPagesFetched(0);
    setMarcFeedUrl("");
    setMarcCount(0);

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

      const { data, recordsCount, displayUrl, format } = await exportMarc({
        libraryShortName: libraryShortName.trim(),
        collectionName: collection.name,
        collectionHref: collection.href,
        feedBase,
        baseUrl,
        webClientUrl,
        fromDate: marcFromDate,
        format: marcFormat,
        onProgress: (pages) => setMarcPagesFetched(pages),
      });

      setMarcFeedUrl(displayUrl);
      setMarcCount(recordsCount);

      const mimeType =
        format === "marcxml"
          ? "application/xml;charset=utf-8;"
          : "application/marc";
      const extension = format === "marcxml" ? "xml" : "mrc";
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${collection.name}-marc.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setMarcStatus(STATUS_SUCCESS);
      setMarcMessage(`Exported ${recordsCount} records for ${collection.name}.`);
    } catch (error) {
      setMarcStatus(STATUS_ERROR);
      setMarcMessage(
        error instanceof Error ? error.message : "MARC export failed."
      );
    }
  };

  const autoFillWebClientUrl = async (
    libraryName: string,
    shortName: string
  ) => {
    try {
      setWebClientStatus(STATUS_WORKING);
      setWebClientMessage("");
      const response = await fetch(
        `${WEB_PROXY_BASE}${
          WEB_PROXY_BASE.includes("?") ? "&" : "?"
        }url=${encodeURIComponent(
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
          (item) => normalizedShort && item.lower.includes(normalizedShort)
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

  const handleSelectLibrary = (library: RegistryLibrary) => {
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

  const handleClearRegistryCache = () => {
    clearRegistryCache();
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
                KBART, MARC Exporter
              </h1>
              <p className="mt-3 max-w-2xl text-base text-slate-600">
                Download KBART Holdings and MARC Bibliographic records for
                Palace Manager collections.
              </p>
            </div>          </div>
        </header>

        <RegistryPanel
          registryBase={registryBase}
          setRegistryBase={setRegistryBase}
          libraryQuery={libraryQuery}
          setLibraryQuery={setLibraryQuery}
          registryStatus={registryStatus}
          registryMessage={registryMessage}
          registryUpdatedAt={registryUpdatedAt}
          registryPages={registryPages}
          registryCount={registryCount}
          registryResults={registryResults}
          selectedLibraryKey={selectedLibraryKey}
          onSyncRegistry={syncRegistry}
          onClearRegistryCache={handleClearRegistryCache}
          onSelectLibrary={handleSelectLibrary}
          libraryShortName={libraryShortName}
          setLibraryShortName={setLibraryShortName}
          libraryOpdsUrl={libraryOpdsUrl}
          setLibraryOpdsUrl={setLibraryOpdsUrl}
          libraryFeedUrl={libraryFeedUrl}
          crawlableFeedUrl={crawlableFeedUrl}
          crawlableMessage={crawlableMessage}
        />

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <CollectionsPanel
            collections={collections}
            collectionsStatus={collectionsStatus}
            collectionsMessage={collectionsMessage}
            selectedCollectionHref={selectedCollectionHref}
            onSelectCollection={setSelectedCollectionHref}
            onLoadCollections={handleFetchCollections}
          />

          <ExportPanel
            feedBaseOverride={feedBaseOverride}
            setFeedBaseOverride={setFeedBaseOverride}
            baseUrl={baseUrl}
            setBaseUrl={setBaseUrl}
            webClientUrl={webClientUrl}
            setWebClientUrl={setWebClientUrl}
            fromDate={fromDate}
            setFromDate={setFromDate}
            onExport={handleExport}
            exportStatus={exportStatus}
            exportMessage={exportMessage}
            exportPagesFetched={exportPagesFetched}
            exportFeedUrl={exportFeedUrl}
            marcCount={marcCount}
            marcFromDate={marcFromDate}
            setMarcFromDate={setMarcFromDate}
            marcFormat={marcFormat}
            setMarcFormat={setMarcFormat}
            onExportMarc={handleExportMarc}
            marcStatus={marcStatus}
            marcMessage={marcMessage}
            marcPagesFetched={marcPagesFetched}
            marcFeedUrl={marcFeedUrl}
            webClientStatus={webClientStatus}
            webClientMessage={webClientMessage}
            onAutoFillWebClient={() =>
              autoFillWebClientUrl(libraryQuery || "", libraryShortName)
            }
          />
        </div>
      </div>
    </div>
  );
}

export default App;
