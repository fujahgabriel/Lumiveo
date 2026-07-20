import { Check, CircleAlert, Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { ExportFormat, ExportPreset, ExportQuality, Project, RenderJob } from "../types";
import { durationFor, presetDimensions } from "../video/config";
import { ModalFrame } from "./ModalFrame";

export function ExportModal({
  project,
  job,
  onClose,
  onStart,
  onCancel,
}: {
  project: Project;
  job: RenderJob | null;
  onClose: () => void;
  onStart: (input: { preset: ExportPreset; format: ExportFormat; locale: string; scale?: number; crf?: number }) => Promise<void>;
  onCancel: () => void;
}) {
  const [preset, setPreset] = useState<ExportPreset>("portrait");
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [locale, setLocale] = useState(project.activeLocale);
  const [scale, setScale] = useState(1.0);
  const [quality, setQuality] = useState<ExportQuality>("normal");
  const active = Boolean(job && ["queued", "running"].includes(job.status));

  const crfMap: Record<ExportQuality, number> = { draft: 28, normal: 20, high: 16 };
  const qualityMap: Record<ExportQuality, string> = { draft: "Draft (smaller, faster)", normal: "Normal (balanced)", high: "High (best quality)" };

  return (
    <ModalFrame title="Export master" subtitle="Render locally on this Mac" onClose={onClose}>
      {job ? (
        <div className={`render-status ${job.status}`}>
          <div className="render-status-head">
            <span>
              {job.status === "completed" ? (
                <Check size={20} />
              ) : job.status === "failed" ? (
                <CircleAlert size={20} />
              ) : (
                <LoaderCircle className={active ? "spin" : ""} size={20} />
              )}
            </span>
            <div>
              <strong>
                {job.status === "completed" ? "Export complete" : job.status === "failed" ? "Export failed" : "Rendering your demo"}
              </strong>
              <small>{job.output_path ?? job.error_code ?? `${Math.round(job.progress * 100)}%`}</small>
            </div>
          </div>
          <div className="progress-track">
            <i style={{ width: `${job.progress * 100}%` }} />
          </div>
        </div>
      ) : (
        <>
          <div className="export-presets">
            {(["portrait", "landscape", "square"] as const).map((item) => (
              <button key={item} type="button" className={preset === item ? "active" : ""} onClick={() => setPreset(item)}>
                <span className={`frame-icon ${item}`} />
                <strong>{item}</strong>
                <small>
                  {presetDimensions[item].width} × {presetDimensions[item].height}
                </small>
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Format</span>
              <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
                <option value="mp4">MP4 · H.264</option>
                <option value="gif">Animated GIF</option>
                <option value="png-sequence">PNG sequence</option>
              </select>
            </label>
            <label className="field">
              <span>Content locale</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value)}>
                {project.locales.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Resolution Quality</span>
              <select value={scale} onChange={(event) => setScale(Number(event.target.value))}>
                <option value={0.66}>720p (Draft - 0.66x)</option>
                <option value={1.0}>1080p (Standard - 1.0x)</option>
                <option value={2.0}>4K (Ultra HD - 2.0x)</option>
              </select>
            </label>
            <label className="field">
              <span>Quality</span>
              <select value={quality} onChange={(event) => setQuality(event.target.value as ExportQuality)}>
                {(Object.keys(qualityMap) as ExportQuality[]).map((key) => (
                  <option key={key} value={key}>{qualityMap[key]} (CRF {crfMap[key]})</option>
                ))}
              </select>
            </label>
          </div>
          <div className="export-summary">
            <span>Duration</span>
            <strong>{(durationFor(project) / project.fps).toFixed(1)} seconds</strong>
            <span>Frames</span>
            <strong>{durationFor(project).toLocaleString()}</strong>
          </div>
        </>
      )}
      <div className="modal-actions">
        <button className="quiet-button" type="button" onClick={active ? onCancel : onClose}>
          {active ? "Cancel render" : "Close"}
        </button>
        {!job ? (
            <button className="primary-button" type="button" onClick={() => void onStart({ preset, format, locale, scale, crf: format === "mp4" ? crfMap[quality] : undefined })}>
            <Download size={15} /> Start export
          </button>
        ) : null}
      </div>
    </ModalFrame>
  );
}
