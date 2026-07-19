import {
  ArrowLeft,
  Check,
  CircleAlert,
  Download,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { KeyLink, ModelPicker } from "../ModelPicker";
import { providerMeta, providerOrder, ttsKeyUrl } from "../providers";
import type { AppSettings, Project } from "../types";
import { Switch } from "../Switch";
import { ModalFrame } from "./ModalFrame";
import {
  APP_NAME,
  APP_NAME_UPPER,
  APP_VERSION,
  APP_LICENSE,
  APP_DESCRIPTION,
  APP_COPYRIGHT,
} from "../lib/constants";

type SettingsSection = "application" | "ai" | "voiceover" | "projects" | "about";

const settingsNav: { id: SettingsSection; label: string }[] = [
  { id: "application", label: "Application" },
  { id: "ai", label: "AI Provider" },
  { id: "voiceover", label: "Voiceover" },
  { id: "projects", label: "Projects" },
  { id: "about", label: "About" },
];

export function SettingsPage({
  settings,
  voices = [],
  project,
  onBack,
  onSave,
  onClear,
}: {
  settings: AppSettings;
  voices?: Array<{ id: string; name: string }>;
  project?: Project | null;
  onBack: () => void;
  onSave: (settings: AppSettings & { credential?: string; ttsCredential?: string }) => Promise<void>;
  onClear?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(settings);
  const [credential, setCredential] = useState("");
  const [ttsCredential, setTtsCredential] = useState("");
  const [cacheSize, setCacheSize] = useState<string>("Calculating...");
  const [systemPaths, setSystemPaths] = useState<{ dataDir: string; projectRoot: string; outputRoot: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "exporting" | "done" | "fail">("idle");
  const [exportedPath, setExportedPath] = useState<string | null>(null);
  const [exportLogs, setExportLogs] = useState<string[]>([]);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [ttsTestStatus, setTtsTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [confirmClear, setConfirmClear] = useState(false);
  const [section, setSection] = useState<SettingsSection>("application");
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice: typeof setNotice = (value) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(value);
    if (value) noticeTimer.current = setTimeout(() => setNotice(""), 5_000);
  };

  useEffect(() => {
    api
      .getCacheSize()
      .then((res) => {
        setCacheSize(res.sizeString);
        setSystemPaths({ dataDir: res.dataDir, projectRoot: res.projectRoot, outputRoot: res.outputRoot });
      })
      .catch(() => setCacheSize("Unknown"));
  }, []);

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      await api.testAiConnection();
      setTestStatus("ok");
    } catch {
      setTestStatus("fail");
    } finally {
      setTimeout(() => setTestStatus("idle"), 3000);
    }
  };

  const testTtsConnection = async () => {
    setTtsTestStatus("testing");
    try {
      await api.testTtsConnection();
      setTtsTestStatus("ok");
    } catch {
      setTtsTestStatus("fail");
    } finally {
      setTimeout(() => setTtsTestStatus("idle"), 3000);
    }
  };

  const bridge = (window as Window & { zero?: { invoke: (cmd: string, payload: unknown) => Promise<unknown> } }).zero;

  const addExportLog = (msg: string) => {
    setExportLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleExport = async () => {
    if (!project) {
      showNotice("Load or create a project first to export.");
      return;
    }
    setBusy(true);
    setExportState("exporting");
    setExportedPath(null);
    setExportLogs([]);
    addExportLog(`Initializing export for project: "${project.title}"`);
    try {
      // Step 1: Tell backend to zip the project to a temp file
      addExportLog("Compiling project files and copying active assets...");
      const { tempPath } = await api.exportProjectTemp(project.id);
      addExportLog("ZIP compression succeeded! Temporary archive compiled.");
      
      // Step 2: Open native Save Dialog now that the archive is ready!
      addExportLog("Awaiting save location selector from Finder...");
      const safeTitle = project.title.replace(/[\/\\?%*:|"<>\s]/g, "-").trim();
      const defaultName = `${safeTitle}.lumiveo`;
      const targetPath = (await bridge?.invoke("native-sdk.dialog.saveFile", {
        title: "Save Project Archive",
        defaultName,
      })) as string | null;
      
      if (!targetPath) {
        // User cancelled the save dialog: cleanly cancel and clear temp file
        addExportLog("Export cancelled by user. Cleaning up temp files.");
        await api.cleanupTempFile(tempPath).catch(() => {});
        setExportState("idle");
        return;
      }
      
      addExportLog(`Save destination confirmed: "${targetPath}"`);
      addExportLog("Writing final .lumiveo archive to selected directory...");
      // Step 3: Tell backend to copy/finalize the temp file to their chosen destination
      await api.finalizeExport(tempPath, targetPath);
      addExportLog("Archive written successfully! Export completed.");
      
      setExportedPath(targetPath);
      setExportState("done");
    } catch (err: any) {
      addExportLog(`Error: ${err?.message || "Export failed"}`);
      setExportState("fail");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    try {
      const paths = await bridge?.invoke("native-sdk.dialog.openFile", {
        title: "Import project directory",
        allowDirectories: true,
        allowMultiple: false,
      });
      const sourcePath = Array.isArray(paths) ? paths[0] : (paths as { path?: string } | undefined)?.path;
      if (!sourcePath || typeof sourcePath !== "string") return;
      setBusy(true);
      await api.importProject(sourcePath);
      showNotice("Project imported. Reopen the app to see it.");
    } catch {
      showNotice("Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await api.clearAllProjects();
      showNotice("All projects cleared.");
      await onClear?.();
    } catch {
      showNotice("Failed to clear projects.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-sidebar">
        <div className="settings-sidebar-header">
          <span className="kicker">{APP_NAME_UPPER}</span>
          <h2>Settings</h2>
        </div>
        <nav className="settings-nav">
          {settingsNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav-item${section === item.id ? " active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="settings-sidebar-footer">
          <button className="quiet-button" type="button" onClick={onBack} style={{ width: "100%" }}>
            <ArrowLeft size={14} /> Back to project
          </button>
        </div>
      </div>
      <div className="settings-content">
        {notice ? <div className="settings-notice">{notice}</div> : null}

        {section === "application" ? (
          <div className="settings-section">
            <h3>Application</h3>
            <div className="field-grid">
              <label className="field">
                <span>Interface language</span>
                <select value={draft.uiLocale} onChange={(event) => setDraft({ ...draft, uiLocale: event.target.value })}>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
              <label className="field">
                <span>Analytics adapter</span>
                <select
                  value={draft.analyticsProvider}
                  onChange={(event) =>
                    setDraft({ ...draft, analyticsProvider: event.target.value as AppSettings["analyticsProvider"] })
                  }
                >
                  <option value="none">None</option>
                  <option value="posthog">PostHog</option>
                  <option value="firebase">Firebase</option>
                </select>
              </label>
            </div>
            <div className="cache-row">
              <span>Storage Cache Size:</span>
              <strong>{cacheSize}</strong>
            </div>
            <Switch
              checked={draft.analyticsEnabled}
              onToggle={() => setDraft({ ...draft, analyticsEnabled: !draft.analyticsEnabled })}
            >
              Send allowlisted events and sanitized exceptions
            </Switch>
            <Switch
              checked={draft.notificationsEnabled}
              onToggle={() => setDraft({ ...draft, notificationsEnabled: !draft.notificationsEnabled })}
            >
              macOS notifications
            </Switch>

            {systemPaths && (
              <div style={{ borderTop: "1px solid var(--line)", marginTop: "16px", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <h4 style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-3)" }}>System Folders</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", color: "var(--text-2)", background: "var(--bg-2)", border: "1px solid var(--line)", padding: "12px", borderRadius: "var(--radius-m)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                    <span style={{ color: "var(--text-3)" }}>Data Root:</span>
                    <code style={{ wordBreak: "break-all", textAlign: "right" }}>{systemPaths.dataDir}</code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                    <span style={{ color: "var(--text-3)" }}>Projects Folder:</span>
                    <code style={{ wordBreak: "break-all", textAlign: "right" }}>{systemPaths.projectRoot}</code>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
                    <span style={{ color: "var(--text-3)" }}>Exports Folder:</span>
                    <code style={{ wordBreak: "break-all", textAlign: "right" }}>{systemPaths.outputRoot}</code>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {section === "ai" ? (
          <div className="settings-section">
            <h3>AI provider</h3>
            <div className="field-grid">
              <label className="field">
                <span>Provider</span>
                <select
                  value={draft.ai.provider}
                  onChange={(event) =>
                    setDraft({ ...draft, ai: { ...draft.ai, provider: event.target.value as AppSettings["ai"]["provider"] } })
                  }
                >
                  {providerOrder.map((item) => (
                    <option key={item} value={item}>
                      {providerMeta[item].label}
                    </option>
                  ))}
                </select>
              </label>
              <ModelPicker
                provider={draft.ai.provider}
                value={draft.ai.model}
                onChange={(model) => setDraft({ ...draft, ai: { ...draft.ai, model } })}
                endpoint={draft.ai.endpoint}
                credential={credential || undefined}
              />
            </div>
            {providerMeta[draft.ai.provider].needsEndpoint ? (
              <label className="field">
                <span>Endpoint</span>
                <input
                  value={draft.ai.endpoint}
                  onChange={(event) => setDraft({ ...draft, ai: { ...draft.ai, endpoint: event.target.value } })}
                  placeholder={providerMeta[draft.ai.provider].endpointPlaceholder}
                />
              </label>
            ) : null}
            {providerMeta[draft.ai.provider].needsKey ? (
              <>
                <label className="field">
                  <span>
                    API key {draft.ai.hasCredential ? "· configured" : ""}
                    {providerMeta[draft.ai.provider].keyOptional ? " · optional" : ""}
                  </span>
                  <input
                    type="password"
                    value={credential}
                    onChange={(event) => setCredential(event.target.value)}
                    placeholder="Leave blank to keep current key"
                  />
                </label>
                {providerMeta[draft.ai.provider].keyUrl ? (
                  <KeyLink url={providerMeta[draft.ai.provider].keyUrl!} label={providerMeta[draft.ai.provider].keyLabel} />
                ) : null}
              </>
            ) : null}
            <div className="test-row">
              <button className="quiet-button" type="button" disabled={testStatus === "testing"} onClick={testConnection}>
                {testStatus === "testing" ? (
                  <LoaderCircle className="spin" size={12} />
                ) : testStatus === "ok" ? (
                  <Check size={12} />
                ) : testStatus === "fail" ? (
                  <CircleAlert size={12} />
                ) : null}
                {testStatus === "idle"
                  ? "Test connection"
                  : testStatus === "testing"
                    ? "Testing..."
                    : testStatus === "ok"
                      ? "Connection OK"
                      : "Connection failed"}
              </button>
              {draft.ai.provider === "local" ? <span className="test-hint">Local provider always available</span> : null}
            </div>
          </div>
        ) : null}

        {section === "voiceover" ? (
          <div className="settings-section">
            <h3>Voiceover</h3>
            <div className="field-grid">
              <label className="field">
                <span>Provider</span>
                <select
                  value={draft.tts.provider}
                  onChange={(event) =>
                    setDraft({ ...draft, tts: { ...draft.tts, provider: event.target.value as AppSettings["tts"]["provider"] } })
                  }
                >
                  <option value="none">None</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              </label>
              <label className="field">
                <span>Default Voice</span>
                {voices.length > 0 ? (
                  <select
                    value={draft.tts.voiceId}
                    onChange={(event) => setDraft({ ...draft, tts: { ...draft.tts, voiceId: event.target.value } })}
                  >
                    <option value="">-- Select default voice --</option>
                    {voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={draft.tts.voiceId}
                    onChange={(event) => setDraft({ ...draft, tts: { ...draft.tts, voiceId: event.target.value } })}
                    placeholder="Enter ElevenLabs Voice ID"
                  />
                )}
              </label>
            </div>
            {draft.tts.provider === "elevenlabs" ? (
              <div className="field-grid">
                <label className="field">
                  <span>Speed (0.5x - 2.0x)</span>
                  <input
                    type="number"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={draft.tts.speed ?? 1.0}
                    onChange={(event) => setDraft({ ...draft, tts: { ...draft.tts, speed: Number(event.target.value) } })}
                  />
                </label>
                <div className="slider-group">
                  <label className="field">
                    <span>Stability ({Math.round((draft.tts.stability ?? 0.75) * 100)}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={draft.tts.stability ?? 0.75}
                      onChange={(event) =>
                        setDraft({ ...draft, tts: { ...draft.tts, stability: Number(event.target.value) } })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Similarity ({Math.round((draft.tts.similarityBoost ?? 0.75) * 100)}%)</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={draft.tts.similarityBoost ?? 0.75}
                      onChange={(event) =>
                        setDraft({ ...draft, tts: { ...draft.tts, similarityBoost: Number(event.target.value) } })
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}
            <label className="field">
              <span>TTS key {draft.tts.hasCredential ? "· configured" : ""}</span>
              <input
                type="password"
                value={ttsCredential}
                onChange={(event) => setTtsCredential(event.target.value)}
                placeholder="Stored in macOS Keychain"
              />
            </label>
            <KeyLink url={ttsKeyUrl} label="elevenlabs.io/app/settings/api-keys" />
            <div className="test-row">
              <button
                className="quiet-button"
                type="button"
                disabled={ttsTestStatus === "testing" || draft.tts.provider === "none"}
                onClick={testTtsConnection}
              >
                {ttsTestStatus === "testing" ? (
                  <LoaderCircle className="spin" size={12} />
                ) : ttsTestStatus === "ok" ? (
                  <Check size={12} />
                ) : ttsTestStatus === "fail" ? (
                  <CircleAlert size={12} />
                ) : null}
                {ttsTestStatus === "idle"
                  ? "Test connection"
                  : ttsTestStatus === "testing"
                    ? "Testing..."
                    : ttsTestStatus === "ok"
                      ? "Connection OK"
                      : "Connection failed"}
              </button>
            </div>
          </div>
        ) : null}

        {section === "projects" ? (
          <div className="settings-section">
            <h3>Projects</h3>
            <div className="project-actions">
              <button
                className="quiet-button"
                type="button"
                disabled={busy || !project}
                onClick={handleExport}
                title={!project ? "Load or create a project first to export" : "Export current project as a portable archive"}
              >
                <Download size={13} /> Export project
              </button>
              <button className="quiet-button" type="button" disabled={busy} onClick={handleImport}>
                <Upload size={13} /> Import project
              </button>
              <button
                className="quiet-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!confirmClear) {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 4_000);
                  } else {
                    setConfirmClear(false);
                    void handleClear();
                  }
                }}
                style={{ color: confirmClear ? "#ff4444" : "#ff6b6b", border: confirmClear ? "1px solid #ff4444" : "none" }}
              >
                {busy ? <LoaderCircle className="spin" size={13} /> : <Trash2 size={13} />}{" "}
                {busy ? "Clearing..." : confirmClear ? "Click again to confirm" : "Clear all projects"}
              </button>
            </div>
          </div>
        ) : null}

        {section === "about" ? (
          <div className="settings-section" style={{ gap: "16px" }}>
            <h3>About</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", background: "var(--bg-2)", border: "1px solid var(--line)", padding: "24px", borderRadius: "var(--radius-m)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--accent)", color: "#000", display: "grid", placeItems: "center", fontWeight: "bold", fontSize: "20px" }}>L</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "var(--text-1)" }}>{APP_NAME} Studio</h2>
                  <span style={{ fontSize: "11px", color: "var(--text-3)" }}>Version {APP_VERSION} · {APP_LICENSE}</span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-2)", lineHeight: "1.5" }}>
                {APP_DESCRIPTION}
              </p>
              <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "12px", fontSize: "11px", color: "var(--text-3)" }}>
                {APP_COPYRIGHT}
              </div>
            </div>
          </div>
        ) : null}

        <div className="settings-footer">
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave({ ...draft, credential, ttsCredential }).finally(() => setBusy(false));
            }}
          >
            {busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save settings
          </button>
        </div>
      </div>

      {exportState !== "idle" && (
        <ModalFrame
          title="Project Export"
          subtitle={project ? `Archiving "${project.title}"` : "Archiving project"}
          onClose={() => setExportState("idle")}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0", textAlign: "center", alignItems: "center", width: "100%" }}>
            {exportState === "exporting" ? (
              <>
                <LoaderCircle className="spin" size={32} style={{ color: "var(--accent)" }} />
                <strong style={{ fontSize: "14px", color: "var(--text-1)" }}>Compiling assets and compressing project archive…</strong>
                
                {/* Live Console Logs UI */}
                <div style={{
                  marginTop: "8px",
                  width: "100%",
                  maxHeight: "140px",
                  background: "#121210",
                  border: "1px solid #2d2d26",
                  borderRadius: "6px",
                  padding: "10px",
                  textAlign: "left",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#d4d4cb",
                  overflowY: "auto",
                  lineHeight: "1.4",
                  boxSizing: "border-box"
                }}>
                  {exportLogs.map((log, idx) => (
                    <div key={idx} style={{ color: log.includes("Error") || log.includes("failed") ? "#ff6b6b" : log.includes("succeeded") || log.includes("successfully") || log.includes("completed") ? "#9be9a8" : "#d4d4cb", marginBottom: "3px" }}>
                      {log}
                    </div>
                  ))}
                </div>
                
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-3)" }}>Please keep {APP_NAME} open. Writing `.lumiveo` bundle to your disk.</p>
              </>
            ) : exportState === "done" ? (
              <>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--accent)", color: "#000", display: "grid", placeItems: "center" }}>
                  <Check size={20} strokeWidth={3} />
                </div>
                <strong style={{ fontSize: "14px", color: "var(--text-1)" }}>Project Exported Successfully!</strong>
                
                {/* Summary Console logs */}
                <div style={{
                  marginTop: "8px",
                  width: "100%",
                  maxHeight: "100px",
                  background: "#121210",
                  border: "1px solid #2d2d26",
                  borderRadius: "6px",
                  padding: "10px",
                  textAlign: "left",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#d4d4cb",
                  overflowY: "auto",
                  lineHeight: "1.4",
                  boxSizing: "border-box"
                }}>
                  {exportLogs.map((log, idx) => (
                    <div key={idx} style={{ color: log.includes("Error") || log.includes("failed") ? "#ff6b6b" : log.includes("succeeded") || log.includes("successfully") || log.includes("completed") ? "#9be9a8" : "#d4d4cb", marginBottom: "3px" }}>
                      {log}
                    </div>
                  ))}
                </div>

                <code style={{ fontSize: "11px", color: "var(--text-3)", background: "var(--bg-1)", padding: "6px 12px", borderRadius: "4px", maxWidth: "100%", wordBreak: "break-all" }}>
                  {exportedPath}
                </code>
                <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      if (exportedPath) void api.revealPath(exportedPath);
                    }}
                  >
                    Show in Finder
                  </button>
                  <button
                    className="quiet-button"
                    type="button"
                    onClick={() => setExportState("idle")}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <CircleAlert size={32} style={{ color: "#ff6b6b" }} />
                <strong style={{ fontSize: "14px", color: "var(--text-1)" }}>Export Failed</strong>
                
                {/* Fail Console logs */}
                <div style={{
                  marginTop: "8px",
                  width: "100%",
                  maxHeight: "100px",
                  background: "#121210",
                  border: "1px solid #2d2d26",
                  borderRadius: "6px",
                  padding: "10px",
                  textAlign: "left",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#d4d4cb",
                  overflowY: "auto",
                  lineHeight: "1.4",
                  boxSizing: "border-box"
                }}>
                  {exportLogs.map((log, idx) => (
                    <div key={idx} style={{ color: log.includes("Error") || log.includes("failed") ? "#ff6b6b" : log.includes("succeeded") || log.includes("successfully") || log.includes("completed") ? "#9be9a8" : "#d4d4cb", marginBottom: "3px" }}>
                      {log}
                    </div>
                  ))}
                </div>

                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-3)" }}>Failed to write compressed archive to destination path.</p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setExportState("idle")}
                  style={{ marginTop: "12px" }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
