import { Gif } from "@remotion/gif";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Asset, Scene, VideoProps } from "../types";
import { presetDimensions } from "./config";


export function AppDemoComposition(props: VideoProps) {
  let start = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#11110f" }}>
      {props.project.scenes.map((scene, index) => {
        const from = start;
        start += scene.durationInFrames;
        const asset = props.project.assets.find((entry) => entry.id === scene.assetId);
        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames}>
            <DemoScene
              scene={scene}
              asset={asset}
              projectId={props.project.id}
              locale={props.locale}
              preset={props.preset}
              assetBaseUrl={props.assetBaseUrl}
              token={props.workerToken}
              isLast={index === props.project.scenes.length - 1}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function DemoScene({
  scene,
  asset,
  projectId,
  locale,
  preset,
  assetBaseUrl,
  token,
  isLast,
}: {
  scene: Scene;
  asset?: Asset;
  projectId: string;
  locale: string;
  preset: VideoProps["preset"];
  assetBaseUrl: string;
  token: string;
  isLast: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const copy = scene.copy[locale] ?? scene.copy[Object.keys(scene.copy)[0]];
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
  const exit = isLast
    ? 1
    : interpolate(frame, [scene.durationInFrames - 12, scene.durationInFrames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const direction = /^(ar|fa|he|ur)(-|$)/i.test(locale) ? "rtl" : "ltr";
  const isLandscape = preset === "landscape";
  const mediaUrl = asset
    ? `${assetBaseUrl.replace(/\/$/, "")}/${asset.id}?token=${encodeURIComponent(token)}`
    : null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.background,
        color: "#f7f7f2",
        opacity: exit,
        overflow: "hidden",
        fontFamily:
          'Inter, "SF Pro Display", "Noto Sans Arabic", "Noto Sans CJK SC", system-ui, sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "80%",
          aspectRatio: "1",
          borderRadius: "50%",
          background: scene.accent,
          filter: "blur(140px)",
          opacity: 0.14,
          left: isLandscape ? "48%" : "10%",
          top: "8%",
          transform: `scale(${0.8 + entrance * 0.2})`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: isLandscape ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: isLandscape ? 100 : 72,
          height: "100%",
          padding: isLandscape ? "80px 120px" : "120px 84px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: isLandscape ? "48%" : "100%",
            maxWidth: isLandscape ? 820 : 880,
            transform: `translateY(${(1 - entrance) * 80}px) scale(${0.94 + entrance * 0.06})`,
          }}
        >
          <MediaFrame asset={asset} src={mediaUrl} scene={scene} projectId={projectId} />
        </div>

        <div
          dir={direction}
          style={{
            width: isLandscape ? "42%" : "100%",
            textAlign: direction === "rtl" ? "right" : isLandscape ? "left" : "center",
            opacity: interpolate(entrance, [0, 1], [0, 1]),
            transform: `translateY(${(1 - entrance) * 44}px)`,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 28,
              color: scene.accent,
              fontSize: isLandscape ? 24 : 28,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ width: 34, height: 4, borderRadius: 99, background: scene.accent }} />
            {scene.name}
          </div>
          <div
            style={{
              fontSize: captionSize(copy?.caption ?? "", preset),
              fontWeight: 720,
              lineHeight: 1.04,
              letterSpacing: "-0.045em",
              textWrap: "balance",
            }}
          >
            {copy?.caption ?? scene.name}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function MediaFrame({
  asset,
  src,
  scene,
}: {
  asset?: Asset;
  src: string | null;
  scene: Scene;
  projectId: string;
}) {
  const frameStyle: React.CSSProperties = {
    position: "relative",
    aspectRatio: scene.layout === "full" ? "16 / 10" : "9 / 16",
    maxHeight: 1120,
    margin: "0 auto",
    borderRadius: scene.layout === "full" ? 38 : 64,
    background: "#23231f",
    border: scene.layout === "full" ? "1px solid rgba(255,255,255,.16)" : "14px solid #0a0a09",
    boxShadow: "0 48px 120px rgba(0,0,0,.48), inset 0 0 0 1px rgba(255,255,255,.08)",
    overflow: "hidden",
  };

  return (
    <div style={frameStyle}>
      {!asset || !src ? (
        <Placeholder accent={scene.accent} />
      ) : asset.mediaType === "video" ? (
        <OffthreadVideo src={src} muted style={mediaStyle} />
      ) : asset.mediaType === "gif" ? (
        <Gif src={src} fit="cover" style={mediaStyle} />
      ) : asset.mediaType === "audio" ? (
        <>
          <Audio src={src} />
          <AudioPlaceholder accent={scene.accent} />
        </>
      ) : (
        <Img src={src} style={mediaStyle} />
      )}
      {scene.layout !== "full" ? (
        <div
          style={{
            position: "absolute",
            width: "28%",
            height: 34,
            borderRadius: 22,
            background: "#0a0a09",
            top: 0,
            left: "36%",
          }}
        />
      ) : null}
    </div>
  );
}

const mediaStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

function Placeholder({ accent }: { accent: string }) {
  return (
    <AbsoluteFill style={{ padding: 48, background: "linear-gradient(155deg,#292924,#171715)" }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 42 }}>
        {[0, 1, 2].map((item) => (
          <div key={item} style={{ width: 14, height: 14, borderRadius: "50%", background: item === 0 ? accent : "#55554e" }} />
        ))}
      </div>
      <div style={{ height: 18, width: "42%", background: accent, borderRadius: 99, opacity: 0.9 }} />
      <div style={{ height: 90, marginTop: 28, background: "#34342f", borderRadius: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 22, flex: 1 }}>
        <div style={{ background: "#22221f", borderRadius: 24 }} />
        <div style={{ background: "#30302b", borderRadius: 24 }} />
        <div style={{ background: "#30302b", borderRadius: 24 }} />
        <div style={{ background: accent, borderRadius: 24, opacity: 0.18 }} />
      </div>
    </AbsoluteFill>
  );
}

function AudioPlaceholder({ accent }: { accent: string }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", background: "#1d1d1a" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {Array.from({ length: 17 }, (_, index) => {
          const height = 40 + Math.abs(Math.sin(frame / 8 + index * 0.65)) * 130;
          return <div key={index} style={{ width: 12, height, borderRadius: 99, background: accent }} />;
        })}
      </div>
    </AbsoluteFill>
  );
}

function captionSize(text: string, preset: VideoProps["preset"]) {
  const base = preset === "landscape" ? 86 : 92;
  if (text.length > 110) return base * 0.58;
  if (text.length > 70) return base * 0.72;
  if (text.length > 42) return base * 0.86;
  return base;
}
