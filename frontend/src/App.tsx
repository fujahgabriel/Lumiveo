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
  X,
} from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { api, assetUrl, resolveWorkerEndpoint, workerUrl, workerToken, sendNotification } from "./api";
import {
  BrandHeader,
  ExportModal,
  LaunchScreen,
  LocaleModal,
  Onboarding,
  ProjectHistoryModal,
  ProposalModal,
  SettingsPage,
  TemplatePickerModal,
} from "./components";
import { t, uiDirection } from "./i18n";
import { defaultSettings } from "./lib/defaultSettings";
import { addScene, mimeFromPath, normalizeDialogPaths, updateSceneCopy } from "./lib/projectHelpers";
import { devicePresets } from "./video/AppDemoComposition";
import { APP_NAME } from "./lib/constants";
import { ProjectWizard } from "./ProjectWizard";
import { StageView } from "./StageView";
import type {
  AppSettings,
  ExportFormat,
  ExportPreset,
  Project,
  ProjectListItem,
  RenderJob,
  Scene,
  StoryboardProposal,
} from "./types";
import { durationFor, presetDimensions } from "./video/config";
import { type ProjectTemplate } from "./video/templates";

const fontWeightsMap: Record<string, { value: string; label: string }[]> = {
  "Inter": [
    { value: "100", label: "Thin (100)" },
    { value: "200", label: "Extra Light (200)" },
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extra Bold (800)" },
    { value: "900", label: "Black (900)" },
  ],
  "Roboto": [
    { value: "100", label: "Thin (100)" },
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "700", label: "Bold (700)" },
    { value: "900", label: "Black (900)" },
  ],
  "Poppins": [
    { value: "100", label: "Thin (100)" },
    { value: "200", label: "Extra Light (200)" },
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extra Bold (800)" },
    { value: "900", label: "Black (900)" },
  ],
  "Montserrat": [
    { value: "100", label: "Thin (100)" },
    { value: "200", label: "Extra Light (200)" },
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extra Bold (800)" },
    { value: "900", label: "Black (900)" },
  ],
  "Playfair Display": [
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extra Bold (800)" },
    { value: "900", label: "Black (900)" },
  ],
  "Lora": [
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
  ],
  "Merriweather": [
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "700", label: "Bold (700)" },
    { value: "900", label: "Black (900)" },
  ],
  "Syne": [
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extra Bold (800)" },
  ],
  "Space Grotesque": [
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
  ],
  "Bricolage Grotesque": [
    { value: "200", label: "Extra Light (200)" },
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extra Bold (800)" },
  ],
  "JetBrains Mono": [
    { value: "100", label: "Thin (100)" },
    { value: "200", label: "Extra Light (200)" },
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
    { value: "800", label: "Extra Bold (800)" },
  ],
  "Fira Code": [
    { value: "300", label: "Light (300)" },
    { value: "400", label: "Regular (400)" },
    { value: "500", label: "Medium (500)" },
    { value: "600", label: "Semi Bold (600)" },
    { value: "700", label: "Bold (700)" },
  ],
};

type Modal = "onboarding" | "wizard" | "settings" | "export" | "locale" | "proposal" | null;

