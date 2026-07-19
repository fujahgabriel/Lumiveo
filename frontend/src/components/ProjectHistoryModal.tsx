import { useEffect, useState } from "react";
import type { ProjectListItem } from "../types";
import { ModalFrame } from "./ModalFrame";
import { ProjectCard } from "./ProjectCard";
import { APP_NAME } from "../lib/constants";

export function ProjectHistoryModal({
  projects,
  activeProjectId,
  onClose,
  onSelect,
  onDelete,
  onRename,
  onRestore,
  onExport,
  onCreateNew,
  onRefresh,
}: {
  projects: ProjectListItem[];
  activeProjectId?: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
  onRename: (id: string, title: string) => void | Promise<void>;
  onRestore: (id: string, versionId: string) => void | Promise<void>;
  onExport: (id: string, title: string) => void | Promise<void>;
  onCreateNew: () => void;
  onRefresh?: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(Boolean(onRefresh));
  const list = Array.isArray(projects) ? projects : [];

  useEffect(() => {
    if (!onRefresh) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await onRefresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onRefresh]);

  return (
    <ModalFrame
      title="Project History"
      subtitle={`Switch between your saved ${APP_NAME} projects`}
      onClose={onClose}
      wide
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "8px 0", maxHeight: "400px", overflowY: "auto" }}>
        {loading && list.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-3)" }}>Loading projects…</div>
        ) : null}

        {list.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "8px 0" }}>
            {list.map((item) => (
              <ProjectCard
                key={item.id}
                item={item}
                active={item.id === activeProjectId}
                onSelect={() => onSelect(item.id)}
                onDelete={() => void onDelete(item.id)}
                onRename={(title) => onRename(item.id, title)}
                onRestore={(versionId) => onRestore(item.id, versionId)}
                onExport={() => onExport(item.id, item.title)}
              />
            ))}
          </div>
        ) : null}

        {!loading && list.length === 0 ? (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "var(--text-3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            No projects found.
            <button className="primary-button" type="button" onClick={onCreateNew}>
              Create New Project
            </button>
          </div>
        ) : null}
      </div>
    </ModalFrame>
  );
}
