import React from 'react';
import { TransitionSeries, springTiming, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { flip } from '@remotion/transitions/flip';

import { Intro3D as IntroBoot } from './scenes/Intro3D';
import { InteractionDemoV2 } from './scenes/InteractionDemoV2';
import { ProblemV2 } from './scenes/ProblemV2';
import { FlowV2 } from './scenes/FlowV2';
import { CollaborationV2 } from './scenes/CollaborationV2';
import { AdminV2 } from './scenes/AdminV2';
import { BenefitsV2 } from './scenes/BenefitsV2';
import { ClosingV2 } from './scenes/ClosingV2';

const FPS = 30;

// Transition durations (overlap is subtracted from total)
const T_QUICK = 12;
const T_NORMAL = 18;
const T_SLOW = 22;

// 120s target: 3600 frames total (after subtracting transition overlaps)
const S0 = 8 * FPS; // boot
const S1 = 9 * FPS; // interaction demo (to submission)
const S2 = 11 * FPS; // problem
const S3 = 18 * FPS; // flow
const S4 = 12 * FPS; // collaboration
const S5 = 18 * FPS; // admin
const S6 = 20 * FPS; // benefits
const S7 = 18 * FPS; // closing

const totalFrames =
  S0 +
  S1 +
  S2 +
  S3 +
  S4 +
  S5 +
  S6 +
  S7 -
  (T_QUICK + T_NORMAL + T_QUICK + T_NORMAL + T_SLOW + T_NORMAL + T_QUICK);

export type PromoZhV2Props = Record<string, unknown>;

export const PromoZhV2: React.FC<PromoZhV2Props> = () => {
  const timingQuick = springTiming({ durationInFrames: T_QUICK, config: { damping: 20, mass: 0.8 } });
  const timingNormal = springTiming({ durationInFrames: T_NORMAL, config: { damping: 18, mass: 1 } });
  const timingSlow = linearTiming({ durationInFrames: T_SLOW });

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={S0}>
        <IntroBoot />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timingQuick} />

      <TransitionSeries.Sequence durationInFrames={S1}>
        <InteractionDemoV2 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-bottom' })} timing={timingNormal} />

      <TransitionSeries.Sequence durationInFrames={S2}>
        <ProblemV2 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={flip({ direction: 'from-left' })} timing={timingQuick} />

      <TransitionSeries.Sequence durationInFrames={S3}>
        <FlowV2 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-top' })} timing={timingNormal} />

      <TransitionSeries.Sequence durationInFrames={S4}>
        <CollaborationV2 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={timingSlow} />

      <TransitionSeries.Sequence durationInFrames={S5}>
        <AdminV2 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-bottom' })} timing={timingNormal} />

      <TransitionSeries.Sequence durationInFrames={S6}>
        <BenefitsV2 />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={timingQuick} />

      <TransitionSeries.Sequence durationInFrames={S7}>
        <ClosingV2 />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export const PROMO_V2_DURATION_FRAMES = totalFrames;

