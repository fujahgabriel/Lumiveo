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
import { durationFor, presetDimensions } from "./config";


export function AppDemoComposition(props: VideoProps) {
  let start = 0;
  const totalDuration = durationFor(props.project);
  
  const bgAudioUrl = props.project.backgroundAudioId
    ? `${props.assetBaseUrl.replace(/\/$/, "")}/${props.project.backgroundAudioId}?token=${encodeURIComponent(props.workerToken || "")}`
    : props.project.backgroundAudioUrl || null;

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
      {props.project.scenes.map((scene, index) => {
        const from = start;
        start += scene.durationInFrames;
        const asset = props.project.assets.find((entry) => entry.id === scene.assetId);
        
        // Find if this scene has any audio assets associated with it to play as voiceover/soundtrack
        const sceneAudioAssets = props.project.assets.filter((a: Asset) => a.mediaType === "audio" && (a.name === `voiceover-${scene.id}.mp3` || a.name.includes(scene.id)));
        const activeAudio = sceneAudioAssets[sceneAudioAssets.length - 1]; // Use the most recently generated voiceover for this scene
        const audioUrl = activeAudio
          ? `${props.assetBaseUrl.replace(/\/$/, "")}/${activeAudio.id}?token=${encodeURIComponent(props.workerToken)}`
          : null;

        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames}>
            {audioUrl && <Audio src={audioUrl} />}
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

  const logoUrl = scene.logoAssetId
    ? `${assetBaseUrl.replace(/\/$/, "")}/${scene.logoAssetId}?token=${encodeURIComponent(token)}`
    : null;

  // Canva-style text transitions/animations
  const charsToShow = Math.floor(
    interpolate(frame, [0, Math.min(30, scene.durationInFrames)], [0, (copy?.caption ?? scene.name).length], {
      extrapolateRight: "clamp",
    })
  );
  const renderedCaption = scene.textTransition === "typewriter"
    ? (copy?.caption ?? scene.name).slice(0, charsToShow)
    : (copy?.caption ?? scene.name);

  const bounceScale = spring({ frame, fps, config: { damping: 11, stiffness: 130, mass: 0.5 } });
  const baseScale = scene.textTransition === "bounce" ? bounceScale : 1;
  const breatheScale = 1 + Math.sin(frame / 40) * 0.02;
  const finalScale = scene.textTransition === "breathe" ? breatheScale : baseScale;

  const slideY = scene.textTransition === "slide" ? interpolate(entrance, [0, 1], [40, 0]) : 0;
  const fadeOpacity = scene.textTransition === "fade" ? interpolate(entrance, [0, 1], [0, 1]) : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.background,
        color: scene.textColor ?? "#f7f7f2",
        opacity: exit,
        overflow: "hidden",
        fontFamily: scene.fontFamily
          ? `"${scene.fontFamily}", Inter, "SF Pro Display", system-ui, sans-serif`
          : 'Inter, "SF Pro Display", "Noto Sans Arabic", "Noto Sans CJK SC", system-ui, sans-serif',
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
              transform: `scale(${finalScale}) translateY(${slideY}px)`,
              opacity: fadeOpacity,
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
