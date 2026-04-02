type Status = "idle" | "working" | "success" | "error";

type StatusBannerProps = {
  message?: string;
  status: Status;
};

function StatusBanner({ message, status }: StatusBannerProps) {
  if (!message) return null;
  const className =
    status === "error"
      ? "border border-rose-200 bg-rose-50 text-rose-700"
      : "border border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${className}`}>
      {message}
    </div>
  );
}

export default StatusBanner;
