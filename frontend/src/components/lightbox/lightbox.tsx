import playIcon from '@iconify-icons/carbon/play';
import closeIcon from '@iconify-icons/carbon/close';
import pauseIcon from '@iconify-icons/carbon/pause';
import zoomInIcon from '@iconify-icons/carbon/zoom-in';
import zoomOutIcon from '@iconify-icons/carbon/zoom-out';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Video from 'yet-another-react-lightbox/plugins/video';
import chevronLeftIcon from '@iconify-icons/carbon/chevron-left';
import centerToFitIcon from '@iconify-icons/carbon/center-to-fit';
import fitToScreenIcon from '@iconify-icons/carbon/fit-to-screen';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import chevronRightIcon from '@iconify-icons/carbon/chevron-right';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import ReactLightbox, { useLightboxState } from 'yet-another-react-lightbox';

import Box from '@mui/material/Box';

import { Iconify } from '../iconify';
import { lightboxClasses } from './classes';

import type { LightBoxProps } from './types';

// ----------------------------------------------------------------------

export function Lightbox({
  slides,
  disableZoom,
  disableVideo,
  disableTotal,
  disableCaptions,
  disableSlideshow,
  disableThumbnails,
  disableFullscreen,
  onGetCurrentIndex,
  className,
  ...other
}: LightBoxProps) {
  const totalItems = slides ? slides.length : 0;

  return (
    <ReactLightbox
      slides={slides}
      animation={{ swipe: 240 }}
      carousel={{ finite: totalItems < 5 }}
      controller={{ closeOnBackdropClick: true }}
      plugins={getPlugins({
        disableZoom,
        disableVideo,
        disableCaptions,
        disableSlideshow,
        disableThumbnails,
        disableFullscreen,
      })}
      on={{
        view: ({ index }: { index: number }) => {
          if (onGetCurrentIndex) {
            onGetCurrentIndex(index);
          }
        },
      }}
      toolbar={{
        buttons: [
          <DisplayTotal key={0} totalItems={totalItems} disableTotal={disableTotal} />,
          'close',
        ],
      }}
      render={{
        iconClose: () => <Iconify width={24} icon={closeIcon} />,
        iconZoomIn: () => <Iconify width={24} icon={zoomInIcon} />,
        iconZoomOut: () => <Iconify width={24} icon={zoomOutIcon} />,
        iconSlideshowPlay: () => <Iconify width={24} icon={playIcon} />,
        iconSlideshowPause: () => <Iconify width={24} icon={pauseIcon} />,
        iconPrev: () => <Iconify width={32} icon={chevronLeftIcon} />,
        iconNext: () => <Iconify width={32} icon={chevronRightIcon} />,
        iconExitFullscreen: () => <Iconify width={24} icon={centerToFitIcon} />,
        iconEnterFullscreen: () => <Iconify width={24} icon={fitToScreenIcon} />,
      }}
      className={lightboxClasses.root.concat(className ? ` ${className}` : '')}
      {...other}
    />
  );
}

// ----------------------------------------------------------------------

export function getPlugins({
  disableZoom,
  disableVideo,
  disableCaptions,
  disableSlideshow,
  disableThumbnails,
  disableFullscreen,
}: Partial<LightBoxProps>) {
  let plugins = [Captions, Fullscreen, Slideshow, Thumbnails, Video, Zoom];

  if (disableThumbnails) {
    plugins = plugins.filter((plugin) => plugin !== Thumbnails);
  }
  if (disableCaptions) {
    plugins = plugins.filter((plugin) => plugin !== Captions);
  }
  if (disableFullscreen) {
    plugins = plugins.filter((plugin) => plugin !== Fullscreen);
  }
  if (disableSlideshow) {
    plugins = plugins.filter((plugin) => plugin !== Slideshow);
  }
  if (disableZoom) {
    plugins = plugins.filter((plugin) => plugin !== Zoom);
  }
  if (disableVideo) {
    plugins = plugins.filter((plugin) => plugin !== Video);
  }

  return plugins;
}

// ----------------------------------------------------------------------

type DisplayTotalProps = {
  totalItems: number;
  disableTotal?: boolean;
};

export function DisplayTotal({ totalItems, disableTotal }: DisplayTotalProps) {
  const { currentIndex } = useLightboxState();

  if (disableTotal) {
    return null;
  }

  return (
    <Box
      component="span"
      className="yarl__button"
      sx={{
        typography: 'body2',
        alignItems: 'center',
        display: 'inline-flex',
        justifyContent: 'center',
      }}
    >
      <strong> {currentIndex + 1} </strong> / {totalItems}
    </Box>
  );
}
