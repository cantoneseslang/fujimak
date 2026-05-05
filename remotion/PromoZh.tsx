import React from 'react';
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { flip } from '@remotion/transitions/flip';
import { Intro3D } from './scenes/Intro3D';
import { BeforeAfter } from './scenes/BeforeAfter';
import { SystemOverview } from './scenes/SystemOverview';
import { SixSteps } from './scenes/SixSteps';
import { AdminUnified } from './scenes/AdminUnified';
import { Benefits } from './scenes/Benefits';
import { Closing } from './scenes/Closing';

const FPS = 30;
const TRANSITION_QUICK = 12;
const TRANSITION_NORMAL = 18;
const TRANSITION_SLOW = 22;

const SCENE_0 = 8 * FPS;
const SCENE_1 = 13 * FPS + 10;
const SCENE_2 = 13 * FPS + 10;
const SCENE_3 = 32 * FPS;
const SCENE_4 = 18 * FPS;
const SCENE_5 = 22 * FPS;
const SCENE_6 = 16 * FPS + 20;

const totalFrames =
  SCENE_0 +
  SCENE_1 +
  SCENE_2 +
  SCENE_3 +
  SCENE_4 +
  SCENE_5 +
  SCENE_6 -
  (TRANSITION_QUICK +
    TRANSITION_NORMAL +
    TRANSITION_QUICK +
    TRANSITION_NORMAL +
    TRANSITION_SLOW +
    TRANSITION_NORMAL);

export type PromoZhProps = Record<string, unknown>;

export const PromoZh: React.FC<PromoZhProps> = () => {
  const timingQuick = springTiming({
    durationInFrames: TRANSITION_QUICK,
    config: { damping: 20, mass: 0.8 },
  });
  const timingNormal = springTiming({
    durationInFrames: TRANSITION_NORMAL,
    config: { damping: 18, mass: 1 },
  });
  const timingSlow = linearTiming({ durationInFrames: TRANSITION_SLOW });

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE_0}>
        <Intro3D />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-right' })}
        timing={timingQuick}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_1}>
        <BeforeAfter />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-bottom' })}
        timing={timingNormal}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_2}>
        <SystemOverview />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={flip({ direction: 'from-left' })}
        timing={timingQuick}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_3}>
        <SixSteps />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-top' })}
        timing={timingNormal}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_4}>
        <AdminUnified />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timingSlow} />
      <TransitionSeries.Sequence durationInFrames={SCENE_5}>
        <Benefits />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={slide({ direction: 'from-bottom' })}
        timing={timingNormal}
      />
      <TransitionSeries.Sequence durationInFrames={SCENE_6}>
        <Closing />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export const PROMO_DURATION_FRAMES = totalFrames;
