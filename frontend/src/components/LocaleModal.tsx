import { Languages, LoaderCircle } from "lucide-react";
import { useState } from "react";
import type { Project } from "../types";
import { ModalFrame } from "./ModalFrame";

const locales = [
  { code: "es", label: "Español", sample: "Una historia clara" },
  { code: "fr", label: "Français", sample: "Une histoire claire" },
  { code: "de", label: "Deutsch", sample: "Eine klare Geschichte" },
  { code: "zh-CN", label: "简体中文", sample: "清晰讲述产品故事" },
  { code: "ar", label: "العربية", sample: "قصة واضحة لمنتجك" },
  { code: "ja", label: "日本語", sample: "製品の魅力を明確に" },
];

export function LocaleModal({
  project,
  busy,
  onClose,
  onGenerate,
}: {
  project: Project;
  busy: boolean;
  onClose: () => void;
  onGenerate: (locale: string) => void;
}) {
  const [locale, setLocale] = useState("es");

  return (
    <ModalFrame title="Add a localised edition" subtitle={`Source language: ${project.sourceLocale}`} onClose={onClose}>
      <div className="locale-options">
        {locales.map((item) => (
          <button key={item.code} type="button" className={locale === item.code ? "active" : ""} onClick={() => setLocale(item.code)}>
            <span>{item.code.toUpperCase()}</span>
            <strong>{item.label}</strong>
            <small>{item.sample}</small>
          </button>
        ))}
      </div>
      <p className="privacy-note">Only scene text and product context are sent to the configured provider. Imported media stays on this Mac.</p>
      <div className="modal-actions">
        <button className="quiet-button" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" type="button" disabled={busy} onClick={() => onGenerate(locale)}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <Languages size={15} />} Generate locale
        </button>
      </div>
    </ModalFrame>
  );
}
