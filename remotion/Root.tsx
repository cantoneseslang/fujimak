import { Composition } from 'remotion';
import { PromoZh, PROMO_DURATION_FRAMES } from './PromoZh';
import type { PromoZhProps } from './PromoZh';
import { PromoZhV2, PROMO_V2_DURATION_FRAMES } from './PromoZhV2';
import type { PromoZhV2Props } from './PromoZhV2';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PromoZh"
        component={PromoZh}
        durationInFrames={PROMO_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{} satisfies PromoZhProps}
      />
      <Composition
        id="PromoZhV2"
        component={PromoZhV2}
        durationInFrames={PROMO_V2_DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{} satisfies PromoZhV2Props}
      />
    </>
  );
};
