import { useEffect, useState } from "react";
import {
  extractLibraryName,
  extractLibraryOpdsUrl,
  extractLibraryShortName,
  normalizeRegistryLibraries,
} from "../utils/registry";
import { collectOpdsLinks, normalizeFeedUrl } from "../utils/opds";

type Status = "idle" | "working" | "success" | "error";

type RegistryLibrary = {
  name: string;
  shortName?: string;
  opdsUrl?: string;
};

type RegistryState = {
  registryBase: string;
  setRegistryBase: (value: string) => void;
  libraryQuery: string;
  setLibraryQuery: (value: string) => void;
  registryLibraries: RegistryLibrary[];
  registryResults: RegistryLibrary[];
  registryStatus: Status;
  registryMessage: string;
  registryPages: number;
  registryCount: number;
  registryUpdatedAt: string;
  syncRegistry: () => void;
  clearRegistryCache: () => void;
};

const CACHE_KEY = "palaceRegistryCache";

function useRegistrySync(initialRegistryBase: string): RegistryState {
  const [registryBase, setRegistryBase] = useState(initialRegistryBase);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [registryLibraries, setRegistryLibraries] = useState<RegistryLibrary[]>(
    []
  );
  const [registryResults, setRegistryResults] = useState<RegistryLibrary[]>([]);
  const [registryStatus, setRegistryStatus] = useState<Status>("idle");
  const [registryMessage, setRegistryMessage] = useState("");
  const [registryPages, setRegistryPages] = useState(0);
  const [registryCount, setRegistryCount] = useState(0);
  const [registryUpdatedAt, setRegistryUpdatedAt] = useState("");

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed?.libraries)) {
        setRegistryLibraries(parsed.libraries);
        setRegistryCount(parsed.libraries.length);
        if (parsed.updatedAt) {
          setRegistryUpdatedAt(parsed.updatedAt);
        }
      }
    } catch (_error) {
      // Ignore cache parsing errors.
    }
  }, []);

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

  const REGISTRY_PROXY_BASE =
    (import.meta as ImportMeta).env?.VITE_REGISTRY_PROXY_BASE ||
    (import.meta as ImportMeta).env?.VITE_OPDS_PROXY_BASE ||
    "/registry-proxy";

  const buildRegistryUrl = (url: string) => {
    if (!url) return url;
    if (!REGISTRY_PROXY_BASE) return url;
    if (!/^https?:\/\//i.test(url)) return url;
    const joiner = REGISTRY_PROXY_BASE.includes("?") ? "&" : "?";
    return `${REGISTRY_PROXY_BASE}${joiner}url=${encodeURIComponent(url)}`;
  };

  const crawlRegistry = async (
    startUrl: string,
    accumulator: RegistryLibrary[]
  ): Promise<RegistryLibrary[]> => {
    const response = await fetch(buildRegistryUrl(startUrl), {
      method: "GET",
      headers: {
        Accept: "application/json, application/opds+json",
      },
    });
    if (!response.ok) {
      throw new Error(`Registry request failed with ${response.status}`);
    }
    const data = await response.json();
    const items = normalizeRegistryLibraries(data).map((entry: unknown) => {
      const name = extractLibraryName(entry);
      const shortName = extractLibraryShortName(entry);
      const opdsUrl = extractLibraryOpdsUrl(entry);
      return {
        name,
        shortName,
        opdsUrl,
      };
    });
    items.forEach((item: RegistryLibrary) => accumulator.push(item));
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

  const syncRegistry = async () => {
    setRegistryStatus("working");
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
      const deduped: RegistryLibrary[] = [];
      const seen = new Set<string>();
      libraries.forEach((library) => {
        const key = `${library.name}-${library.shortName || ""}-${
          library.opdsUrl || ""
        }`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(library);
        }
      });
      const updatedAt = new Date().toISOString();
      setRegistryLibraries(deduped);
      setRegistryStatus("success");
      setRegistryMessage(`Indexed ${deduped.length} libraries.`);
      setRegistryUpdatedAt(updatedAt);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ libraries: deduped, updatedAt })
      );
    } catch (error) {
      setRegistryStatus("error");
      setRegistryMessage(
        error instanceof Error ? error.message : "Registry sync failed."
      );
    }
  };

  const clearRegistryCache = () => {
    localStorage.removeItem(CACHE_KEY);
    setRegistryLibraries([]);
    setRegistryResults([]);
    setRegistryUpdatedAt("");
    setRegistryMessage("Cleared cached registry data.");
  };

  return {
    registryBase,
    setRegistryBase,
    libraryQuery,
    setLibraryQuery,
    registryLibraries,
    registryResults,
    registryStatus,
    registryMessage,
    registryPages,
    registryCount,
    registryUpdatedAt,
    syncRegistry,
    clearRegistryCache,
  };
}

export type { RegistryLibrary, Status };
export default useRegistrySync;
