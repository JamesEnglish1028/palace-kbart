import StatusBanner from "./StatusBanner";

type Status = "idle" | "working" | "success" | "error";

type CollectionItem = {
  name: string;
  href: string;
};

type CollectionsPanelProps = {
  collections: CollectionItem[];
  collectionsStatus: Status;
  collectionsMessage: string;
  selectedCollectionHref: string;
  onSelectCollection: (href: string) => void;
  onLoadCollections: () => void;
};

function CollectionsPanel({
  collections,
  collectionsStatus,
  collectionsMessage,
  selectedCollectionHref,
  onSelectCollection,
  onLoadCollections,
}: CollectionsPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Collections</h2>
        <button
          type="button"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          onClick={onLoadCollections}
          disabled={collectionsStatus === "working"}
        >
          {collectionsStatus === "working" ? "Loading..." : "Load collections"}
        </button>
      </div>
      <StatusBanner message={collectionsMessage} status={collectionsStatus} />
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
              onChange={() => onSelectCollection(collection.href)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

export default CollectionsPanel;
