import StatusBanner from "./StatusBanner";

type Status = "idle" | "working" | "success" | "error";

type ExportPanelProps = {
  feedBaseOverride: string;
  setFeedBaseOverride: (value: string) => void;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  webClientUrl: string;
  setWebClientUrl: (value: string) => void;
  onExport: () => void;
  exportStatus: Status;
  exportMessage: string;
  exportPagesFetched: number;
  exportFeedUrl: string;
  webClientStatus: Status;
  webClientMessage: string;
  onAutoFillWebClient: () => void;
};

function ExportPanel({
  feedBaseOverride,
  setFeedBaseOverride,
  baseUrl,
  setBaseUrl,
  webClientUrl,
  setWebClientUrl,
  onExport,
  exportStatus,
  exportMessage,
  exportPagesFetched,
  exportFeedUrl,
  webClientStatus,
  webClientMessage,
  onAutoFillWebClient,
}: ExportPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Export KBART</h2>
      <p className="mt-2 text-sm text-slate-600">
        Configure the URLs used to build Palace reader links, then download a
        KBART CSV for the selected collection.
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
          onClick={onAutoFillWebClient}
          disabled={webClientStatus === "working"}
        >
          {webClientStatus === "working"
            ? "Finding web client..."
            : "Auto-fill web client URL"}
        </button>
        {webClientMessage && (
          <p
            className={`text-xs ${
              webClientStatus === "error" ? "text-rose-600" : "text-slate-500"
            }`}
          >
            {webClientMessage}
          </p>
        )}
        <button
          type="button"
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          onClick={onExport}
          disabled={exportStatus === "working"}
        >
          {exportStatus === "working"
            ? "Building KBART..."
            : "Download KBART CSV"}
        </button>
        {exportFeedUrl && (
          <p className="text-xs text-slate-500">Feed: {exportFeedUrl}</p>
        )}
        {exportStatus === "working" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            Pages fetched: {exportPagesFetched}
          </div>
        )}
        <StatusBanner message={exportMessage} status={exportStatus} />
      </div>
    </section>
  );
}

export default ExportPanel;
