import { Pencil, Trash2, History, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProjectListItem } from "../types";
import { api } from "../api";

export function ProjectCard({
  item,
  active,
  onSelect,
  onDelete,
  onRename,
  onRestore,
}: {
  item: ProjectListItem;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void | Promise<void>;
  onRestore: (versionId: string) => void | Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; timestamp: string; size: number }>>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    setEditTitle(item.title);
  }, [item.title]);

  const openedLabel = (() => {
    const date = new Date(item.last_opened_at);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
  })();

  const loadVersions = async () => {
    setLoadingVersions(true);
    try {
      const res = await api.getProjectVersions(item.id);
      setVersions(res.versions);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  return (
    <div
      className="project-card"
      style={{
        background: active ? "var(--bg-3)" : "var(--bg-2)",
        border: active ? "1.5px solid var(--accent)" : "1px solid var(--line)",
        borderRadius: "var(--radius-m)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        onClick={isEditing ? undefined : onSelect}
        style={{ cursor: isEditing ? "default" : "pointer", display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}
      >
        {isEditing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={async () => {
              setIsEditing(false);
              if (editTitle.trim() && editTitle !== item.title) {
                await onRename(editTitle.trim());
              } else {
                setEditTitle(item.title);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setEditTitle(item.title);
                setIsEditing(false);
              }
            }}
            style={{
              fontSize: "14px",
              padding: "6px 10px",
              background: "var(--bg-1)",
              border: "1px solid var(--line-strong)",
              borderRadius: "var(--radius-s)",
              color: "var(--text-1)",
              width: "100%",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        ) : (
          <strong style={{ fontSize: "15px", color: "var(--text-1)" }}>{item.title}</strong>
        )}
        <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Opened: {openedLabel}</span>
      </div>

      {showVersions && (
        <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "10px", marginTop: "4px" }}>
          <h5 style={{ margin: "0 0 6px", fontSize: "11px", color: "var(--text-3)", fontWeight: "bold" }}>Save History (Max 30)</h5>
          {loadingVersions ? (
            <div style={{ fontSize: "11px", color: "var(--text-3)", display: "flex", alignItems: "center", gap: "6px" }}>
              <LoaderCircle className="spin" size={11} /> Loading revisions...
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "110px", overflowY: "auto" }}>
              {versions.map((v) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "4px 6px", background: "var(--bg-1)", borderRadius: "4px" }}>
                  <span style={{ fontSize: "10.5px", color: "var(--text-2)" }}>
                    {new Date(v.timestamp).toLocaleTimeString()} · {(v.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm("Restore this saved version? Your current changes on this project will be replaced.")) {
                        await onRestore(v.id);
                      }
                    }}
                    style={{ fontSize: "9px", padding: "2px 6px", height: "18px", borderRadius: "3px" }}
                  >
                    Restore
                  </button>
                </div>
              ))}
              {versions.length === 0 && <div style={{ fontSize: "10.5px", color: "var(--text-3)" }}>No previous saves recorded yet.</div>}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          <button className="quiet-button" type="button" onClick={() => setIsEditing(true)} title="Rename">
            <Pencil size={13} />
          </button>
          <button
            className="quiet-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!showVersions) void loadVersions();
              setShowVersions(!showVersions);
            }}
            style={{ color: showVersions ? "var(--accent)" : "var(--text-2)" }}
            title="Save History & Revisions"
          >
            <History size={13} />
          </button>
          <button className="quiet-button" type="button" onClick={onDelete} title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
        {active ? (
          <span
            style={{
              fontSize: "10px",
              background: "var(--accent)",
              color: "#000",
              padding: "2px 6px",
              borderRadius: "4px",
              fontWeight: "bold",
            }}
          >
            Active
          </span>
        ) : null}
      </div>
    </div>
  );
}
