import React from "react";
import { CalculateMetadataFunction, Composition, Sequence } from "remotion";
import { Scene, SceneProps } from "./scene";

const FPS = 30;
const sceneMeta: CalculateMetadataFunction<SceneProps> = ({ props }) => ({ durationInFrames: Math.round(props.seconds * FPS) });

type ReelProps = { scenes: SceneProps[] };
const reelMeta: CalculateMetadataFunction<ReelProps> = ({ props }) => ({
  durationInFrames: Math.max(1, props.scenes.reduce((s, x) => s + Math.round(x.seconds * FPS), 0)),
});

const Reel: React.FC<ReelProps> = ({ scenes }) => {
  let from = 0;
  return (
    <>
      {scenes.map((s, i) => {
        const d = Math.round(s.seconds * FPS);
        const el = (
          <Sequence key={i} from={from} durationInFrames={d}>
            <Scene {...s} />
          </Sequence>
        );
        from += d;
        return el;
      })}
    </>
  );
};

const demo: SceneProps = { type: "cta", seconds: 3 };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Scene" component={Scene} durationInFrames={90} fps={FPS} width={1080} height={1920} defaultProps={demo} calculateMetadata={sceneMeta} />
    <Composition id="Reel" component={Reel} durationInFrames={90} fps={FPS} width={1080} height={1920} defaultProps={{ scenes: [demo] }} calculateMetadata={reelMeta} />
  </>
);
