import { Box, Fab } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CropFreeIcon from '@mui/icons-material/CropFree';

const VB_FULL = { x: 0, y: 0, w: 810, h: 930 };
const MIN_VB_W = 810 / 5;
const MAP_AR = 810 / 930;
const FAB_STYLE = { background: 'rgba(30, 42, 58, 0.9)', color: '#cce0f5', '&:hover': { background: 'rgba(42, 58, 78, 0.95)' }, '&:disabled': { background: 'rgba(20, 30, 42, 0.5)', color: '#557799' } };

type VB = typeof VB_FULL;

interface Props {
  vb: VB;
  onVbChange: (updater: (prev: VB) => VB) => void;
}

export default function ZoomControls({ vb, onVbChange }: Props) {
  const clampVb = (x: number, y: number, w: number, h: number): VB => ({
    x: Math.max(0, Math.min(810 - w, x)),
    y: Math.max(0, Math.min(930 - h, y)),
    w, h,
  });

  const zoomBy = (factor: number) => {
    onVbChange((prev) => {
      const newW = Math.max(MIN_VB_W, Math.min(810, prev.w / factor));
      if (newW >= 810 * 0.99) return VB_FULL;
      const newH = newW * (930 / 810);
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return clampVb(cx - newW / 2, cy - newH / 2, newW, newH);
    });
  };

  const resetZoom = () => onVbChange(() => VB_FULL);
  const isZoomed = vb.w < 810 * 0.95;

  return (
    <Box sx={{ position: 'absolute', bottom: 12, right: 10, display: 'flex', flexDirection: 'column', gap: 0.6, zIndex: 10 }}>
      <Fab size="small" onClick={() => zoomBy(1.6)} disabled={vb.w <= MIN_VB_W * 1.01} sx={FAB_STYLE}>
        <ZoomInIcon sx={{ fontSize: '1.15rem' }} />
      </Fab>
      <Fab size="small" onClick={() => zoomBy(1 / 1.6)} disabled={!isZoomed} sx={FAB_STYLE}>
        <ZoomOutIcon sx={{ fontSize: '1.15rem' }} />
      </Fab>
      {isZoomed && (
        <Fab size="small" onClick={resetZoom} sx={FAB_STYLE}>
          <CropFreeIcon sx={{ fontSize: '1rem' }} />
        </Fab>
      )}
    </Box>
  );
}

export type { VB };
export { VB_FULL, MIN_VB_W, MAP_AR };
