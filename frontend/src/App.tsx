import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleAlert,
  Clapperboard,
  Download,
  FileImage,
  Film,
  FolderOpen,
  Languages,
  LoaderCircle,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { api, assetUrl, resolveWorkerEndpoint, workerUrl, workerToken } from "./api";
import { t, uiDirection } from "./i18n";
import { KeyLink, ModelPicker } from "./ModelPicker";
import { providerMeta, providerOrder, ttsKeyUrl } from "./providers";
import { StageView } from "./StageView";
import type {
  AppSettings,
  ExportFormat,
  ExportPreset,
  Project,
  RenderJob,
  Scene,
  StoryboardProposal,
} from "./types";
import { durationFor, presetDimensions } from "./video/config";

type Modal = "onboarding" | "settings" | "export" | "locale" | "proposal" | null;

const defaultSettings: AppSettings = {
  onboardingComplete: false,
  uiLocale: "en",
  analyticsEnabled: false,
  analyticsProvider: "none",
  ai: { provider: "local", model: "", endpoint: "", hasCredential: true },
  tts: { provider: "none", voiceId: "", hasCredential: false },
};

export default function App() {
  const [status, setStatus] = useState<"booting" | "ready" | "offline">("booting");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [project, setProject] = useState<Project | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [preset, setPreset] = useState<ExportPreset>("portrait");
  const [modal, setModal] = useState<Modal>(null);
  const [proposal, setProposal] = useState<StoryboardProposal | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const deferredProject = useDeferredValue(project);

  const addLog = (msg: string) => {
    setBootLogs(current => [...current, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const boot = async () => {
    setStatus("booting");
    setBootLogs([]);
    addLog("Starting app initialization...");
    try {
      addLog("Resolving local worker endpoint from bridge...");
      await resolveWorkerEndpoint();
      addLog(`Resolved endpoint! URL: ${workerUrl} | Token: ${workerToken}`);
      
      addLog("Verifying backend health check at /health...");
      const healthStatus = await api.health();
      addLog(`Health check succeeded! Backend Version: ${healthStatus.version}, Database: ${(healthStatus as any).database || 'unknown'}`);
      
      addLog("Loading user settings and projects list...");
      const [nextSettings, list] = await Promise.all([api.settings(), api.projects()]);
      addLog(`Loaded settings successfully. (Onboarding Completed: ${nextSettings.onboardingComplete})`);
      addLog(`Loaded projects successfully! Count: ${list.length}`);
      
      addLog("Retrieving default project details...");
      const nextProject = list[0]
        ? await api.project(list[0].id)
        : await api.createProject("Untitled Lumiveo project");
      addLog(`Project loaded successfully! Title: "${nextProject.title}"`);
      
      setSettings(nextSettings);
      setProject(nextProject);
      if (nextProject.scenes && nextProject.scenes.length > 0) {
        setSelectedSceneId(nextProject.scenes[0].id);
      } else {
        setSelectedSceneId("");
      }
      setModal(nextSettings.onboardingComplete ? null : "onboarding");
      setStatus("ready");
      addLog("App is fully ready!");
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      addLog(`CRITICAL ERROR during boot: ${errMsg}`);
      console.error("[Lumiveo Boot ERROR] Critical boot sequence failure:", error);
      setStatus("offline");
    }
  };

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    const handleNew = () => void createNewProject();
    const handleSave = () => setDirty(true);
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        handleSave();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "n") {
        event.preventDefault();
        handleNew();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("app.new", handleNew);
    window.addEventListener("app.save", handleSave);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("app.new", handleNew);
      window.removeEventListener("app.save", handleSave);
    };
  }, []);

  useEffect(() => {
    if (!dirty || !project) return;
    const timer = window.setTimeout(async () => {
      const revisionToSave = project.updatedAt;
      setSaving(true);
      try {
        const saved = await api.saveProject(project);
        if (project.updatedAt === revisionToSave) {
          setProject(saved);
          setDirty(false);
        }
      } catch {
        setNotice("Could not save. Your edits remain in this window.");
      } finally {
        setSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [dirty, project]);

  useEffect(() => {
    if (!renderJob || !["queued", "running"].includes(renderJob.status)) return;
    const timer = window.setInterval(async () => {
      const next = await api.render(renderJob.id).catch(() => null);
      if (next) setRenderJob(next);
    }, 800);
    return () => window.clearInterval(timer);
  }, [renderJob]);

  const updateProject = (updater: (current: Project) => Project) => {
    setProject((current) => (current ? updater(current) : current));
    setDirty(true);
  };

  const updateScene = (updater: (scene: Scene) => Scene) => {
    updateProject((current) => ({
      ...current,
      scenes: current.scenes.map((scene) =>
        scene.id === selectedSceneId ? updater(scene) : scene,
      ),
    }));
  };

  const importFiles = async (files: File[]) => {
    if (!project || files.length === 0) return;
    setBusy("import");
    try {
      let current = project;
      for (const file of files) {
        const result = await api.importFile(current.id, file);
        current = result.project;
      }
      setProject(current);
      if (current.scenes.length === 1 && current.scenes[0].assetId === null) {
        const first = current.assets[0];
        if (first) {
          const attached = {
            ...current,
            scenes: current.scenes.map((scene, index) =>
              index === 0 ? { ...scene, assetId: first.id } : scene,
            ),
          };
          setProject(attached);
          setDirty(true);
        }
      }
    } catch {
      setNotice("One or more media files could not be imported.");
    } finally {
      setBusy(null);
    }
  };

  const openNativeImport = async () => {
    const bridge = window.zero;
    if (!bridge) {
      fileInput.current?.click();
      return;
    }
    try {
      const result = await bridge.invoke("native-sdk.dialog.openFile", {
        title: "Import app media",
        allowMultiple: true,
        allowDirectories: false,
      });
      const paths = normalizeDialogPaths(result);
      if (!project || paths.length === 0) return;
      setBusy("import");
      let current = project;
      for (const path of paths) {
        current = (await api.importPath(current.id, path, mimeFromPath(path))).project;
      }
      setProject(current);
    } catch {
      fileInput.current?.click();
    } finally {
      setBusy(null);
    }
  };

  const generate = async (operation: "storyboard" | "translation", locale?: string) => {
    if (!project) return;
    setBusy(operation);
    try {
      const next = await api.generate({ projectId: project.id, operation, locale });
      setProposal(next);
      setModal("proposal");
    } catch {
      setNotice("Generation failed. Check your AI provider in Settings and try again.");
    } finally {
      setBusy(null);
    }
  };

  const applyProposal = async () => {
    if (!project || !proposal) return;
    setBusy("apply");
    try {
      const next = await api.applyProposal(project.id, proposal);
      setProject(next);
      setSelectedSceneId(next.scenes[0]?.id ?? "");
      setProposal(null);
      setModal(null);
    } finally {
      setBusy(null);
    }
  };

  const startRender = async (input: { preset: ExportPreset; format: ExportFormat; locale: string }) => {
    if (!project) return;
    const job = await api.startRender({ projectId: project.id, ...input });
    setRenderJob(job);
  };

  const generateVoiceover = async (sceneId: string, narration: string) => {
    if (!project) return;
    setBusy("tts");
    try {
      const result = await api.generateVoiceover(project.id, sceneId, narration);
      updateProject((current) => ({
        ...current,
        assets: [...current.assets, result.asset],
      }));
      setNotice("Voiceover generated.");
    } catch {
      setNotice("Voiceover failed. Check ElevenLabs config.");
    } finally {
      setBusy(null);
    }
  };

  if (status !== "ready" || !project || !deferredProject) {
    return <LaunchScreen status={status} logs={bootLogs} retry={boot} />;
  }

  const selectedScene =
    project.scenes.find((scene) => scene.id === selectedSceneId) ?? project.scenes[0];
  const dimensions = presetDimensions[preset];
  const locale = project.activeLocale;
  const copy = selectedScene.copy[locale] ?? selectedScene.copy[project.sourceLocale];
  const translate = (key: Parameters<typeof t>[1]) => t(settings.uiLocale, key);

  return (
    <div className="app-shell" dir={uiDirection(settings.uiLocale)}>
      <header className="titlebar drag-region">
        <div className="brand no-drag">
          <span className="brand-mark"><Clapperboard size={17} /></span>
          <strong>App Demo Studio</strong>
          <span className="beta-pill">PREVIEW</span>
        </div>
        <div className="project-title no-drag">
          <input
            value={project.title}
            aria-label="Project title"
            onChange={(event) =>
              updateProject((current) => ({ ...current, title: event.target.value }))
            }
          />
          <span className="save-state">{saving ? "Saving…" : translate("saveState")}</span>
        </div>
        <div className="title-actions no-drag">
          <button className="quiet-button" onClick={() => void createNewProject()}>
            <Plus size={15} /> {translate("newProject")}
          </button>
          <button className="icon-button" title={translate("settings")} onClick={() => setModal("settings")}>
            <Settings size={18} />
          </button>
          <button className="primary-button" onClick={() => setModal("export")}>
            <Download size={16} /> {translate("export")}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="media-panel panel">
          <div className="panel-heading">
            <div><span className="kicker">01</span><h2>{translate("media")}</h2></div>
            <button className="icon-button" title={translate("importMedia")} onClick={() => void openNativeImport()}>
              {busy === "import" ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}
            </button>
          </div>
          <button className="drop-zone" onClick={() => void openNativeImport()}>
            <span className="drop-icon"><Plus size={18} /></span>
            <span>{translate("emptyMedia")}</span>
          </button>
          <input
            ref={fileInput}
            hidden
            multiple
            type="file"
            accept="image/*,video/*,audio/*,.gif"
            onChange={(event) => void importFiles(Array.from(event.target.files ?? []))}
          />
          <div className="asset-grid">
            {project.assets.map((asset) => (
              <button
                key={asset.id}
                className={`asset-card ${selectedScene.assetId === asset.id ? "selected" : ""}`}
                onClick={() => updateScene((scene) => ({ ...scene, assetId: asset.id }))}
                title={`Use ${asset.name} in selected scene`}
              >
                <div className="asset-thumb">
                  {asset.mediaType === "image" || asset.mediaType === "gif" ? (
                    <img src={assetUrl(project.id, asset.id)} alt="" />
                  ) : asset.mediaType === "video" ? (
                    <Film size={23} />
                  ) : (
                    <Volume2 size={23} />
                  )}
                  <span>{asset.mediaType}</span>
                </div>
                <small>{asset.name}</small>
              </button>
            ))}
          </div>
        </aside>

        <main className="stage-panel">
          <div className="stage-toolbar">
            <div className="segmented" aria-label="Preview aspect ratio">
              {(["portrait", "landscape", "square"] as ExportPreset[]).map((item) => (
                <button key={item} className={preset === item ? "active" : ""} onClick={() => setPreset(item)}>
                  {item === "portrait" ? "9:16" : item === "landscape" ? "16:9" : "1:1"}
                </button>
              ))}
            </div>
            <span className="stage-label">{translate("preview")} · {dimensions.width}×{dimensions.height}</span>
            <div className="locale-switcher">
              <Languages size={15} />
              <span>{project.locales.find(l => l.code === project.activeLocale)?.label || project.activeLocale}</span>
              <select
                value={project.activeLocale}
                onChange={(event) =>
                  updateProject((current) => ({ ...current, activeLocale: event.target.value }))
                }
              >
                {project.locales.map((entry) => (
                  <option key={entry.code} value={entry.code}>{entry.label}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          <StageView project={deferredProject} locale={locale} preset={preset} />
          <div className="ai-bar">
            <div className="ai-orb"><WandSparkles size={18} /></div>
            <div><strong>Creative agent</strong><span>{settings.ai.provider} · {settings.ai.model || "local draft"}</span></div>
            <button onClick={() => void generate("storyboard")} disabled={busy !== null}>
              {busy === "storyboard" ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}
              {translate("generate")}
            </button>
            <button onClick={() => setModal("locale")} disabled={busy !== null}>
              <Languages size={15} /> {translate("localise")}
            </button>
          </div>
        </main>

        <aside className="inspector panel">
          <div className="panel-heading">
            <div><span className="kicker">03</span><h2>Inspector</h2></div>
            <span className="scene-badge">{project.scenes.indexOf(selectedScene) + 1}/{project.scenes.length}</span>
          </div>
          <label className="field">
            <span>Scene name</span>
            <input value={selectedScene.name} onChange={(event) => updateScene((scene) => ({ ...scene, name: event.target.value }))} />
          </label>
          <label className="field">
            <span>{translate("caption")}</span>
            <textarea
              rows={4}
              value={copy?.caption ?? ""}
              onChange={(event) => updateSceneCopy(updateScene, selectedScene, locale, "caption", event.target.value)}
            />
            <small>{copy?.caption.length ?? 0}/500</small>
          </label>
          <label className="field">
            <span>{translate("narration")}</span>
            <textarea
              rows={5}
              value={copy?.narration ?? ""}
              onChange={(event) => updateSceneCopy(updateScene, selectedScene, locale, "narration", event.target.value)}
            />
            <button className="quiet-button" disabled={busy === "tts" || !settings.tts.hasCredential} onClick={() => void generateVoiceover(selectedScene.id, copy?.narration ?? "")}>
              {busy === "tts" ? <LoaderCircle className="spin" size={12}/> : <Volume2 size={12}/>} Generate voiceover
            </button>
          </label>
          <div className="field-grid">
            <label className="field">
              <span>{translate("duration")}</span>
              <div className="input-suffix">
                <input
                  type="number"
                  min={0.5}
                  max={60}
                  step={0.5}
                  value={(selectedScene.durationInFrames / project.fps).toFixed(1)}
                  onChange={(event) => updateScene((scene) => ({
                    ...scene,
                    durationInFrames: Math.max(15, Math.round(Number(event.target.value) * project.fps)),
                  }))}
                />
                <span>sec</span>
              </div>
            </label>
            <label className="field">
              <span>{translate("layout")}</span>
              <select value={selectedScene.layout} onChange={(event) => updateScene((scene) => ({ ...scene, layout: event.target.value as Scene["layout"] }))}>
                <option value="device">Device</option>
                <option value="full">Full frame</option>
                <option value="split">Split</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>{translate("transition")}</span>
            <div className="transition-grid">
              {(["none", "fade", "slide", "scale"] as Scene["transition"][]).map((item) => (
                <button key={item} className={selectedScene.transition === item ? "active" : ""} onClick={() => updateScene((scene) => ({ ...scene, transition: item }))}>{item}</button>
              ))}
            </div>
          </label>
          <div className="field-grid colors">
            <label className="field"><span>Background</span><input type="color" value={selectedScene.background} onChange={(event) => updateScene((scene) => ({ ...scene, background: event.target.value }))} /></label>
            <label className="field"><span>Accent</span><input type="color" value={selectedScene.accent} onChange={(event) => updateScene((scene) => ({ ...scene, accent: event.target.value }))} /></label>
          </div>
        </aside>
      </div>

      <section className="timeline">
        <div className="timeline-heading">
          <span className="kicker">02</span><strong>{translate("scenes")}</strong>
          <span>{(durationFor(project) / project.fps).toFixed(1)} sec</span>
          <button className="icon-button" title="Add scene" onClick={() => addScene(project, updateProject, setSelectedSceneId)}><Plus size={16} /></button>
        </div>
        <div className="scene-strip">
          {project.scenes.map((scene, index) => {
            const asset = project.assets.find((entry) => entry.id === scene.assetId);
            return (
              <button
                key={scene.id}
                className={`scene-card ${selectedScene.id === scene.id ? "selected" : ""}`}
                onClick={() => startTransition(() => setSelectedSceneId(scene.id))}
              >
                <span className="scene-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="scene-preview" style={{ background: scene.background }}>
                  {asset && (asset.mediaType === "image" || asset.mediaType === "gif") ? (
                    <img src={assetUrl(project.id, asset.id)} alt="" />
                  ) : <FileImage size={18} />}
                </span>
                <span className="scene-meta"><strong>{scene.name}</strong><small>{(scene.durationInFrames / project.fps).toFixed(1)}s</small></span>
              </button>
            );
          })}
        </div>
        <div className="timeline-actions">
          <button title="Move scene earlier" onClick={() => moveScene(-1)}><ArrowUp size={15} /></button>
          <button title="Move scene later" onClick={() => moveScene(1)}><ArrowDown size={15} /></button>
          <button title="Delete scene" disabled={project.scenes.length === 1} onClick={deleteScene}><Trash2 size={15} /></button>
        </div>
      </section>

      {notice ? <div className="toast"><CircleAlert size={17} /><span>{notice}</span><button onClick={() => setNotice(null)}><X size={15} /></button></div> : null}

      {modal === "onboarding" ? <Onboarding settings={settings} onComplete={completeOnboarding} /> : null}
      {modal === "settings" ? <SettingsModal settings={settings} onClose={() => setModal(null)} onSave={saveSettings} /> : null}
      {modal === "locale" ? <LocaleModal project={project} busy={busy === "translation"} onClose={() => setModal(null)} onGenerate={(code) => void generate("translation", code)} /> : null}
      {modal === "proposal" && proposal ? <ProposalModal proposal={proposal} busy={busy === "apply"} onClose={() => { setProposal(null); setModal(null); }} onApply={() => void applyProposal()} /> : null}
      {modal === "export" ? <ExportModal project={project} job={renderJob} onClose={() => { setModal(null); setRenderJob(null); }} onStart={startRender} onCancel={() => renderJob && void api.cancelRender(renderJob.id).then(setRenderJob)} /> : null}
    </div>
  );

  async function createNewProject() {
    const next = await api.createProject("Untitled Lumiveo project");
    setProject(next);
    setSelectedSceneId(next.scenes[0].id);
    setDirty(false);
  }

  function moveScene(direction: -1 | 1) {
    const active = project;
    if (!active) return;
    const index = active.scenes.findIndex((scene) => scene.id === selectedSceneId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= active.scenes.length) return;
    updateProject((current) => {
      const scenes = [...current.scenes];
      [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
      return { ...current, scenes };
    });
  }

  function deleteScene() {
    const active = project;
    if (!active || active.scenes.length === 1) return;
    const index = active.scenes.findIndex((scene) => scene.id === selectedSceneId);
    const next = active.scenes.filter((scene) => scene.id !== selectedSceneId);
    setSelectedSceneId(next[Math.max(0, index - 1)].id);
    updateProject((current) => ({ ...current, scenes: next }));
  }

  async function completeOnboarding(next: {
    provider: AppSettings["ai"]["provider"];
    model: string;
    endpoint: string;
    credential: string;
    analyticsEnabled: boolean;
  }) {
    const configured = await api.configureAi(next);
    const completed = await api.saveSettings({
      ...configured,
      onboardingComplete: true,
      analyticsEnabled: next.analyticsEnabled,
      analyticsProvider: next.analyticsEnabled ? "posthog" : "none",
    });
    setSettings(completed);
    setModal(null);
    void api.track("onboarding_completed", { provider: next.provider });
  }

  async function saveSettings(next: AppSettings & { credential?: string; ttsCredential?: string }) {
    const configured = await api.configureAi({ ...next.ai, credential: next.credential });
    const withTts = await api.configureTts({ ...next.tts, credential: next.ttsCredential });
    const saved = await api.saveSettings({ ...next, ai: configured.ai, tts: withTts.tts });
    setSettings(saved);
    document.documentElement.lang = saved.uiLocale;
    setModal(null);
  }

}


function LaunchScreen({ status, logs, retry }: { status: "booting" | "ready" | "offline"; logs: string[]; retry: () => Promise<void> }) {
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle boot logs visibility with CMD + Option + L (or CTRL + Alt + L)
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setShowConsole(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main className="launch-screen">
      <div className="launch-art"><span /><span /><span /><Clapperboard size={38} /></div>
      <p>LUMIVEO</p>
      <h1>{status === "offline" ? "The local studio is unavailable" : "Preparing your studio"}</h1>
      <span>
        {status === "offline" 
          ? "Start the local worker, then reconnect. (Press Cmd+Option+L to view connection logs)" 
          : "Loading projects and render services…"}
      </span>
      
      {showConsole && (
        <div className="boot-logs-console" style={{
          marginTop: "24px",
          marginBottom: "24px",
          width: "100%",
          maxWidth: "600px",
          maxHeight: "220px",
          background: "#121210",
          border: "1px solid #2d2d26",
          borderRadius: "8px",
          padding: "14px",
          textAlign: "left",
          fontFamily: "monospace",
          fontSize: "12px",
          color: "#d4d4cb",
          overflowY: "auto",
          lineHeight: "1.5"
        }}>
          {logs.map((log, idx) => (
            <div key={idx} style={{ 
              color: log.includes("CRITICAL ERROR") ? "#ff6b6b" : log.includes("succeeded") || log.includes("successfully") ? "#9be9a8" : "#d4d4cb",
              marginBottom: "4px"
            }}>
              {log}
            </div>
          ))}
          {logs.length === 0 && <div style={{ color: "#7a7a70" }}>Awaiting initialization steps...</div>}
        </div>
      )}

      {status === "offline" ? (
        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
          <button className="primary-button" onClick={() => void retry()}><RotateCcw size={15} /> Retry Connection</button>
          <button className="quiet-button" onClick={() => setShowConsole(prev => !prev)}>
            {showConsole ? "Hide Logs" : "Show Logs"}
          </button>
        </div>
      ) : <div className="loading-line"><i /></div>}
    </main>
  );
}

function Onboarding({
  settings,
  onComplete,
}: {
  settings: AppSettings;
  onComplete: (input: {
    provider: AppSettings["ai"]["provider"];
    model: string;
    endpoint: string;
    credential: string;
    analyticsEnabled: boolean;
  }) => Promise<void>;
}) {
  const [provider, setProvider] = useState(settings.ai.provider);
  const [credential, setCredential] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = providerMeta[provider];
  const local = provider === "local";
  return (
    <div className="modal-backdrop onboarding-backdrop">
      <div className="modal onboarding-card">
        <div className="onboarding-visual"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><span><Sparkles size={32} /></span></div>
        <div className="onboarding-copy">
          <span className="kicker">WELCOME TO THE STUDIO</span>
          <h1>{t(settings.uiLocale, "onboardingTitle")}</h1>
          <p>{t(settings.uiLocale, "onboardingBody")}</p>
          <div className="provider-grid">
            {providerOrder.map((item) => (
              <button key={item} className={provider === item ? "active" : ""} onClick={() => setProvider(item)}>
                <span>{item === "local" ? "⌁" : providerMeta[item].label[0]}</span><strong>{providerMeta[item].label}</strong><small>{providerMeta[item].tagline}</small>
              </button>
            ))}
          </div>
          {!local ? <div className="onboarding-fields">
            <ModelPicker provider={provider} value={model} onChange={setModel} endpoint={endpoint} credential={credential} />
            {meta.needsEndpoint ? <label className="field"><span>Endpoint</span><input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={meta.endpointPlaceholder} /></label> : null}
            {meta.needsKey ? <>
              <label className="field"><span>API key {meta.keyOptional ? "(optional)" : ""}</span><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="Stored in macOS Keychain" /></label>
              {meta.keyUrl ? <KeyLink url={meta.keyUrl} label={meta.keyLabel} /> : null}
            </> : null}
          </div> : null}
          <label className="consent-row"><input type="checkbox" checked={analyticsEnabled} onChange={(event) => setAnalyticsEnabled(event.target.checked)} /><span><strong>{t(settings.uiLocale, "analyticsLabel")}</strong><small>No prompts, content, file paths, names or API keys.</small></span></label>
          <button className="primary-button onboarding-continue" disabled={busy} onClick={async () => { setBusy(true); await onComplete({ provider, model, endpoint, credential, analyticsEnabled }).finally(() => setBusy(false)); }}>
            {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} {t(settings.uiLocale, "continue")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ settings, onClose, onSave }: { settings: AppSettings; onClose: () => void; onSave: (settings: AppSettings & { credential?: string; ttsCredential?: string }) => Promise<void> }) {
  const [draft, setDraft] = useState(settings);
  const [credential, setCredential] = useState("");
  const [ttsCredential, setTtsCredential] = useState("");
  const [busy, setBusy] = useState(false);
  return <ModalFrame title="Studio settings" subtitle="Providers, privacy and language" onClose={onClose}>
    <div className="settings-sections">
      <section><h3>Application</h3><div className="field-grid">
        <label className="field"><span>Interface language</span><select value={draft.uiLocale} onChange={(event) => setDraft({ ...draft, uiLocale: event.target.value })}><option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="ar">العربية</option></select></label>
        <label className="field"><span>Analytics adapter</span><select value={draft.analyticsProvider} onChange={(event) => setDraft({ ...draft, analyticsProvider: event.target.value as AppSettings["analyticsProvider"] })}><option value="none">None</option><option value="posthog">PostHog</option><option value="firebase">Firebase</option></select></label>
      </div><label className="consent-row compact"><input type="checkbox" checked={draft.analyticsEnabled} onChange={(event) => setDraft({ ...draft, analyticsEnabled: event.target.checked })} /><span><strong>Send allowlisted events and sanitized exceptions</strong><small>Never includes project content or personal file data.</small></span></label></section>
      <section><h3>AI provider</h3><div className="field-grid">
        <label className="field"><span>Provider</span><select value={draft.ai.provider} onChange={(event) => setDraft({ ...draft, ai: { ...draft.ai, provider: event.target.value as AppSettings["ai"]["provider"] } })}>{providerOrder.map((item) => <option key={item} value={item}>{providerMeta[item].label}</option>)}</select></label>
        <ModelPicker provider={draft.ai.provider} value={draft.ai.model} onChange={(model) => setDraft({ ...draft, ai: { ...draft.ai, model } })} endpoint={draft.ai.endpoint} credential={credential || undefined} />
      </div>{providerMeta[draft.ai.provider].needsEndpoint ? <label className="field"><span>Endpoint</span><input value={draft.ai.endpoint} onChange={(event) => setDraft({ ...draft, ai: { ...draft.ai, endpoint: event.target.value } })} placeholder={providerMeta[draft.ai.provider].endpointPlaceholder} /></label> : null}{providerMeta[draft.ai.provider].needsKey ? <><label className="field"><span>API key {draft.ai.hasCredential ? "· configured" : ""}{providerMeta[draft.ai.provider].keyOptional ? " · optional" : ""}</span><input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="Leave blank to keep current key" /></label>{providerMeta[draft.ai.provider].keyUrl ? <KeyLink url={providerMeta[draft.ai.provider].keyUrl!} label={providerMeta[draft.ai.provider].keyLabel} /> : null}</> : null}</section>
      <section><h3>Voiceover</h3><div className="field-grid"><label className="field"><span>Provider</span><select value={draft.tts.provider} onChange={(event) => setDraft({ ...draft, tts: { ...draft.tts, provider: event.target.value as AppSettings["tts"]["provider"] } })}><option value="none">None</option><option value="elevenlabs">ElevenLabs</option></select></label><label className="field"><span>Voice ID</span><input value={draft.tts.voiceId} onChange={(event) => setDraft({ ...draft, tts: { ...draft.tts, voiceId: event.target.value } })} /></label></div><label className="field"><span>TTS key {draft.tts.hasCredential ? "· configured" : ""}</span><input type="password" value={ttsCredential} onChange={(event) => setTtsCredential(event.target.value)} placeholder="Stored in macOS Keychain" /></label><KeyLink url={ttsKeyUrl} label="elevenlabs.io/app/settings/api-keys" /></section>
    </div>
    <div className="modal-actions"><button className="quiet-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy} onClick={async () => { setBusy(true); await onSave({ ...draft, credential, ttsCredential }).finally(() => setBusy(false)); }}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save settings</button></div>
  </ModalFrame>;
}

function LocaleModal({ project, busy, onClose, onGenerate }: { project: Project; busy: boolean; onClose: () => void; onGenerate: (locale: string) => void }) {
  const [locale, setLocale] = useState("es");
  return <ModalFrame title="Add a localised edition" subtitle={`Source language: ${project.sourceLocale}`} onClose={onClose}>
    <div className="locale-options">{[{ code: "es", label: "Español", sample: "Una historia clara" }, { code: "fr", label: "Français", sample: "Une histoire claire" }, { code: "de", label: "Deutsch", sample: "Eine klare Geschichte" }, { code: "zh-CN", label: "简体中文", sample: "清晰讲述产品故事" }, { code: "ar", label: "العربية", sample: "قصة واضحة لمنتجك" }, { code: "ja", label: "日本語", sample: "製品の魅力を明確に" }].map((item) => <button key={item.code} className={locale === item.code ? "active" : ""} onClick={() => setLocale(item.code)}><span>{item.code.toUpperCase()}</span><strong>{item.label}</strong><small>{item.sample}</small></button>)}</div>
    <p className="privacy-note">Only scene text and product context are sent to the configured provider. Imported media stays on this Mac.</p>
    <div className="modal-actions"><button className="quiet-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy} onClick={() => onGenerate(locale)}>{busy ? <LoaderCircle className="spin" size={15} /> : <Languages size={15} />} Generate locale</button></div>
  </ModalFrame>;
}

function ProposalModal({ proposal, busy, onClose, onApply }: { proposal: StoryboardProposal; busy: boolean; onClose: () => void; onApply: () => void }) {
  return <ModalFrame title={proposal.operation === "translation" ? `Localised draft · ${proposal.locale}` : "Storyboard draft"} subtitle={`${proposal.provider} · ${proposal.model}`} onClose={onClose} wide>
    <p className="proposal-summary">{proposal.summary}</p><div className="proposal-scenes">{proposal.scenes.map((scene, index) => <article key={`${scene.sourceSceneId}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{scene.name}</strong><p>{scene.caption}</p><small>{scene.narration}</small></div><em>{scene.durationSeconds.toFixed(1)}s</em></article>)}</div>
    <div className="modal-actions"><button className="quiet-button" onClick={onClose}>Discard</button><button className="primary-button" disabled={busy} onClick={onApply}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Accept draft</button></div>
  </ModalFrame>;
}

function ExportModal({ project, job, onClose, onStart, onCancel }: { project: Project; job: RenderJob | null; onClose: () => void; onStart: (input: { preset: ExportPreset; format: ExportFormat; locale: string }) => Promise<void>; onCancel: () => void }) {
  const [preset, setPreset] = useState<ExportPreset>("portrait");
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [locale, setLocale] = useState(project.activeLocale);
  const active = job && ["queued", "running"].includes(job.status);
  return <ModalFrame title="Export master" subtitle="Render locally on this Mac" onClose={onClose}>
    {job ? <div className={`render-status ${job.status}`}><div className="render-status-head"><span>{job.status === "completed" ? <Check size={20} /> : job.status === "failed" ? <CircleAlert size={20} /> : <LoaderCircle className={active ? "spin" : ""} size={20} />}</span><div><strong>{job.status === "completed" ? "Export complete" : job.status === "failed" ? "Export failed" : "Rendering your demo"}</strong><small>{job.output_path ?? job.error_code ?? `${Math.round(job.progress * 100)}%`}</small></div></div><div className="progress-track"><i style={{ width: `${job.progress * 100}%` }} /></div></div> : <>
      <div className="export-presets">{(["portrait", "landscape", "square"] as const).map((item) => <button key={item} className={preset === item ? "active" : ""} onClick={() => setPreset(item)}><span className={`frame-icon ${item}`} /><strong>{item}</strong><small>{presetDimensions[item].width} × {presetDimensions[item].height}</small></button>)}</div>
      <div className="field-grid"><label className="field"><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}><option value="mp4">MP4 · H.264</option><option value="gif">Animated GIF</option><option value="png-sequence">PNG sequence</option></select></label><label className="field"><span>Content locale</span><select value={locale} onChange={(event) => setLocale(event.target.value)}>{project.locales.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}</select></label></div>
      <div className="export-summary"><span>Duration</span><strong>{(durationFor(project) / project.fps).toFixed(1)} seconds</strong><span>Frames</span><strong>{durationFor(project).toLocaleString()}</strong></div>
    </>}
    <div className="modal-actions"><button className="quiet-button" onClick={active ? onCancel : onClose}>{active ? "Cancel render" : "Close"}</button>{!job ? <button className="primary-button" onClick={() => void onStart({ preset, format, locale })}><Download size={15} /> Start export</button> : null}</div>
  </ModalFrame>;
}

function ModalFrame({ title, subtitle, onClose, wide, children }: { title: string; subtitle: string; onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className="modal-backdrop"><div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true"><div className="modal-header"><div><span className="kicker">LUMIVEO</span><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
}

function updateSceneCopy(updateScene: (updater: (scene: Scene) => Scene) => void, scene: Scene, locale: string, field: "caption" | "narration", value: string) {
  const fallback = scene.copy[locale] ?? scene.copy[Object.keys(scene.copy)[0]] ?? { caption: "", narration: "", manuallyEdited: false, stale: false };
  updateScene((current) => ({ ...current, copy: { ...current.copy, [locale]: { ...fallback, [field]: value, manuallyEdited: true, stale: false } } }));
}

function addScene(project: Project, updateProject: (updater: (current: Project) => Project) => void, select: (id: string) => void) {
  const id = crypto.randomUUID();
  const locale = project.activeLocale;
  const scene: Scene = { id, name: `Scene ${project.scenes.length + 1}`, assetId: null, durationInFrames: project.fps * 3, transition: "fade", layout: "device", background: "#171714", accent: "#e6ff5c", copy: { [locale]: { caption: "Describe the next product moment.", narration: "Explain what the user can accomplish here.", manuallyEdited: false, stale: false } } };
  updateProject((current) => ({ ...current, scenes: [...current.scenes, scene] }));
  select(id);
}

function normalizeDialogPaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return [value];
  if (value && typeof value === "object" && "paths" in value && Array.isArray(value.paths)) return value.paths.filter((item): item is string => typeof item === "string");
  return [];
}

function mimeFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "heic"].includes(extension ?? "")) return `image/${extension === "jpg" ? "jpeg" : extension}`;
  if (extension === "gif") return "image/gif";
  if (["mp4", "mov", "webm", "m4v"].includes(extension ?? "")) return extension === "mov" ? "video/quicktime" : `video/${extension}`;
  if (["mp3", "wav", "m4a", "aac"].includes(extension ?? "")) return `audio/${extension}`;
  return "application/octet-stream";
}

declare global {
  interface Window {
    zero?: {
      invoke(command: string, payload: unknown): Promise<unknown>;
    };
  }
}
