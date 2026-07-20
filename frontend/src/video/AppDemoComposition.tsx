import { Gif } from "@remotion/gif";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { flip } from "@remotion/transitions/flip";
import type { Asset, Scene, VideoProps } from "../types";
import { durationFor, presetDimensions } from "./config";

const TRANSITION_FRAMES = 12;

function presentationFor(transition: string) {
  if (transition === "slide") return slide({ direction: "from-left" });
  if (transition === "scale") return flip();
  return fade();
}

export function AppDemoComposition(props: VideoProps) {
  const totalDuration = durationFor(props.project);

  const bgAudioUrl = props.project.backgroundAudioId
    ? `${props.assetBaseUrl.replace(/\/$/, "")}/${props.project.backgroundAudioId}?token=${encodeURIComponent(props.workerToken || "")}`
    : props.project.backgroundAudioUrl
      ? `${props.assetBaseUrl.split("/v1/")[0]}/v1/system/proxy?url=${encodeURIComponent(props.project.backgroundAudioUrl)}&token=${encodeURIComponent(props.workerToken || "")}`
      : null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#11110f" }}>
      {bgAudioUrl && (
        <BackgroundAudioTrack
          src={bgAudioUrl}
          volume={props.project.backgroundAudioVolume ?? 0.15}
          fadeInSeconds={props.project.backgroundAudioFadeIn ?? 1}
          fadeOutSeconds={props.project.backgroundAudioFadeOut ?? 1}
          fps={props.project.fps}
          totalDurationInFrames={totalDuration}
        />
      )}
      <TransitionSeries>
        {props.project.scenes.flatMap((scene, index) => {
          const asset = props.project.assets.find((entry) => entry.id === scene.assetId);

          const sceneAudioAssets = props.project.assets.filter((a: Asset) => a.mediaType === "audio" && (a.name === `voiceover-${scene.id}.mp3` || a.name.includes(scene.id)));
          const activeAudio = sceneAudioAssets[sceneAudioAssets.length - 1];
          const audioUrl = activeAudio
            ? `${props.assetBaseUrl.replace(/\/$/, "")}/${activeAudio.id}?token=${encodeURIComponent(props.workerToken)}`
            : null;

          const elements: React.ReactNode[] = [
            <TransitionSeries.Sequence
              key={scene.id}
              durationInFrames={scene.durationInFrames}
              name={scene.name}
            >
              <DemoScene
                scene={scene}
                asset={asset}
                backgroundAudioUrl={audioUrl}
                projectId={props.project.id}
                locale={props.locale}
                preset={props.preset}
                assetBaseUrl={props.assetBaseUrl}
                token={props.workerToken}
              />
            </TransitionSeries.Sequence>,
          ];

          if (index < props.project.scenes.length - 1 && scene.transition !== "none") {
            elements.push(
              <TransitionSeries.Transition
                key={`t-${scene.id}`}
                presentation={presentationFor(scene.transition)}
                timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
              />,
            );
          }

          return elements;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
}

function DemoScene({
  scene,
  asset,
  backgroundAudioUrl,
  projectId,
  locale,
  preset,
  assetBaseUrl,
  token,
}: {
  scene: Scene;
  asset?: Asset;
  backgroundAudioUrl: string | null;
  projectId: string;
  locale: string;
  preset: VideoProps["preset"];
  assetBaseUrl: string;
  token: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const copy = scene.copy[locale] ?? scene.copy[Object.keys(scene.copy)[0]];
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
  const direction = /^(ar|fa|he|ur)(-|$)/i.test(locale) ? "rtl" : "ltr";
  const isLandscape = preset === "landscape";
  const mediaUrl = asset
    ? `${assetBaseUrl.replace(/\/$/, "")}/${asset.id}?token=${encodeURIComponent(token)}`
    : null;

  const logoUrl = scene.logoAssetId
    ? `${assetBaseUrl.replace(/\/$/, "")}/${scene.logoAssetId}?token=${encodeURIComponent(token)}`
    : null;

  const textT = scene.textTransition ?? "fade";
  const textDur = Math.min(scene.textTransitionDuration ?? 24, scene.durationInFrames - 5);
  const textDir = scene.textTransitionDirection ?? "from-bottom";
  const textContainerOpacity = 1;
  const textContainerY = 0;

  const voiceoverVolume = interpolate(
    frame,
    [0, TRANSITION_FRAMES, scene.durationInFrames - TRANSITION_FRAMES, scene.durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const fullText = copy?.caption ?? scene.name;
  const lines = fullText.split("\n");
  const lastLine = lines[lines.length - 1] ?? "";
  const charsToShow = textT === "typewriter"
    ? Math.floor(interpolate(frame, [0, textDur], [0, lastLine.length], { extrapolateRight: "clamp" }))
    : lastLine.length;
  const renderedCaption = textT === "typewriter"
    ? [...lines.slice(0, -1), lastLine.slice(0, charsToShow)].join("\n")
    : fullText;

  const progress = interpolate(frame, [0, textDur], [0, 1], { extrapolateRight: "clamp" });
  const dist = 60;

  let tx = 0;
  let ty = 0;
  if (textT === "slide") {
    switch (textDir) {
      case "from-left": tx = dist * (1 - progress); break;
      case "from-right": tx = -dist * (1 - progress); break;
      case "from-top": ty = -dist * (1 - progress); break;
      default: ty = dist * (1 - progress);
    }
  }

  const bounceScale = textT === "bounce"
    ? spring({ frame, fps, config: { damping: 11, stiffness: 130, mass: 0.5 } })
    : 1;
  const breatheScale = textT === "breathe"
    ? 1 + Math.sin(frame * Math.PI * 2 / (fps * 2)) * 0.03
    : 1;
  const finalScale = textT === "bounce" ? bounceScale : textT === "breathe" ? breatheScale : 1;

  const textOpacity = textT === "fade" ? progress : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.background,
        color: scene.textColor ?? "#f7f7f2",
        overflow: "hidden",
        fontFamily: scene.fontFamily
          ? `"${scene.fontFamily}", Inter, "SF Pro Display", system-ui, sans-serif`
          : 'Inter, "SF Pro Display", "Noto Sans Arabic", "Noto Sans CJK SC", system-ui, sans-serif',
      }}
    >
      {backgroundAudioUrl && (
        <Audio src={backgroundAudioUrl} volume={voiceoverVolume} />
      )}

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
            opacity: textContainerOpacity,
            transform: `translateY(${textContainerY}px)`,
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
            {scene.showLogo && logoUrl ? (
              <Img
                src={logoUrl}
                style={{
                  width: scene.logoWidth ?? 120,
                  height: scene.logoHeight ?? 120,
                  borderRadius: scene.logoRadius ?? 20,
                  objectFit: "cover",
                }}
              />
            ) : (
              <span style={{ width: 34, height: 4, borderRadius: 99, background: scene.accent }} />
            )}
            {scene.name}
          </div>
          <div
            style={{
              fontSize: scene.fontSize ? `${scene.fontSize}px` : captionSize(copy?.caption ?? "", preset),
              fontWeight: scene.fontWeight ?? 720,
              fontStyle: scene.fontStyle ?? "normal",
              color: scene.textColor ?? "#f7f7f2",
              fontFamily: scene.fontFamily ? `"${scene.fontFamily}"` : undefined,
              lineHeight: 1.04,
              letterSpacing: "-0.045em",
              textWrap: "balance",
              transform: `translate(${tx}px, ${ty}px) scale(${finalScale})`,
              opacity: textOpacity,
              display: "inline-block",
            }}
          >
            {renderedCaption}
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
  const isMinimal = scene.layout === "minimal";
  const isGradient = scene.layout === "gradient";
  const isHighlight = scene.layout === "highlight";
  const isSpecial = isMinimal || isGradient || isHighlight;

  const frameStyle: React.CSSProperties = {
    position: "relative",
    aspectRatio: (scene.layout === "full" || isGradient) 
      ? "16 / 10" 
      : (devicePresets[scene.devicePreset ?? "iphone-6.7"]?.ratio ?? "1290 / 2796"),
    maxHeight: 1120,
    margin: "0 auto",
    borderRadius: (scene.layout === "full" || isSpecial) ? 38 : 64,
    background: isGradient ? `linear-gradient(135deg, ${scene.accent}22, ${scene.accent}66)` : isMinimal ? "transparent" : "#23231f",
    border: (scene.layout === "full" || isSpecial) 
      ? isMinimal ? "2px dashed rgba(255,255,255,.2)" : isHighlight ? `4px solid ${scene.accent}` : "1px solid rgba(255,255,255,.16)" 
      : "14px solid #0a0a09",
    boxShadow: isMinimal ? "none" : "0 48px 120px rgba(0,0,0,.48), inset 0 0 0 1px rgba(255,255,255,.08)",
    overflow: "hidden",
  };

  const computedMediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: scene.mediaFit ?? "cover",
    objectPosition: `${scene.mediaX ?? 50}% ${scene.mediaY ?? 50}%`,
  };

  return (
    <div style={frameStyle}>
      {!asset || !src ? (
        <Placeholder accent={scene.accent} />
      ) : asset.mediaType === "video" ? (
        <OffthreadVideo src={src} muted style={computedMediaStyle} />
      ) : asset.mediaType === "gif" ? (
        <Gif src={src} fit={scene.mediaFit === "none" ? "cover" : (scene.mediaFit ?? "cover")} style={computedMediaStyle} />
      ) : asset.mediaType === "audio" ? (
        <>
          <Audio src={src} />
          <AudioPlaceholder accent={scene.accent} />
        </>
      ) : (
        <Img src={src} style={computedMediaStyle} />
      )}
      {(scene.layout !== "full" && !isSpecial) ? (
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

export const devicePresets: Record<string, { label: string; ratio: string }> = {
  "iphone-6.9": { label: 'iPhone 6.9" (16 Pro Max)', ratio: "1320 / 2868" },
  "iphone-6.7": { label: 'iPhone 6.7" (15 Plus, 14 Pro Max)', ratio: "1290 / 2796" },
  "iphone-6.1": { label: 'iPhone 6.1" (16, 15 Pro, 14)', ratio: "1179 / 2556" },
  "ipad-13": { label: 'iPad Pro 13"', ratio: "2064 / 2752" },
  "ipad-12.9": { label: 'iPad Pro 12.9"', ratio: "2048 / 2732" },
  "ipad-11": { label: 'iPad Pro/Air 11"', ratio: "1668 / 2388" },
  "google-phone": { label: "Google Play Phone", ratio: "1080 / 1920" },
  "google-tablet": { label: "Google Play 10\" Tablet", ratio: "1200 / 1920" },
};

function BackgroundAudioTrack({
  src,
  volume,
  fadeInSeconds,
  fadeOutSeconds,
  fps,
  totalDurationInFrames,
}: {
  src: string;
  volume: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  fps: number;
  totalDurationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const fadeInFrames = Math.max(0, Math.round(fadeInSeconds * fps));
  const fadeOutFrames = Math.max(0, Math.round(fadeOutSeconds * fps));

  let currentVolume = volume;
  if (frame < fadeInFrames && fadeInFrames > 0) {
    currentVolume = interpolate(frame, [0, fadeInFrames], [0, volume], {
      extrapolateRight: "clamp",
    });
  } else if (frame > totalDurationInFrames - fadeOutFrames && fadeOutFrames > 0) {
    currentVolume = interpolate(
      frame,
      [totalDurationInFrames - fadeOutFrames, totalDurationInFrames],
      [volume, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
  }

  return <Audio src={src} volume={currentVolume} />;
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
