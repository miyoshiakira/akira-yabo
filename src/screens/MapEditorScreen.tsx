import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
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

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setDraggingId(id);
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
                  fill={draggingId === province.id ? 'rgba(74, 138, 188, 0.6)' : 'rgba(74, 138, 188, 0.3)'}
                  stroke={draggingId === province.id ? '#4a8abc' : '#3a6a9a'}
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
      </Box>
    </Box>
  );
}
