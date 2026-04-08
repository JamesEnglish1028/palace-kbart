import { useState } from "react";
import StatusBanner from "./StatusBanner";

type Status = "idle" | "working" | "success" | "error";

type ExportPanelProps = {
  feedBaseOverride: string;
  setFeedBaseOverride: (value: string) => void;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  webClientUrl: string;
  setWebClientUrl: (value: string) => void;
  fromDate: string;
  setFromDate: (value: string) => void;
  onExport: () => void;
  exportStatus: Status;
  exportMessage: string;
  exportPagesFetched: number;
  exportFeedUrl: string;
  enrichIsbn: boolean;
  setEnrichIsbn: (value: boolean) => void;
  isbnSource: "openlibrary" | "loc";
  setIsbnSource: (value: "openlibrary" | "loc") => void;
  locEstimate: string;
  marcCount: number;
  marcFromDate: string;
  setMarcFromDate: (value: string) => void;
  marcFormat: "marc21" | "marcxml";
  setMarcFormat: (value: "marc21" | "marcxml") => void;
  onExportMarc: () => void;
  marcStatus: Status;
  marcMessage: string;
  marcPagesFetched: number;
  marcFeedUrl: string;
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
  fromDate,
  setFromDate,
  onExport,
  exportStatus,
  exportMessage,
  exportPagesFetched,
  exportFeedUrl,
  enrichIsbn,
  setEnrichIsbn,
  isbnSource,
  setIsbnSource,
  locEstimate,
  marcCount,
  marcFromDate,
  setMarcFromDate,
  marcFormat,
  setMarcFormat,
  onExportMarc,
  marcStatus,
  marcMessage,
  marcPagesFetched,
  marcFeedUrl,
  webClientStatus,
  webClientMessage,
  onAutoFillWebClient,
}: ExportPanelProps) {
  const [activeTab, setActiveTab] = useState<"kbart" | "marc">("kbart");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Export</h2>
          <p className="mt-2 text-sm text-slate-600">
            Choose a format, then configure the URLs used to build Palace reader
            links for the selected collection.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-300 bg-slate-200/80 p-2 shadow-inner">
          <button
            type="button"
            className={`rounded-xl border px-5 py-2 text-sm font-semibold transition ${
              activeTab === "kbart"
                ? "border-slate-300 bg-white text-slate-900 shadow-md"
                : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("kbart")}
          >
            KBART
          </button>
          <button
            type="button"
            className={`rounded-xl border px-5 py-2 text-sm font-semibold transition ${
              activeTab === "marc"
                ? "border-slate-300 bg-white text-slate-900 shadow-md"
                : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-900"
            }`}
            onClick={() => setActiveTab("marc")}
          >
            MARC
          </button>
        </div>
        <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View base URLs
          </summary>
          <div className="mt-3 grid gap-3">
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
                  webClientStatus === "error"
                    ? "text-rose-600"
                    : "text-slate-500"
                }`}
              >
                {webClientMessage}
              </p>
            )}
          </div>
        </details>

        {activeTab === "kbart" && (
          <div className="grid gap-3">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              From date (modified on/after)
              <input
                type="date"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
              />
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 text-emerald-600"
                checked={enrichIsbn}
                onChange={(event) => setEnrichIsbn(event.target.checked)}
              />
              <span>Enrich missing ISBNs (slower).</span>
            </label>
            {enrichIsbn && (
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                ISBN source
                <select
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  value={isbnSource}
                  onChange={(event) =>
                    setIsbnSource(event.target.value as "openlibrary" | "loc")
                  }
                >
                  <option value="openlibrary">Open Library (recommended)</option>
                  <option value="loc">Library of Congress (slow)</option>
                </select>
              </label>
            )}
            {locEstimate && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                {locEstimate}
              </div>
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
        )}
        {activeTab === "marc" && (
          <div className="grid gap-3">
            <fieldset className="grid gap-3 text-sm font-medium text-slate-700">
              <legend>Output format</legend>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <input
                  type="radio"
                  name="marc-format"
                  value="marc21"
                  checked={marcFormat === "marc21"}
                  onChange={() => setMarcFormat("marc21")}
                  className="h-4 w-4 text-emerald-600"
                />
                <span className="text-slate-800">MARC21 (ISO 2709)</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <input
                  type="radio"
                  name="marc-format"
                  value="marcxml"
                  checked={marcFormat === "marcxml"}
                  onChange={() => setMarcFormat("marcxml")}
                  className="h-4 w-4 text-emerald-600"
                />
                <span className="text-slate-800">MARCXML</span>
              </label>
            </fieldset>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              As of date (modified on/after)
              <input
                type="date"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                value={marcFromDate}
                onChange={(event) => setMarcFromDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              onClick={onExportMarc}
              disabled={marcStatus === "working"}
            >
              {marcStatus === "working"
                ? "Building MARC..."
                : "Download MARC"}
            </button>
            {marcFeedUrl && (
              <p className="text-xs text-slate-500">Feed: {marcFeedUrl}</p>
            )}
            {marcStatus === "success" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                Records exported: {marcCount}
              </div>
            )}
            {marcStatus === "working" && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Pages fetched: {marcPagesFetched}
              </div>
            )}
            <StatusBanner message={marcMessage} status={marcStatus} />
          </div>
        )}
      </div>
    </section>
  );
}

export default ExportPanel;
