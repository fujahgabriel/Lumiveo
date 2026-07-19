import { X } from "lucide-react";
import type { ReactNode } from "react";
import { APP_NAME_UPPER } from "../lib/constants";

export function ModalFrame({
  title,
  subtitle,
  onClose,
  wide,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <span className="kicker">{APP_NAME_UPPER}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
