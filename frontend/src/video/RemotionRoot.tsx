import { Composition, type CalculateMetadataFunction } from "remotion";
import type { VideoProps } from "../types";
import { AppDemoComposition } from "./AppDemoComposition";
import { durationFor, presetDimensions } from "./config";
import { APP_NAME } from "../lib/constants";

const defaultProps: VideoProps = {
  project: {
    schemaVersion: 1,
    id: "00000000-0000-4000-8000-000000000000",
    title: `${APP_NAME} project`,
    productName: APP_NAME,
    productDescription: "",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    fps: 30,
    sourceLocale: "en",
    activeLocale: "en",
    locales: [{ code: "en", label: "English", direction: "ltr" }],
    assets: [],
    scenes: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Opening",
        assetId: null,
        durationInFrames: 90,
        transition: "fade",
        layout: "device",
        background: "#171714",
        accent: "#e6ff5c",
        copy: {
          en: {
            caption: "Make your product impossible to miss.",
            narration: "Turn your app into a polished story.",
            manuallyEdited: false,
            stale: false,
          },
        },
      },
    ],
    generationHistory: [],
  },
  locale: "en",
  preset: "portrait",
  assetBaseUrl: "",
  workerToken: "",
};

const calculateMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => {
  const dimensions = presetDimensions[props.preset];
  return {
    ...dimensions,
    fps: props.project.fps,
    durationInFrames: durationFor(props.project),
    props,
  };
};

export function RemotionRoot() {
  return (
    <Composition
      id="AppDemo"
      component={AppDemoComposition}
      defaultProps={defaultProps}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={90}
      calculateMetadata={calculateMetadata}
    />
  );
}
