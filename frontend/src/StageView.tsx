import { Player } from "@remotion/player";
import { Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { workerToken, workerUrl } from "./api";
import type { ExportPreset, Project } from "./types";
import { AppDemoComposition } from "./video/AppDemoComposition";
import { durationFor, presetDimensions } from "./video/config";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.25;

/**
 * Measured preview canvas: a ResizeObserver derives the exact fit scale for
 * the container, so the composition can never overflow. Zoom multiplies the
 * fit scale; beyond 100% the stage scrolls for panning.
 */
export function StageView({
  project,
  locale,
  preset,
}: {
  project: Project;
  locale: string;
  preset: ExportPreset;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentBoxSize?.[0];
      setViewport({
        width: box ? box.inlineSize : entry.contentRect.width,
        height: box ? box.blockSize : entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setZoom(1), [preset, project.id]);

  const composition = presetDimensions[preset];
  const fit =
    viewport.width > 0 && viewport.height > 0
      ? Math.min(viewport.width / composition.width, viewport.height / composition.height)
      : 0;
  const scale = fit * zoom;
  const frameWidth = Math.max(1, Math.round(composition.width * scale));
  const frameHeight = Math.max(1, Math.round(composition.height * scale));

  const zoomOut = () => setZoom((value) => Math.max(MIN_ZOOM, value / ZOOM_STEP));
  const zoomIn = () => setZoom((value) => Math.min(MAX_ZOOM, value * ZOOM_STEP));

  return (
    <div className="canvas-stage">
      <div className="canvas-scroll" ref={scrollRef}>
        {fit > 0 ? (
          <div className="canvas-frame" style={{ width: frameWidth, height: frameHeight }}>
            <Player
              component={AppDemoComposition}
              inputProps={{
                project,
                locale,
                preset,
                assetBaseUrl: `${workerUrl}/v1/projects/${project.id}/assets`,
                workerToken,
              }}
              durationInFrames={durationFor(project)}
              compositionWidth={composition.width}
              compositionHeight={composition.height}
              fps={project.fps}
              controls
              acknowledgeRemotionLicense
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : null}
      </div>
      <div className="zoom-controls" role="group" aria-label="Preview zoom">
        <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM} title="Zoom out">
          <Minus size={14} />
        </button>
        <button
          className="zoom-value"
          onClick={() => setZoom(1)}
          title="Reset to fit"
          aria-live="polite"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM} title="Zoom in">
          <Plus size={14} />
        </button>
        <span className="zoom-divider" />
        <button onClick={() => setZoom(1)} disabled={zoom === 1} title="Fit to stage">
          <Maximize size={13} />
        </button>
      </div>
    </div>
  );
}
