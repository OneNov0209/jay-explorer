import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { toast } from "sonner";

export function JsonActions({
  data,
  filename,
  className = "",
}: {
  data: unknown;
  filename: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      toast.success("JSON copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const onDownload = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={onCopy}
        title="Copy JSON"
        className="h-8 px-2 rounded-md border border-border hover:bg-accent/40 inline-flex items-center gap-1 text-xs"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
        Copy
      </button>
      <button
        onClick={onDownload}
        title="Download JSON"
        className="h-8 px-2 rounded-md border border-border hover:bg-accent/40 inline-flex items-center gap-1 text-xs"
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    </div>
  );
}
