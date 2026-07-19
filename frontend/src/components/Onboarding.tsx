import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";
import { t } from "../i18n";
import { KeyLink, ModelPicker } from "../ModelPicker";
import { providerMeta, providerOrder } from "../providers";
import type { AppSettings } from "../types";
import { Switch } from "../Switch";

export function Onboarding({
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
    notificationsEnabled: boolean;
  }) => Promise<void>;
}) {
  const [provider, setProvider] = useState(settings.ai.provider);
  const [credential, setCredential] = useState("");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled);
  const [busy, setBusy] = useState(false);
  const meta = providerMeta[provider];
  const local = provider === "local";

  return (
    <div className="modal-backdrop onboarding-backdrop">
      <div className="modal onboarding-card">
        <div className="onboarding-visual">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span>
            <Sparkles size={32} />
          </span>
        </div>
        <div className="onboarding-copy">
          <span className="kicker">WELCOME TO THE STUDIO</span>
          <h1>{t(settings.uiLocale, "onboardingTitle")}</h1>
          <p>{t(settings.uiLocale, "onboardingBody")}</p>
          <div className="provider-grid">
            {providerOrder.map((item) => (
              <button key={item} type="button" className={provider === item ? "active" : ""} onClick={() => setProvider(item)}>
                <span>{item === "local" ? "⌁" : providerMeta[item].label[0]}</span>
                <strong>{providerMeta[item].label}</strong>
                <small>{providerMeta[item].tagline}</small>
              </button>
            ))}
          </div>
          {!local ? (
            <div className="onboarding-fields">
              <ModelPicker provider={provider} value={model} onChange={setModel} endpoint={endpoint} credential={credential} />
              {meta.needsEndpoint ? (
                <label className="field">
                  <span>Endpoint</span>
                  <input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder={meta.endpointPlaceholder} />
                </label>
              ) : null}
              {meta.needsKey ? (
                <>
                  <label className="field">
                    <span>API key {meta.keyOptional ? "(optional)" : ""}</span>
                    <input type="password" value={credential} onChange={(event) => setCredential(event.target.value)} placeholder="Stored in macOS Keychain" />
                  </label>
                  {meta.keyUrl ? <KeyLink url={meta.keyUrl} label={meta.keyLabel} /> : null}
                </>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
            <Switch checked={analyticsEnabled} onToggle={() => setAnalyticsEnabled(!analyticsEnabled)}>
              {t(settings.uiLocale, "analyticsLabel")}
            </Switch>
            <Switch checked={notificationsEnabled} onToggle={() => setNotificationsEnabled(!notificationsEnabled)}>
              Enable macOS notifications
            </Switch>
          </div>
          <button
            className="primary-button onboarding-continue"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onComplete({
                provider,
                model,
                endpoint,
                credential,
                analyticsEnabled,
                notificationsEnabled,
              }).finally(() => setBusy(false));
            }}
          >
            {busy ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} {t(settings.uiLocale, "continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
