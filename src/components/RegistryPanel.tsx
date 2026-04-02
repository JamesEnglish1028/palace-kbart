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
  return (
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
            onClick={onSyncRegistry}
            disabled={registryStatus === "working"}
          >
            {registryStatus === "working" ? "Updating..." : "Update libraries"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={onClearRegistryCache}
          >
            Clear cached libraries
          </button>
        </div>
      </div>
      <div className="mt-3 text-xs text-slate-500">
        {registryUpdatedAt
          ? `Last synced: ${new Date(registryUpdatedAt).toLocaleString()}`
          : "No registry cache yet."}
        {registryStatus === "working" && (
          <span className="ml-2">
            Pages fetched: {registryPages} · Libraries indexed: {registryCount}
          </span>
        )}
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
            placeholder="http://localhost:8080/Lib2"
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
          <p className="text-xs text-rose-600">{crawlableMessage}</p>
        )}
      </div>
    </section>
  );
}

export default RegistryPanel;
