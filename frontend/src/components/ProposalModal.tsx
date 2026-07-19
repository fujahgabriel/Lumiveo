import { Check, LoaderCircle } from "lucide-react";
import type { StoryboardProposal } from "../types";
import { ModalFrame } from "./ModalFrame";

export function ProposalModal({
  proposal,
  busy,
  onClose,
  onApply,
}: {
  proposal: StoryboardProposal;
  busy: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <ModalFrame
      title={proposal.operation === "translation" ? `Localised draft · ${proposal.locale}` : "Storyboard draft"}
      subtitle={`${proposal.provider} · ${proposal.model}`}
      onClose={onClose}
      wide
    >
      <p className="proposal-summary">{proposal.summary}</p>
      <div className="proposal-scenes">
        {proposal.scenes.map((scene, index) => (
          <article key={`${scene.sourceSceneId}-${index}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{scene.name}</strong>
              <p>{scene.caption}</p>
              <small>{scene.narration}</small>
            </div>
            <em>{scene.durationSeconds.toFixed(1)}s</em>
          </article>
        ))}
      </div>
      <div className="modal-actions">
        <button className="quiet-button" type="button" onClick={onClose}>
          Discard
        </button>
        <button className="primary-button" type="button" disabled={busy} onClick={onApply}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Accept draft
        </button>
      </div>
    </ModalFrame>
  );
}