export default function App() {
  const [status, setStatus] = useState<"booting" | "ready" | "offline">("booting");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [project, setProject] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<ProjectListItem[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [preset, setPreset] = useState<ExportPreset>("portrait");
  const [modal, setModal] = useState<Modal>(null);
  const [proposal, setProposal] = useState<StoryboardProposal | null>(null);
  const [renderJob, setRenderJob] = useState<RenderJob | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice: typeof setNotice = (value) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(value);
    if (value) noticeTimer.current = setTimeout(() => setNotice(null), 5_000);
  };
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showProjectHistoryModal, setShowProjectHistoryModal] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const deferredProject = useDeferredValue(project);
  const [voices, setVoices] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [playingBgMusic, setPlayingBgMusic] = useState(false);
  const bgMusicPlayerRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayAudio = (assetId: string) => {
    if (playingAudioId === assetId) {
      audioPlayerRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const url = assetUrl(project!.id, assetId);
      audioPlayerRef.current = new Audio(url);
      audioPlayerRef.current.onended = () => setPlayingAudioId(null);
      void audioPlayerRef.current.play();
      setPlayingAudioId(assetId);
    }
  };

  const togglePlayBgMusic = () => {
    if (playingBgMusic) {
      bgMusicPlayerRef.current?.pause();
      setPlayingBgMusic(false);
    } else {
      if (bgMusicPlayerRef.current) {
        bgMusicPlayerRef.current.pause();
      }
      const rawUrl = project?.backgroundAudioId
        ? assetUrl(project.id, project.backgroundAudioId)
        : project?.backgroundAudioUrl || null;
        
      if (!rawUrl) return;
      
      const finalUrl = rawUrl.startsWith("http") && !rawUrl.includes("127.0.0.1")
        ? `${workerUrl}/v1/system/proxy?url=${encodeURIComponent(rawUrl)}&token=${encodeURIComponent(workerToken)}`
        : rawUrl;

      bgMusicPlayerRef.current = new Audio(finalUrl);
      bgMusicPlayerRef.current.volume = project?.backgroundAudioVolume ?? 0.15;
      bgMusicPlayerRef.current.onended = () => setPlayingBgMusic(false);
      void bgMusicPlayerRef.current.play();
      setPlayingBgMusic(true);
    }
  };

  useEffect(() => {
    return () => {
      audioPlayerRef.current?.pause();
      bgMusicPlayerRef.current?.pause();
    };
  }, [project?.id]);

  const refreshVoicesList = useCallback(async () => {
    if (settings.tts.provider !== "elevenlabs") return;
    setLoadingVoices(true);
    setVoicesError(null);
    try {
      const res = await api.getTtsVoices();
      setVoices(res.voices);
    } catch (err: any) {
      setVoicesError(err?.message || "failed_to_load_voices");
      setVoices([]);
    } finally {
      setLoadingVoices(false);
    }
  }, [settings.tts.provider]);

  useEffect(() => {
    if (settings.tts.provider === "elevenlabs" && voices.length === 0 && !loadingVoices && !voicesError) {
      void refreshVoicesList();
    }
  }, [settings.tts.provider, voices.length, loadingVoices, voicesError, refreshVoicesList]);

  const addLog = (msg: string) => {
    setBootLogs(current => [...current, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const refreshProjectsList = useCallback(async () => {
    try {
      const list = await api.projects();
      setProjectsList(Array.isArray(list) ? list : []);
    } catch {
      /* keep existing list */
    }
  }, []);

  const selectProject = async (id: string) => {
    setBusy("load-project");
    try {
      const nextProject = await api.project(id);
      setProject(nextProject);
      const date = new Date(nextProject.updatedAt);
      setLastSavedTime(Number.isNaN(date.getTime()) ? new Date().toLocaleTimeString() : date.toLocaleTimeString());
      if (nextProject.scenes && nextProject.scenes.length > 0) {
        setSelectedSceneId(nextProject.scenes[0].id);
      } else {
        setSelectedSceneId("");
      }
      setShowProjectHistoryModal(false);
      showNotice(`Loaded project: "${nextProject.title}"`);
    } catch {
      showNotice("Failed to load project details.");
    } finally {
      setBusy(null);
    }
  };

  const applyTemplate = (template: ProjectTemplate) => {
    console.log("[Templates] Attempting to apply template:", template);
    try {
      if (!project) {
        showNotice("No active project to apply a template to.");
        return;
      }
      updateProject((current) => {
        const locale = current.activeLocale;
        const scenes = template.scenes.map((sceneTpl, index) => {
          const sid = crypto.randomUUID();
          if (index === 0) {
            setTimeout(() => setSelectedSceneId(sid), 10);
          }
          return {
            id: sid,
            name: sceneTpl.name,
            assetId: null,
            durationInFrames: sceneTpl.durationInFrames,
            transition: sceneTpl.transition,
            layout: sceneTpl.layout,
            background: sceneTpl.background,
            accent: sceneTpl.accent,
            copy: {
              [locale]: {
                caption: sceneTpl.caption,
                narration: sceneTpl.narration,
                manuallyEdited: false,
                stale: false,
              },
            },
          };
        });
        return { ...current, title: template.name, scenes };
      });
      showNotice(`Successfully applied "${template.name}" template!`);
      setShowTemplateModal(false);
    } catch (e: any) {
      console.error("[Templates Error] Failed to apply template:", e);
      showNotice(`Failed to apply template: ${e?.message || String(e)}`);
    }
  };

  async function createNewProject() {
    setModal("wizard");
  }

  const handleWizardResult = async (title: string, scenes: Scene[], productName?: string, productDescription?: string) => {
    try {
      const next = await api.createProject(title);
      const saved = await api.saveProject({
        ...next,
        scenes,
        productName: productName || title,
        productDescription: productDescription || "",
      });
      setProject(saved);
      setSelectedSceneId(saved.scenes[0]?.id ?? "");
      setDirty(false);
      setModal(null);
      await refreshProjectsList();
      showNotice(`Project "${title}" created!`);
    } catch {
      showNotice("Failed to create project.");
    }
  };

  const triggerSave = useCallback(async () => {
    if (!project) return;
    setSaving(true);
    try {
      const saved = await api.saveProject(project);
      setProject(saved);
      setDirty(false);
      const date = new Date(saved.updatedAt);
      setLastSavedTime(Number.isNaN(date.getTime()) ? new Date().toLocaleTimeString() : date.toLocaleTimeString());
      showNotice("Changes synced and saved to disk.");
    } catch (err: any) {
      console.error("[Manual Save Error]", err);
      showNotice(`Could not save: ${err?.message || "Check settings or connection."}`);
    } finally {
      setSaving(false);
    }
  }, [project]);

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
      if (nextSettings.tts.provider === "elevenlabs") {
        addLog("Retrieving ElevenLabs voices from credential...");
        try {
          const res = await api.getTtsVoices();
          setVoices(res.voices);
          addLog(`Loaded ${res.voices.length} ElevenLabs voices!`);
        } catch {
          addLog("No voices loaded (TTS credential might be empty or invalid)");
        }
      }
      addLog(`Loaded projects successfully! Count: ${list.length}`);
      setProjectsList(list);
      
      addLog("Retrieving default project details...");
      const nextProject = list[0]
        ? await api.project(list[0].id)
        : await api.createProject(`Untitled ${APP_NAME} project`);
      addLog(`Project loaded successfully! Title: "${nextProject.title}"`);
      
      setSettings(nextSettings);
      setProject(nextProject);
      const date = new Date(nextProject.updatedAt);
      setLastSavedTime(Number.isNaN(date.getTime()) ? new Date().toLocaleTimeString() : date.toLocaleTimeString());
      if (nextProject.scenes && nextProject.scenes.length > 0) {
        setSelectedSceneId(nextProject.scenes[0].id);
      } else {
        setSelectedSceneId("");
      }
      setModal(nextSettings.onboardingComplete ? "wizard" : "onboarding");
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
    const handleNew = () => {
      void createNewProject();
    };
    const handleSave = () => { void triggerSave(); };
    const handleImport = () => void openNativeImport();
    const handleExport = () => setModal("export");
    const handleSettings = () => setModal("settings");
    
    const execCmd = (cmd: string) => {
      const el = document.activeElement as HTMLElement;
      if (el && (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        document.execCommand(cmd);
      }
    };
    const handleUndo = () => execCmd("undo");
    const handleRedo = () => execCmd("redo");
    const handleCut = () => execCmd("cut");
    const handleCopy = () => execCmd("copy");
    const handlePaste = () => execCmd("paste");
    const handleSelectAll = () => execCmd("selectAll");
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void triggerSave();
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "n") {
        event.preventDefault();
        handleNew();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("app.new", handleNew);
    window.addEventListener("app.save", handleSave);
    window.addEventListener("app.import", handleImport);
    window.addEventListener("app.export", handleExport);
    window.addEventListener("app.settings", handleSettings);
    window.addEventListener("app.undo", handleUndo);
    window.addEventListener("app.redo", handleRedo);
    window.addEventListener("app.cut", handleCut);
    window.addEventListener("app.copy", handleCopy);
    window.addEventListener("app.paste", handlePaste);
    window.addEventListener("app.selectAll", handleSelectAll);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("app.new", handleNew);
      window.removeEventListener("app.save", handleSave);
      window.removeEventListener("app.import", handleImport);
      window.removeEventListener("app.export", handleExport);
      window.removeEventListener("app.settings", handleSettings);
      window.removeEventListener("app.undo", handleUndo);
      window.removeEventListener("app.redo", handleRedo);
      window.removeEventListener("app.cut", handleCut);
      window.removeEventListener("app.copy", handleCopy);
      window.removeEventListener("app.paste", handlePaste);
      window.removeEventListener("app.selectAll", handleSelectAll);
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
          const date = new Date(saved.updatedAt);
          setLastSavedTime(Number.isNaN(date.getTime()) ? new Date().toLocaleTimeString() : date.toLocaleTimeString());
        }
      } catch {
        showNotice("Could not save. Your edits remain in this window.");
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
      if (!next) return;
      if (next.status === "completed" && renderJob.status !== "completed") {
        notifyOS("Export Complete", `Your demo video is ready.`);
      } else if (next.status === "failed" && renderJob.status !== "failed") {
        notifyOS("Export Failed", next.error_code ?? "An error occurred during rendering.");
      }
      setRenderJob(next);
    }, 800);
    return () => window.clearInterval(timer);
  }, [renderJob, settings.notificationsEnabled]);

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
      showNotice("One or more media files could not be imported.");
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
      notifyOS("Storyboard Ready", operation === "translation" ? `${locale} translation is ready for review.` : "Your storyboard has been generated.");
    } catch {
      showNotice("Generation failed. Check your AI provider in Settings and try again.");
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
    } catch {
      showNotice("Failed to apply storyboard.");
    } finally {
      setBusy(null);
    }
  };

  const startRender = async (input: { preset: ExportPreset; format: ExportFormat; locale: string }) => {
    if (!project) return;
    try {
      const job = await api.startRender({ projectId: project.id, ...input });
      setRenderJob(job);
    } catch {
      showNotice("Failed to start export. Check your render config.");
    }
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
      showNotice("Voiceover generated.");
      notifyOS("Voiceover Ready", "Narration has been generated for this scene.");
    } catch {
      showNotice("Voiceover failed. Check ElevenLabs config.");
    } finally {
      setBusy(null);
    }
  };

  const deleteProjectAsset = async (assetId: string, name: string) => {
    if (!project) return;
    if (!confirm(`Are you sure you want to permanently delete "${name}"? This will delete the file from your disk and cannot be undone.`)) return;
    try {
      const result = await api.deleteAsset(project.id, assetId);
      updateProject(() => result.project);
      showNotice(`Permanently deleted "${name}"`);
    } catch {
      showNotice("Failed to delete asset.");
    }
  };

  const regenerateSceneField = async (sceneId: string, fields: Array<"caption" | "narration" | "name" | "layout">) => {
    if (!project) return;
    setBusy("scene-regen");
    try {
      const result = await api.regenerateScene({ projectId: project.id, sceneId, fields });
      updateProject((current) => {
        const scenes = current.scenes.map((scene) => {
          if (scene.id !== sceneId) return scene;
          const copy = { ...scene.copy };
          const locale = current.activeLocale;
          const currentCopy = copy[locale] ?? copy[current.sourceLocale] ?? { caption: "", narration: "", manuallyEdited: false, stale: false };
          copy[locale] = {
            ...currentCopy,
            caption: result.caption ?? currentCopy.caption,
            narration: result.narration ?? currentCopy.narration,
            stale: false,
          };
          return {
            ...scene,
            name: result.name ?? scene.name,
            layout: (result.layout as Scene["layout"]) ?? scene.layout,
            copy,
          };
        });
        return { ...current, scenes };
      });
      showNotice(`Regenerated ${fields.join(" & ")}.`);
    } catch {
      showNotice("Regeneration failed. Check your AI provider.");
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
        <BrandHeader />
        <div className="project-title no-drag" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            value={project.title}
            aria-label="Project title"
            onChange={(event) =>
              updateProject((current) => ({ ...current, title: event.target.value }))
            }
          />
          <span className="save-state" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-3)" }}>
            {saving ? (
              <>
                <LoaderCircle className="spin" size={12} />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Check size={12} style={{ color: "var(--accent)" }} />
                <span>{lastSavedTime ? `Saved at ${lastSavedTime}` : "Saved"}</span>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => void triggerSave()}
                  style={{
                    fontSize: "10px",
                    padding: "2px 6px",
                    background: "var(--bg-3)",
                    border: "1px solid var(--line)",
                    borderRadius: "4px",
                    color: "var(--text-2)",
                    marginLeft: "4px",
                    cursor: "pointer",
                  }}
                  title="Sync and Save Now"
                >
                  Sync
                </button>
              </>
            )}
          </span>
        </div>
        <div className="title-actions no-drag">
          <button className="quiet-button" title="Project History" onClick={() => setShowProjectHistoryModal(true)}>
            <FolderOpen size={15} /> Projects
          </button>
          <button className="quiet-button" style={{ color: "var(--accent)" }} onClick={() => setShowTemplateModal(true)}>
            <Sparkles size={15} /> Use Template
          </button>
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
          <div className="asset-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" }}>
            {project.assets.map((asset) => {
              const isAudio = asset.mediaType === "audio";
              const isSelected = isAudio 
                ? (asset.name === `voiceover-${selectedScene.id}.mp3` || asset.name.includes(selectedScene.id))
                : selectedScene.assetId === asset.id;
              
              return (
                <div
                  key={asset.id}
                  className={`asset-card ${isSelected ? "selected" : ""}`}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    background: "var(--bg-2)",
                    border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                    borderRadius: "var(--radius-m)",
                    padding: "10px",
                    boxSizing: "border-box",
                  }}
                >
                  <div className="asset-thumb" style={{ position: "relative", width: "100%", height: "80px", borderRadius: "var(--radius-s)", overflow: "hidden", display: "grid", placeItems: "center", background: "var(--bg-3)", userSelect: "none" }}>
                    {asset.mediaType === "image" || asset.mediaType === "gif" ? (
                      <img src={assetUrl(project.id, asset.id)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : asset.mediaType === "video" ? (
                      <Film size={23} style={{ color: "var(--text-2)" }} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <Volume2 size={20} style={{ color: "var(--text-2)" }} />
                        <button
                          type="button"
                          className="quiet-button"
                          onClick={() => togglePlayAudio(asset.id)}
                          style={{
                            fontSize: "10px",
                            padding: "2px 8px",
                            background: playingAudioId === asset.id ? "var(--accent)" : "var(--bg-hover)",
                            color: playingAudioId === asset.id ? "#000" : "var(--text-1)",
                            borderRadius: "12px",
                            fontWeight: "bold",
                            border: "none",
                            cursor: "pointer",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          }}
                        >
                          {playingAudioId === asset.id ? "Pause" : "Listen"}
                        </button>
                      </div>
                    )}
                    
                    {/* Floating Trash/Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteProjectAsset(asset.id, asset.name);
                      }}
                      style={{
                        position: "absolute",
                        top: "6px",
                        left: "6px",
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "rgba(20,20,18,0.85)",
                        color: "#ff6b6b",
                        border: "1px solid var(--line-strong)",
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
                        zIndex: 2,
                      }}
                      title="Delete asset permanently"
                    >
                      <Trash2 size={11} />
                    </button>

                    {/* Floating Select Plus/Check Toggle */}
                    {(!isAudio || isSelected) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isAudio) {
                            showNotice("Audio tracks are automatically assigned to scenes. To remove, use the red Trash button on the left.");
                          } else {
                            if (selectedScene.assetId === asset.id) {
                              updateScene((scene) => ({ ...scene, assetId: null }));
                              showNotice("Cleared scene background asset.");
                            } else {
                              updateScene((scene) => ({ ...scene, assetId: asset.id }));
                            }
                          }
                        }}
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: isSelected ? "var(--accent)" : "rgba(20,20,18,0.85)",
                          color: isSelected ? "#000" : "var(--text-1)",
                          border: "1px solid var(--line-strong)",
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          fontWeight: "bold",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
                          zIndex: 2,
                        }}
                        title={isSelected ? "Remove from scene" : "Apply to scene"}
                      >
                        {isSelected ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
                      </button>
                    )}
                  </div>
                  <small style={{ fontSize: "11px", color: "var(--text-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%", display: "block", textAlign: "center" }}>{asset.name}</small>
                </div>
              );
            })}
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
            <div className="ai-orb"><Sparkles size={18} /></div>
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
          <div className="field">
            <div className="field-label-row">
              <span>Scene name</span>
              <button className="field-regen" disabled={busy !== null} onClick={() => void regenerateSceneField(selectedScene.id, ["name"])}>
                <RotateCcw size={11} />
              </button>
            </div>
            <input value={selectedScene.name} onChange={(event) => updateScene((scene) => ({ ...scene, name: event.target.value }))} />
          </div>
          <div className="field">
            <div className="field-label-row">
              <span>{translate("caption")}</span>
              <button className="field-regen" disabled={busy !== null} onClick={() => void regenerateSceneField(selectedScene.id, ["caption"])}>
                <RotateCcw size={11} />
              </button>
            </div>
            <textarea
              rows={4}
              value={copy?.caption ?? ""}
              onChange={(event) => updateSceneCopy(updateScene, selectedScene, locale, "caption", event.target.value)}
            />
            <small>{copy?.caption.length ?? 0}/500</small>
          </div>
          <div className="field">
            <div className="field-label-row">
              <span>{translate("narration")}</span>
              <button className="field-regen" disabled={busy !== null} onClick={() => void regenerateSceneField(selectedScene.id, ["narration"])}>
                <RotateCcw size={11} />
              </button>
            </div>
            <textarea
              rows={5}
              value={copy?.narration ?? ""}
              onChange={(event) => updateSceneCopy(updateScene, selectedScene, locale, "narration", event.target.value)}
            />
            {settings.tts.provider === "elevenlabs" && (
              <label className="field" style={{ marginTop: "8px", marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Scene Voice Override</span>
                  {loadingVoices && <LoaderCircle className="spin" size={11} />}
                </div>
                <select
                  value={selectedScene.voiceId ?? ""}
                  onChange={(event) => updateScene((scene) => ({ ...scene, voiceId: event.target.value || null }))}
                  disabled={loadingVoices}
                >
                  {loadingVoices ? (
                    <option value="">Loading voices...</option>
                  ) : (
                    <>
                      <option value="">-- Use Default Voice --</option>
                      {voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                      {voicesError && <option disabled>Error loading voices: {voicesError}</option>}
                      {voices.length === 0 && !voicesError && <option disabled>No voices found (check key)</option>}
                    </>
                  )}
                </select>
              </label>
            )}
            <button className="quiet-button" disabled={busy === "tts" || !settings.tts.hasCredential} onClick={() => void generateVoiceover(selectedScene.id, copy?.narration ?? "")}>
              {busy === "tts" ? <LoaderCircle className="spin" size={12}/> : <Volume2 size={12}/>} Generate voiceover
            </button>
            <p style={{ margin: "6px 0 0", fontSize: "10px", color: "var(--text-3)", lineHeight: "1.4" }}>
              <strong>Tip:</strong> Use punctuation like <code>...</code>, <code>,</code>, <code>—</code>, or insert <code>&lt;break time="1s" /&gt;</code> to create natural pauses in ElevenLabs.
            </p>
          </div>
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
            <div className="field">
              <div className="field-label-row">
                <span>{translate("layout")}</span>
                <button className="field-regen" disabled={busy !== null} onClick={() => void regenerateSceneField(selectedScene.id, ["layout"])}>
                  <RotateCcw size={11} />
                </button>
              </div>
              <select value={selectedScene.layout} onChange={(event) => updateScene((scene) => ({ ...scene, layout: event.target.value as Scene["layout"] }))}>
                <option value="device">Device</option>
                <option value="full">Full frame</option>
                <option value="split">Split</option>
                <option value="minimal">Minimal (No Shadow)</option>
                <option value="gradient">Gradient Glow</option>
                <option value="highlight">Accent Highlight</option>
              </select>
            </div>
          </div>

          {selectedScene.layout !== "full" && (
            <label className="field" style={{ marginTop: "4px", marginBottom: "8px" }}>
              <span>Device Frame Preset</span>
              <select value={selectedScene.devicePreset ?? "iphone-6.7"} onChange={(event) => updateScene((scene) => ({ ...scene, devicePreset: event.target.value }))}>
                {Object.entries(devicePresets).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </label>
          )}

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

          <div style={{ borderTop: "1px solid var(--line)", marginTop: "16px", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h4 style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-3)" }}>Typography</h4>
            
            <div className="field-grid">
              <label className="field">
                <span>Font Family</span>
                <select value={selectedScene.fontFamily ?? "Inter"} onChange={(event) => updateScene((scene) => ({ ...scene, fontFamily: event.target.value }))}>
                  <option value="Inter">Inter</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Playfair Display">Playfair Display</option>
                  <option value="Merriweather">Merriweather</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Lora">Lora</option>
                  <option value="Syne">Syne</option>
                  <option value="Space Grotesque">Space Grotesque</option>
                  <option value="Bricolage Grotesque">Bricolage Grotesque</option>
                </select>
              </label>
              
              <label className="field">
                <span>Text Color</span>
                <input type="color" value={selectedScene.textColor ?? "#f7f7f2"} onChange={(event) => updateScene((scene) => ({ ...scene, textColor: event.target.value }))} />
              </label>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Font Size (px)</span>
                <input type="number" min={12} max={120} value={selectedScene.fontSize ?? 40} onChange={(event) => updateScene((scene) => ({ ...scene, fontSize: Number(event.target.value) }))} />
              </label>

              <label className="field">
                <span>Font Weight</span>
                <select value={selectedScene.fontWeight ?? "bold"} onChange={(event) => updateScene((scene) => ({ ...scene, fontWeight: event.target.value }))}>
                  {(fontWeightsMap[selectedScene.fontFamily ?? "Inter"] ?? fontWeightsMap["Inter"]).map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field-grid">
              <div className="field">
                <span>Italic</span>
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => updateScene((scene) => ({ ...scene, fontStyle: scene.fontStyle === "italic" ? "normal" : "italic" }))}
                  style={{
                    width: "100%",
                    fontStyle: "italic",
                    border: selectedScene.fontStyle === "italic" ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                    background: selectedScene.fontStyle === "italic" ? "var(--bg-3)" : "transparent",
                    height: "36px",
                  }}
                >
                  Italic (I)
                </button>
              </div>
              <label className="field">
                <span>Animation</span>
                <select value={selectedScene.textTransition ?? "fade"} onChange={(event) => updateScene((scene) => ({ ...scene, textTransition: event.target.value as any }))}>
                  <option value="fade">Smooth Fade</option>
                  <option value="typewriter">Typewriter</option>
                  <option value="slide">Slide Up (Rise)</option>
                  <option value="bounce">Bounce Zoom</option>
                  <option value="breathe">Slow Breathe</option>
                </select>
              </label>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--line)", marginTop: "16px", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h4 style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-3)" }}>Media Placement</h4>
            
            <div className="field-grid">
              <label className="field">
                <span>Fitting</span>
                <select value={selectedScene.mediaFit ?? "cover"} onChange={(event) => updateScene((scene) => ({ ...scene, mediaFit: event.target.value as any }))}>
                  <option value="cover">Cover (Fill)</option>
                  <option value="contain">Contain (Fit)</option>
                  <option value="fill">Stretch (Fill raw)</option>
                  <option value="none">Original size</option>
                </select>
              </label>
              <div className="field" style={{ visibility: "hidden" }} />
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Align Horizontal (X: {selectedScene.mediaX ?? 50}%)</span>
                <input type="range" min={0} max={100} value={selectedScene.mediaX ?? 50} onChange={(event) => updateScene((scene) => ({ ...scene, mediaX: Number(event.target.value) }))} />
              </label>

              <label className="field">
              <span>Align Vertical (Y: {selectedScene.mediaY ?? 50}%)</span>
              <input type="range" min={0} max={100} value={selectedScene.mediaY ?? 50} onChange={(event) => updateScene((scene) => ({ ...scene, mediaY: Number(event.target.value) }))} />
            </label>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", marginTop: "16px", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h4 style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-3)" }}>Soundtrack</h4>
          
          <div className="field" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div className="field-label-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Background Music</span>
              {(project.backgroundAudioUrl || project.backgroundAudioId) && (
                <button
                  type="button"
                  className="quiet-button"
                  onClick={togglePlayBgMusic}
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    background: playingBgMusic ? "var(--accent)" : "var(--bg-hover)",
                    color: playingBgMusic ? "#000" : "var(--text-1)",
                    borderRadius: "12px",
                    fontWeight: "bold",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {playingBgMusic ? "Pause Preview" : "Play Preview"}
                </button>
              )}
            </div>
            <select
              value={project.backgroundAudioUrl || project.backgroundAudioId || ""}
              onChange={(event) => {
                const val = event.target.value;
                if (bgMusicPlayerRef.current) {
                  bgMusicPlayerRef.current.pause();
                  setPlayingBgMusic(false);
                }
                if (!val) {
                  updateProject((current) => ({ ...current, backgroundAudioUrl: null, backgroundAudioId: null }));
                } else if (val.startsWith("http")) {
                  updateProject((current) => ({ ...current, backgroundAudioUrl: val, backgroundAudioId: null }));
                } else {
                  updateProject((current) => ({ ...current, backgroundAudioUrl: null, backgroundAudioId: val }));
                }
              }}
            >
              <option value="">-- No Background Music --</option>
              <optgroup label="Free Non-Commercial Tracks">
                <option value="https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3">Inspiring Tech (Ambient)</option>
                <option value="https://assets.mixkit.co/music/preview/mixkit-corporate-culture-1351.mp3">Vibrant Corporate (Acoustic)</option>
                <option value="https://assets.mixkit.co/music/preview/mixkit-dreaming-big-31.mp3">Dreamy Ambient (Atmospheric)</option>
                <option value="https://assets.mixkit.co/music/preview/mixkit-sun-and-fun-12.mp3">Playful & Light (Upbeat)</option>
              </optgroup>
              {project.assets.filter(a => a.mediaType === "audio" && !a.name.startsWith("voiceover-")).length > 0 && (
                <optgroup label="Uploaded Custom Music">
                  {project.assets.filter(a => a.mediaType === "audio" && !a.name.startsWith("voiceover-")).map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {(project.backgroundAudioUrl || project.backgroundAudioId) && (
            <>
              <div className="field-grid">
                <label className="field">
                  <span>Music Volume ({Math.round((project.backgroundAudioVolume ?? 0.15) * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={project.backgroundAudioVolume ?? 0.15}
                    onChange={(event) => {
                      const val = Number(event.target.value);
                      updateProject((current) => ({ ...current, backgroundAudioVolume: val }));
                      if (bgMusicPlayerRef.current) {
                        bgMusicPlayerRef.current.volume = val;
                      }
                    }}
                  />
                </label>
                <div className="field" style={{ visibility: "hidden" }} />
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>Fade In (sec)</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={project.backgroundAudioFadeIn ?? 1}
                    onChange={(event) => updateProject((current) => ({ ...current, backgroundAudioFadeIn: Number(event.target.value) }))}
                  />
                </label>
                <label className="field">
                  <span>Fade Out (sec)</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={project.backgroundAudioFadeOut ?? 1}
                    onChange={(event) => updateProject((current) => ({ ...current, backgroundAudioFadeOut: Number(event.target.value) }))}
                  />
                </label>
              </div>
            </>
          )}
        </div>
        
        <div style={{ borderTop: "1px solid var(--line)", marginTop: "16px", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={selectedScene.showLogo ?? false} onChange={(event) => updateScene((scene) => ({ ...scene, showLogo: event.target.checked }))} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <strong style={{ fontSize: "12px", color: "var(--text-1)" }}>Show Brand Logo</strong>
                <span style={{ fontSize: "10px", color: "var(--text-3)" }}>Add custom branding to this scene</span>
              </div>
            </label>

            {(selectedScene.showLogo ?? false) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label className="field">
                  <span>Logo Asset</span>
                  <select value={selectedScene.logoAssetId ?? ""} onChange={(event) => updateScene((scene) => ({ ...scene, logoAssetId: event.target.value || null }))}>
                    <option value="">-- No Logo selected --</option>
                    {project.assets.filter(a => a.mediaType === "image" || a.mediaType === "gif").map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                  </select>
                </label>
                <div className="field-grid">
                  <label className="field">
                    <span>Width (px)</span>
                    <input type="number" min={20} max={1000} value={selectedScene.logoWidth ?? 120} onChange={(event) => updateScene((scene) => ({ ...scene, logoWidth: Number(event.target.value) }))} />
                  </label>
                  <label className="field">
                    <span>Height (px)</span>
                    <input type="number" min={20} max={1000} value={selectedScene.logoHeight ?? 120} onChange={(event) => updateScene((scene) => ({ ...scene, logoHeight: Number(event.target.value) }))} />
                  </label>
                </div>
                <label className="field">
                  <span>Border Radius (px)</span>
                  <input type="number" min={0} max={500} value={selectedScene.logoRadius ?? 20} onChange={(event) => updateScene((scene) => ({ ...scene, logoRadius: Number(event.target.value) }))} />
                </label>
              </div>
            )}
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

      {notice ? <div className="toast"><CircleAlert size={17} /><span>{notice}</span><button onClick={() => showNotice(null)}><X size={15} /></button></div> : null}

      {showProjectHistoryModal ? (
        <ProjectHistoryModal
          projects={projectsList}
          activeProjectId={project?.id}
          onClose={() => setShowProjectHistoryModal(false)}
          onRefresh={refreshProjectsList}
          onSelect={(id) => void selectProject(id)}
          onDelete={async (id) => {
            await api.deleteProject(id);
            if (project?.id === id) {
              const remaining = projectsList.filter((p) => p.id !== id);
              if (remaining[0]) await selectProject(remaining[0].id);
              else {
                setProject(null);
                setSelectedSceneId("");
              }
            }
            await refreshProjectsList();
          }}
          onRename={async (id, title) => {
            await api.renameProject(id, title);
            if (project?.id === id) setProject({ ...project, title });
            await refreshProjectsList();
          }}
          onRestore={async (id, versionId) => {
            try {
              const restored = await api.restoreProjectVersion(id, versionId);
              if (project?.id === id) {
                setProject(restored);
                if (restored.scenes && restored.scenes.length > 0) {
                  setSelectedSceneId(restored.scenes[0].id);
                }
              }
              setShowProjectHistoryModal(false);
              showNotice("Project restored to selected revision successfully.");
            } catch {
              showNotice("Failed to restore selected revision.");
            }
          }}
          onExport={async (id, title) => {
            const bridge = (window as any).zero;
            showNotice(`Compiling assets and compressing "${title}"...`);
            try {
              // Step 1: Zip to temp file
              const { tempPath } = await api.exportProjectTemp(id);
              
              // Step 2: Open native Save Dialog now that the archive is ready
              const safeTitle = title.replace(/[\/\\?%*:|"<>\s]/g, "-").trim();
              const targetPath = (await bridge?.invoke("native-sdk.dialog.saveFile", {
                title: `Export ${title}`,
                defaultName: `${safeTitle}.lumiveo`,
              })) as string | null;
              
              if (!targetPath) {
                // User cancelled: cleanup temp file
                await api.cleanupTempFile(tempPath).catch(() => {});
                return;
              }
              
              // Step 3: Copy to final destination and reveal
              await api.finalizeExport(tempPath, targetPath);
              showNotice(`Successfully exported "${title}"!`);
              void api.revealPath(targetPath);
            } catch {
              showNotice(`Failed to export "${title}"`);
            }
          }}
          onCreateNew={() => {
            setShowProjectHistoryModal(false);
            setModal("wizard");
          }}
        />
      ) : null}

      {showTemplateModal ? (
        <TemplatePickerModal
          onClose={() => setShowTemplateModal(false)}
          onSelect={(template) => applyTemplate(template)}
        />
      ) : null}

      {modal === "onboarding" ? <Onboarding settings={settings} onComplete={completeOnboarding} /> : null}
      {modal === "wizard" ? <ProjectWizard onCreateProject={handleWizardResult} onClose={() => setModal(null)} /> : null}
      {modal === "settings" ? <SettingsPage settings={settings} voices={voices} project={project} onBack={() => setModal(null)} onSave={saveSettings} onClear={async () => { setModal(null); setProject(null); setSelectedSceneId(""); await refreshProjectsList(); }} /> : null}
      {modal === "locale" ? <LocaleModal project={project} busy={busy === "translation"} onClose={() => setModal(null)} onGenerate={(code) => void generate("translation", code)} /> : null}
      {modal === "proposal" && proposal ? <ProposalModal proposal={proposal} busy={busy === "apply"} onClose={() => { setProposal(null); setModal(null); }} onApply={() => void applyProposal()} /> : null}
      {modal === "export" ? <ExportModal project={project} job={renderJob} onClose={() => { setModal(null); setRenderJob(null); }} onStart={startRender} onCancel={() => renderJob && void api.cancelRender(renderJob.id).then(setRenderJob)} /> : null}
    </div>
  );

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
    notificationsEnabled: boolean;
  }) {
    const configured = await api.configureAi(next);
    const completed = await api.saveSettings({
      ...configured,
      onboardingComplete: true,
      notificationsEnabled: next.notificationsEnabled,
      analyticsEnabled: next.analyticsEnabled,
      analyticsProvider: next.analyticsEnabled ? "posthog" : "none",
    });
    setSettings(completed);
    setModal(null);
    void api.track("onboarding_completed", { provider: next.provider });
  }

  function notifyOS(title: string, body: string) {
    if (!settings.notificationsEnabled) return;
    void sendNotification(title, body);
  }

  async function saveSettings(draftSettings: AppSettings & { credential?: string; ttsCredential?: string }) {
    const configured = await api.configureAi({ ...draftSettings.ai, credential: draftSettings.credential });
    const withTts = await api.configureTts({ ...draftSettings.tts, credential: draftSettings.ttsCredential });
    const saved = await api.saveSettings({ ...draftSettings, ai: configured.ai, tts: withTts.tts });
    setSettings(saved);
    document.documentElement.lang = saved.uiLocale;
    setModal(null);
    if (saved.tts.provider === "elevenlabs") {
      void refreshVoicesList();
    }
  }

}

declare global {
  interface Window {
    zero?: {
      invoke(command: string, payload: unknown): Promise<unknown>;
    };
  }
}
