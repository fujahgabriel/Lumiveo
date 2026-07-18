import { Check, Copy, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "./api";
import { providerMeta, type ProviderKind } from "./providers";

interface Model {
  id: string;
  label: string;
  openWeights: boolean;
  source: "live" | "curated";
}

export function ModelPicker({
  provider,
  value,
  onChange,
  endpoint,
  credential,
  disabled,
}: {
  provider: ProviderKind;
  value: string;
  onChange: (id: string) => void;
  endpoint?: string;
  credential?: string;
  disabled?: boolean;
}) {
  const listId = useId();
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (provider === "local") {
      setModels([]);
      return;
    }
    const id = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api.listModels(provider, {
          endpoint: endpoint || undefined,
          credential: credential || undefined,
        });
        if (requestId.current === id) setModels(result.models);
      } catch {
        if (requestId.current === id) setModels([]);
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [provider, endpoint, credential]);

  const meta = providerMeta[provider];
  const liveCount = models.filter((model) => model.source === "live").length;
  const openCount = models.filter((model) => model.openWeights).length;

  return (
    <label className="field model-picker">
      <span>
        Model
        {loading ? <LoaderCircle className="spin" size={12} /> : null}
      </span>
      <input
        list={listId}
        value={value}
        disabled={disabled || provider === "local"}
        placeholder={meta.modelPlaceholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {models.map((model) => (
          <option
            key={model.id}
            value={model.id}
            label={`${model.label}${model.openWeights ? " · open weights" : ""}`}
          />
        ))}
      </datalist>
      {models.length > 0 ? (
        <small>
          {models.length} models {liveCount > 0 ? "from provider (live)" : "(curated list)"}
          {openCount > 0 ? ` · ${openCount} open-weight` : ""} — or type any id
        </small>
      ) : (
        <small>Type a model id{meta.note ? ` — ${meta.note}` : ""}</small>
      )}
    </label>
  );
}

export function KeyLink({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable: the URL stays selectable for manual copy.
    }
  };
  return (
    <div className="key-link">
      <ExternalLink size={13} />
      <code>{label ?? url.replace(/^https?:\/\//, "")}</code>
      <button type="button" onClick={() => void copy()} title="Copy link">
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
