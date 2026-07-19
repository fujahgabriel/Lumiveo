import { projectTemplates, type ProjectTemplate } from "../video/templates";
import { ModalFrame } from "./ModalFrame";

export function TemplatePickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (template: ProjectTemplate) => void;
}) {
  return (
    <ModalFrame title="Video Templates" subtitle="Instantly bootstrap your app video with styled template presets" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "8px 0" }}>
        {projectTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="template-card"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(template);
            }}
            style={{
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-m)",
              padding: "20px",
              textAlign: "left",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--line)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
              <strong style={{ fontSize: "16px", color: "var(--text-1)" }}>{template.name}</strong>
              <span
                style={{
                  fontSize: "11px",
                  background: template.accent,
                  color: "#000",
                  padding: "3px 8px",
                  borderRadius: "99px",
                  fontWeight: "bold",
                }}
              >
                {template.scenes.length} Scenes
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-2)", margin: 0, lineHeight: "1.4" }}>{template.description}</p>
            <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
              {template.scenes.map((scene, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "10px",
                    background: "var(--bg-3)",
                    border: "1px solid var(--line-strong)",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    color: "var(--text-3)",
                  }}
                >
                  {scene.name}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </ModalFrame>
  );
}
