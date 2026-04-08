import { useEffect, useRef, useState } from "react";
import StatusBanner from "./StatusBanner";

type Status = "idle" | "working" | "success" | "error";

type RegistryLibrary = {
  name: string;
  shortName?: string;
  opdsUrl?: string;
};

type RegistryPanelProps = {
  registryBase: string;
  setRegistryBase: (value: string) => void;
  libraryQuery: string;
  setLibraryQuery: (value: string) => void;
  registryStatus: Status;
  registryMessage: string;
  registryUpdatedAt: string;
  registryPages: number;
  registryCount: number;
  registryResults: RegistryLibrary[];
  selectedLibraryKey: string;
  onSyncRegistry: () => void;
  onClearRegistryCache: () => void;
  onSelectLibrary: (library: RegistryLibrary) => void;
  libraryShortName: string;
  setLibraryShortName: (value: string) => void;
  libraryOpdsUrl: string;
  setLibraryOpdsUrl: (value: string) => void;
  libraryFeedUrl: string;
  crawlableFeedUrl: string;
  crawlableMessage: string;
};

function RegistryPanel({
  registryBase,
  setRegistryBase,
  libraryQuery,
  setLibraryQuery,
  registryStatus,
  registryMessage,
  registryUpdatedAt,
  registryPages,
  registryCount,
  registryResults,
  selectedLibraryKey,
  onSyncRegistry,
  onClearRegistryCache,
  onSelectLibrary,
  libraryShortName,
  setLibraryShortName,
  libraryOpdsUrl,
  setLibraryOpdsUrl,
  libraryFeedUrl,
  crawlableFeedUrl,
  crawlableMessage,
}: RegistryPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!settingsOpen) return;
      const target = event.target as Node;
      if (panelRef.current && !panelRef.current.contains(target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Libraries</h2>
        </div>
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={() => setSettingsOpen((value) => !value)}
            aria-expanded={settingsOpen}
            aria-haspopup="dialog"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            Settings
          </button>
          {settingsOpen && (
            <div className="absolute right-0 z-30 mt-2 w-[min(26rem,90vw)] rounded-2xl border border-slate-300 bg-white p-4 text-sm shadow-[0_28px_50px_-24px_rgba(15,23,42,0.6)] ring-2 ring-slate-300/80">
              <div className="grid gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    Library Registry Index
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Sync the registry once, then search locally for your library.
                  </p>
                </div>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Registry base URL
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    value={registryBase}
                    onChange={(event) => setRegistryBase(event.target.value)}
                    placeholder="https://registry.palaceproject.io"
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    onClick={onSyncRegistry}
                    disabled={registryStatus === "working"}
                  >
                    {registryStatus === "working" ? "Updating..." : "Update libraries"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    onClick={onClearRegistryCache}
                  >
                    Clear cached libraries
                  </button>
                </div>
                <div className="text-xs text-slate-500">
                  {registryUpdatedAt
                    ? `Last synced: ${new Date(registryUpdatedAt).toLocaleString()}`
                    : "No registry cache yet."}
                  {registryStatus === "working" && (
                    <span className="ml-2">
                      Pages fetched: {registryPages} · Libraries indexed: {registryCount}
                    </span>
                  )}
                </div>
                <hr className="border-slate-200" />
                <p className="text-base font-semibold text-slate-900">Manual Entry</p>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Library short name
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    value={libraryShortName}
                    onChange={(event) => setLibraryShortName(event.target.value)}
                    placeholder="Lib2"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Library OPDS root URL (optional)
                  <input
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    value={libraryOpdsUrl}
                    onChange={(event) => setLibraryOpdsUrl(event.target.value)}
                    placeholder="http://localhost:8080/Lib2"
                  />
                </label>
                {crawlableMessage && (
                  <p className="text-xs text-rose-600">{crawlableMessage}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-6">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Library search
          <input
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Search by name"
          />
        </label>
      </div>

      <StatusBanner message={registryMessage} status={registryStatus} />
      {registryResults.length > 0 && (
        <div className="mt-4 grid gap-2">
          {registryResults.map((library) => {
            const key = `${library.name}-${library.shortName || ""}-${
              library.opdsUrl || ""
            }`;
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
                onClick={() => onSelectLibrary(library)}
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
          })}
        </div>
      )}
    </section>
  );
}

export default RegistryPanel;
