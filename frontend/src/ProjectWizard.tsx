import { useState } from "react";
import {
  Check,
  CircleAlert,
  LayoutTemplate,
  LoaderCircle,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { api } from "./api";
import { projectTemplates, type ProjectTemplate } from "./video/templates";
import type { Scene } from "./types";
import { APP_NAME, APP_NAME_UPPER } from "./lib/constants";

type Step = "pick-method" | "template-pick" | "describe" | "generating" | "review";

interface SceneDraft {
  name: string;
  caption: string;
  narration: string;
  layout: Scene["layout"];
  transition: Scene["transition"];
  durationInFrames: number;
  background: string;
  accent: string;
}

export function ProjectWizard({
  onCreateProject,
  onClose,
}: {
  onCreateProject: (title: string, scenes: Scene[], productName?: string, productDescription?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("pick-method");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [scenes, setScenes] = useState<SceneDraft[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const fps = 30;

  const useTemplate = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
    setScenes(template.scenes.map((s) => ({
      name: s.name,
      caption: s.caption,
      narration: s.narration,
      layout: s.layout,
      transition: s.transition,
      durationInFrames: s.durationInFrames,
      background: s.background,
      accent: s.accent,
    })));
    setStep("review");
  };

  const startAiGeneration = async () => {
    setStep("generating");
    setBusy(true);
    try {
      const project = await api.createProject("Untitled project");
      await api.saveProject({ ...project, productName, productDescription });
      const result = await api.generate({ projectId: project.id, operation: "storyboard" });
      setScenes(result.scenes.map((s) => ({
        name: s.name,
        caption: s.caption,
        narration: s.narration,
        layout: s.layout,
        transition: s.transition,
        durationInFrames: Math.round(s.durationSeconds * fps),
        background: "#171714",
        accent: "#e6ff5c",
      })));
      setStep("review");
    } catch {
      setNotice("AI generation failed. Check your AI provider settings and try again.");
      setStep("describe");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!scenes) return;
    setBusy(true);
    try {
      const locale = "en";
      const projectScenes: Scene[] = scenes.map((s) => ({
        id: crypto.randomUUID(),
        name: s.name,
        assetId: null,
        durationInFrames: s.durationInFrames,
        transition: s.transition,
        layout: s.layout,
        background: s.background,
        accent: s.accent,
        copy: {
          [locale]: {
            caption: s.caption,
            narration: s.narration,
            manuallyEdited: false,
            stale: false,
          },
        },
      }));
      const title = selectedTemplate?.name || productName || "Untitled demo";
      await onCreateProject(title, projectScenes, productName, productDescription);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal wizard-modal">
        <div className="modal-header">
          <div>
            <span className="kicker">{APP_NAME_UPPER}</span>
            <h2>New Project</h2>
          </div>
          {step !== "generating" ? (
            <button className="icon-button" onClick={onClose}>
              <X size={18} />
            </button>
          ) : null}
        </div>

        {notice ? (
          <div className="wizard-notice" onClick={() => setNotice("")}><CircleAlert size={15} /> {notice}</div>
        ) : null}

        {step === "pick-method" ? (
          <PickMethodStep
            onPickTemplate={() => setStep("template-pick")}
            onPickAi={() => setStep("describe")}
          />
        ) : null}

        {step === "template-pick" ? (
          <TemplatePickStep
            onSelectTemplate={useTemplate}
            onBack={() => setStep("pick-method")}
          />
        ) : null}

        {step === "describe" ? (
          <DescribeStep
            productName={productName}
            productDescription={productDescription}
            onChangeName={setProductName}
            onChangeDescription={setProductDescription}
            onBack={() => setStep("pick-method")}
            onGenerate={startAiGeneration}
          />
        ) : null}

        {step === "generating" ? (
          <div className="wizard-generating">
            <LoaderCircle className="spin" size={32} />
            <p>AI is crafting your storyboard...</p>
          </div>
        ) : null}

        {step === "review" && scenes ? (
          <ReviewStep
            scenes={scenes}
            templateName={selectedTemplate?.name}
            onBack={() => setStep(selectedTemplate ? "template-pick" : "describe")}
            onAccept={finish}
            busy={busy}
          />
        ) : null}
      </div>
    </div>
  );
}

function PickMethodStep({
  onPickTemplate,
  onPickAi,
}: {
  onPickTemplate: () => void;
  onPickAi: () => void;
}) {
  return (
    <div className="wizard-content">
      <p className="wizard-subtitle">Choose how to start your project.</p>
      <div className="method-grid">
        <button className="method-card" onClick={onPickTemplate}>
          <div className="method-icon"><LayoutTemplate size={28} /></div>
          <strong>Start with a Template</strong>
          <small>Pick from a curated set of scene layouts and styles.</small>
        </button>
        <button className="method-card method-card-ai" onClick={onPickAi}>
          <div className="method-icon"><WandSparkles size={28} /></div>
          <strong>AI Storyboard</strong>
          <small>Describe your app and AI generates scenes, captions, and narration.</small>
        </button>
      </div>
    </div>
  );
}

function TemplatePickStep({
  onSelectTemplate,
  onBack,
}: {
  onSelectTemplate: (t: ProjectTemplate) => void;
  onBack: () => void;
}) {
  return (
    <div className="wizard-content">
      <p className="wizard-subtitle">Select a template to start from.</p>
      <div className="template-grid">
        {projectTemplates.map((t) => (
          <button
            key={t.id}
            className="template-card"
            onClick={() => onSelectTemplate(t)}
          >
            <div className="template-swatch" style={{ background: t.background }}>
              <span style={{ color: t.accent }}>
                <Sparkles size={20} />
              </span>
            </div>
            <strong>{t.name}</strong>
            <small>{t.description}</small>
          </button>
        ))}
      </div>
      <div className="modal-actions" style={{ marginTop: "16px" }}>
        <button className="quiet-button" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

function DescribeStep({
  productName, productDescription, onChangeName, onChangeDescription,
  onBack, onGenerate,
}: {
  productName: string; productDescription: string;
  onChangeName: (v: string) => void; onChangeDescription: (v: string) => void;
  onBack: () => void; onGenerate: () => void;
}) {
  const valid = productName.trim().length > 0 && productDescription.trim().length > 0;
  return (
    <div className="wizard-content">
      <p className="wizard-subtitle">
        Tell us about your app so AI can create a compelling storyboard.
      </p>
      <label className="field">
        <span>App / Product name</span>
        <input value={productName} onChange={(e) => onChangeName(e.target.value)} placeholder={`e.g. ${APP_NAME}, MyApp, FitnessTracker`} />
      </label>
      <label className="field">
        <span>Describe your app</span>
        <textarea rows={5} value={productDescription} onChange={(e) => onChangeDescription(e.target.value)} placeholder="What does your app do? Who is it for? What are the key features? What problem does it solve?" />
      </label>
      <div className="modal-actions">
        <button className="quiet-button" onClick={onBack}>Back</button>
        <button className="primary-button" disabled={!valid} onClick={onGenerate}>
          <WandSparkles size={15} /> Generate storyboard
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  scenes, templateName, onBack, onAccept, busy,
}: {
  scenes: SceneDraft[];
  templateName?: string;
  onBack: () => void;
  onAccept: () => void;
  busy: boolean;
}) {
  return (
    <div className="wizard-content">
      <p className="wizard-subtitle">
        {templateName ? `"${templateName}" template` : "AI-generated storyboard"} &middot; {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
      </p>
      <div className="wizard-scenes">
        {scenes.map((scene, i) => (
          <div key={i} className="wizard-scene-card">
            <div className="wizard-scene-num">{i + 1}</div>
            <div className="wizard-scene-body">
              <strong>{scene.name}</strong>
              <span className="wizard-scene-caption">{scene.caption}</span>
              <span className="wizard-scene-narration">{scene.narration}</span>
              <span className="wizard-scene-meta">{scene.layout} &middot; {scene.transition}</span>
            </div>
            <div className="wizard-scene-swatch" style={{ background: scene.background }}>
              <span style={{ color: scene.accent }}><Sparkles size={14} /></span>
            </div>
          </div>
        ))}
      </div>
      <div className="modal-actions">
        <button className="quiet-button" onClick={onBack}>Back</button>
        <button className="primary-button" disabled={busy} onClick={onAccept}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
          Accept & enter studio
        </button>
      </div>
    </div>
  );
}
