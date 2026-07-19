import { Clapperboard, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { APP_NAME_UPPER } from "../lib/constants";

export function LaunchScreen({
  status,
  logs,
  retry,
}: {
  status: "booting" | "ready" | "offline";
  logs: string[];
  retry: () => Promise<void>;
}) {
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setShowConsole((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main className="launch-screen">
      <div className="launch-art">
        <span />
        <span />
        <span />
        <Clapperboard size={38} />
      </div>
      <p>{APP_NAME_UPPER}</p>
      <h1>{status === "offline" ? "The local studio is unavailable" : "Preparing your studio"}</h1>
      <span>
        {status === "offline"
          ? "Start the local worker, then reconnect. (Press Cmd+Option+L to view connection logs)"
          : "Loading projects and render services…"}
      </span>

      {showConsole ? (
        <div
          className="boot-logs-console"
          style={{
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
            lineHeight: "1.5",
          }}
        >
          {logs.map((log, idx) => (
            <div
              key={idx}
              style={{
                color: log.includes("CRITICAL ERROR")
                  ? "#ff6b6b"
                  : log.includes("succeeded") || log.includes("successfully")
                    ? "#9be9a8"
                    : "#d4d4cb",
                marginBottom: "4px",
              }}
            >
              {log}
            </div>
          ))}
          {logs.length === 0 ? <div style={{ color: "#7a7a70" }}>Awaiting initialization steps...</div> : null}
        </div>
      ) : null}

      {status === "offline" ? (
        <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
          <button className="primary-button" type="button" onClick={() => void retry()}>
            <RotateCcw size={15} /> Retry Connection
          </button>
          <button className="quiet-button" type="button" onClick={() => setShowConsole((prev) => !prev)}>
            {showConsole ? "Hide Logs" : "Show Logs"}
          </button>
        </div>
      ) : (
        <div className="loading-line">
          <i />
        </div>
      )}
    </main>
  );
}
