import { useState } from 'react';
import { Box, Button, Typography, TextField, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { PROVINCES, getPolygonPoints } from '../data/gameData';
import ZoomControls from '../components/ZoomControls';
import type { VB } from '../components/ZoomControls';
import { VB_FULL } from '../components/ZoomControls';

interface Props {
  onBack: () => void;
}

interface ProvincePosition {
  id: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  labelX: number;
  labelY: number;
  name: string;
  region: string;
  daimyoId: string;
  adjacent: string[];
}

export default function MapEditorScreen({ onBack }: Props) {
  const [provinces, setProvinces] = useState<ProvincePosition[]>(
    PROVINCES.map(p => ({
      id: p.id,
      centerX: p.centerX,
      centerY: p.centerY,
      width: p.width,
      height: p.height,
      labelX: p.labelX,
      labelY: p.labelY,
      name: p.name,
      region: p.region,
      daimyoId: p.daimyoId,
      adjacent: p.adjacent,
    }))
  );
  const [vb, setVb] = useState<VB>(VB_FULL);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedProvince = provinces.find(p => p.id === selectedId) ?? null;

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setDraggingId(id);
    setSelectedId(id);
    const province = provinces.find(p => p.id === id);
    if (province) {
      setDragOffset({
        x: e.clientX - province.centerX,
        y: e.clientY - province.centerY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    
    setProvinces(prev => prev.map(p => {
      if (p.id === draggingId) {
        const newCenterX = e.clientX - dragOffset.x;
        const newCenterY = e.clientY - dragOffset.y;
        return {
          ...p,
          centerX: newCenterX,
          centerY: newCenterY,
          labelX: newCenterX,
          labelY: newCenterY,
        };
      }
      return p;
    }));
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  const handleSave = () => {
    // JSONファイルをダウンロード
    const updatedProvinces = PROVINCES.map(p => {
      const updated = provinces.find(up => up.id === p.id);
      if (updated) {
        return {
          ...p,
          centerX: updated.centerX,
          centerY: updated.centerY,
          width: updated.width,
          height: updated.height,
          labelX: updated.labelX,
          labelY: updated.labelY,
        };
      }
      return p;
    });

    const json = JSON.stringify(updatedProvinces, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'provinces.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('provinces.jsonをダウンロードしました。\nこのファイルを src/data/provinces.json に上書きしてください。');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0d0d1a 0%, #1a1a3e 60%, #0d1a2e 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 2,
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', mb: 2 }}>
        <Button
          variant="outlined"
          onClick={onBack}
          startIcon={<ArrowBackIcon />}
          sx={{ borderColor: '#3a5a7a', color: '#cce0f5', '&:hover': { borderColor: '#5a7abc' } }}
        >
          戻る
        </Button>
        <Typography sx={{ color: '#e8d5a3', fontWeight: 'bold', fontSize: '1.5rem' }}>
          マップエディタ
        </Typography>
        <Button
          variant="contained"
          onClick={handleSave}
          startIcon={<SaveIcon />}
          sx={{ background: '#2a5a8a', '&:hover': { background: '#3a7abc' } }}
        >
          保存
        </Button>
      </Box>

      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 'calc(100vh - 80px)',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
          {provinces.map((province) => {
            const points = getPolygonPoints(province as any);
            return (
              <g key={province.id}>
                <polygon
                  points={points}
                  fill={selectedId === province.id ? 'rgba(74, 138, 188, 0.6)' : draggingId === province.id ? 'rgba(74, 138, 188, 0.5)' : 'rgba(74, 138, 188, 0.3)'}
                  stroke={selectedId === province.id ? '#7ab8e8' : draggingId === province.id ? '#4a8abc' : '#3a6a9a'}
                  strokeWidth="2"
                  style={{ cursor: 'move', transition: 'fill 0.15s' }}
                  onMouseDown={(e) => handleMouseDown(e, province.id)}
                />
                <text
                  x={province.labelX}
                  y={province.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="8.5"
                  fill="rgba(255,255,255,0.8)"
                  pointerEvents="none"
                  style={{ userSelect: 'none' }}
                >
                  {province.name}
                </text>
              </g>
            );
          })}
        </svg>
        <ZoomControls vb={vb} onVbChange={setVb} />

        {selectedProvince && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              background: 'rgba(15, 20, 35, 0.95)',
              border: '1px solid rgba(74, 138, 188, 0.5)',
              borderRadius: 2,
              p: 2,
              minWidth: 200,
              zIndex: 20,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ color: '#e8d5a3', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {selectedProvince.name}
              </Typography>
              <IconButton size="small" onClick={() => setSelectedId(null)} sx={{ color: '#8aa0b8' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                label="横幅"
                type="number"
                size="small"
                value={selectedProvince.width}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v > 0) {
                    setProvinces(prev => prev.map(p => p.id === selectedId ? { ...p, width: v } : p));
                  }
                }}
                slotProps={{ htmlInput: { min: 1, style: { color: '#cce0f5' } }, inputLabel: { style: { color: '#8aa0b8' } } }}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(74,138,188,0.4)' }, '&:hover fieldset': { borderColor: 'rgba(74,138,188,0.7)' }, '&.Mui-focused fieldset': { borderColor: '#4a8abc' } },
                }}
              />
              <TextField
                label="縦幅"
                type="number"
                size="small"
                value={selectedProvince.height}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v) && v > 0) {
                    setProvinces(prev => prev.map(p => p.id === selectedId ? { ...p, height: v } : p));
                  }
                }}
                slotProps={{ htmlInput: { min: 1, style: { color: '#cce0f5' } }, inputLabel: { style: { color: '#8aa0b8' } } }}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(74,138,188,0.4)' }, '&:hover fieldset': { borderColor: 'rgba(74,138,188,0.7)' }, '&.Mui-focused fieldset': { borderColor: '#4a8abc' } },
                }}
              />
            </Box>
            <Typography sx={{ color: '#8aa0b8', fontSize: '0.75rem' }}>
              位置: ({selectedProvince.centerX.toFixed(1)}, {selectedProvince.centerY.toFixed(1)})
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
