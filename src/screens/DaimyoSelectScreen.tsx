import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Fab,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import type { Daimyo, Province } from '../data/gameData';
import { DAIMYO_LIST, PROVINCES, getDaimyo, getProvincesByDaimyo } from '../data/gameData';

interface Props {
  onBack: () => void;
  onStart: (daimyoId: string) => void;
}

const NEUTRAL_COLOR = '#2a3a2a';
const NEUTRAL_HOVER_COLOR = '#3a4a3a';
const OCEAN_COLOR = '#0a1628';
const LAND_BORDER = '#2a4a2a';

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ mb: 0.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography variant="caption" sx={{ color: '#8899aa', fontSize: '0.75rem' }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: '#cce0f5', fontWeight: 'bold', fontSize: '0.75rem' }}>
          {value}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{
          height: 5,
          borderRadius: 3,
          bgcolor: '#1a2a3a',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            bgcolor: value >= 90 ? '#ff6b35' : value >= 80 ? '#c8a415' : '#4a8abc',
          },
        }}
      />
    </Box>
  );
}

function ProvincePolygon({
  province,
  daimyo,
  isSelected,
  isHovered,
  onHover,
  onLeave,
  onClick,
}: {
  province: Province;
  daimyo: Daimyo | undefined;
  isSelected: boolean;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const isNeutral = !daimyo;
  const baseColor = isNeutral ? NEUTRAL_COLOR : daimyo.color;
  const hoverColor = isNeutral ? NEUTRAL_HOVER_COLOR : daimyo.color;
  const fillOpacity = isSelected ? 0.95 : isHovered ? 0.75 : isNeutral ? 0.6 : 0.5;
  const strokeColor = isSelected ? '#ffffff' : isHovered ? 'rgba(255,255,255,0.7)' : LAND_BORDER;
  const strokeWidth = isSelected ? 2 : isHovered ? 1.5 : 0.8;

  return (
    <g>
      <polygon
        points={province.points}
        fill={isHovered ? hoverColor : baseColor}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        style={{
          cursor: isNeutral ? 'default' : 'pointer',
          filter: isSelected ? 'drop-shadow(0 0 6px rgba(255,255,255,0.5))' : 'none',
          transition: 'fill-opacity 0.15s, stroke 0.15s',
        }}
        onMouseEnter={onHover}
        onMouseLeave={onLeave}
        onClick={isNeutral ? undefined : onClick}
      />
      <text
        x={province.labelX}
        y={province.labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="8.5"
        fill={isNeutral ? 'rgba(180,180,180,0.5)' : 'rgba(255,255,255,0.8)'}
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {province.name}
      </text>
    </g>
  );
}

export default function DaimyoSelectScreen({ onBack, onStart }: Props) {
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);
  const [selectedDaimyoId, setSelectedDaimyoId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [bottomTab, setBottomTab] = useState(0);

  const selectedDaimyo = selectedDaimyoId ? getDaimyo(selectedDaimyoId) : null;
  const selectedProvinces = selectedDaimyoId ? getProvincesByDaimyo(selectedDaimyoId) : [];

  const handleProvinceClick = (province: Province) => {
    const daimyo = getDaimyo(province.daimyoId);
    if (daimyo) {
      setSelectedDaimyoId(daimyo.id);
      setBottomTab(0);
    }
  };

  const handleDaimyoListClick = (daimyo: Daimyo) => {
    setSelectedDaimyoId(daimyo.id);
    setBottomTab(0);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.6));

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #050a14 0%, #0d1628 50%, #080e1c 100%)',
      }}
    >
      {/* ヘッダー */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.45)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ color: '#8899aa', '&:hover': { color: '#cce0f5' }, minWidth: 0 }}
        >
          戻る
        </Button>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography sx={{ color: '#e8d5a3', fontSize: '1rem', fontWeight: 'bold', letterSpacing: '0.2em' }}>
            大名選択
          </Typography>
          <Typography sx={{ color: '#556677', fontSize: '0.65rem', letterSpacing: '0.1em' }}>
            領地をタップして大名を選択
          </Typography>
        </Box>
        <Box sx={{ width: 70 }} />
      </Box>

      {/* マップエリア */}
      <Box
        sx={{
          flex: '0 0 45%',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: OCEAN_COLOR,
        }}
      >
        <svg
          viewBox="0 0 700 950"
          style={{
            height: '100%',
            width: 'auto',
            display: 'block',
            maxHeight: '100%',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out',
            touchAction: 'none',
          }}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x="0" y="0" width="700" height="950" fill={OCEAN_COLOR} />

          {[175, 350, 525, 700].map((x) => (
            <line key={`vl${x}`} x1={x} y1="0" x2={x} y2="950" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {[237, 475, 712, 950].map((y) => (
            <line key={`hl${y}`} x1="0" y1={y} x2="700" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}

          {PROVINCES.map((province) => {
            const daimyo = getDaimyo(province.daimyoId);
            const isSelected = selectedProvinces.some((p) => p.id === province.id);
            const isHovered = hoveredProvinceId === province.id;
            return (
              <ProvincePolygon
                key={province.id}
                province={province}
                daimyo={daimyo}
                isSelected={isSelected}
                isHovered={isHovered}
                onHover={() => setHoveredProvinceId(province.id)}
                onLeave={() => setHoveredProvinceId(null)}
                onClick={() => handleProvinceClick(province)}
              />
            );
          })}

          <text x="30" y="30" fontSize="11" fill="rgba(255,255,255,0.3)" fontFamily="serif">北</text>
          <text x="30" y="900" fontSize="11" fill="rgba(255,255,255,0.3)" fontFamily="serif">南</text>
        </svg>

        {/* ズームコントロール */}
        <Box sx={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 0.5, zIndex: 10 }}>
          <Fab
            size="small"
            onClick={handleZoomIn}
            disabled={zoom >= 2.5}
            sx={{ bgcolor: '#2a4a6a', color: '#88aacc', '&:hover': { bgcolor: '#3a5a7a' }, '&:disabled': { bgcolor: '#1a2a3a', color: '#334' }, width: 36, height: 36, minHeight: 36 }}
          >
            <ZoomInIcon sx={{ fontSize: '1.1rem' }} />
          </Fab>
          <Fab
            size="small"
            onClick={handleZoomOut}
            disabled={zoom <= 0.6}
            sx={{ bgcolor: '#2a4a6a', color: '#88aacc', '&:hover': { bgcolor: '#3a5a7a' }, '&:disabled': { bgcolor: '#1a2a3a', color: '#334' }, width: 36, height: 36, minHeight: 36 }}
          >
            <ZoomOutIcon sx={{ fontSize: '1.1rem' }} />
          </Fab>
        </Box>
      </Box>

      {/* 下段パネル */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* タブ */}
        <Tabs
          value={bottomTab}
          onChange={(_, v) => setBottomTab(v)}
          sx={{
            flexShrink: 0,
            minHeight: 40,
            background: 'rgba(0,0,0,0.35)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            '& .MuiTab-root': { minHeight: 40, fontSize: '0.78rem', color: '#667788', py: 0.5 },
            '& .Mui-selected': { color: '#e8d5a3 !important' },
            '& .MuiTabs-indicator': { bgcolor: '#e8d5a3' },
          }}
        >
          <Tab label={selectedDaimyo ? `${selectedDaimyo.name}` : '大名を選択'} sx={{ flex: 1 }} />
          <Tab label="大名一覧" sx={{ flex: 1 }} />
        </Tabs>

        {/* タブコンテンツ */}
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

          {/* 選択中タブ */}
          {bottomTab === 0 && (
            <Box sx={{ p: 1.5 }}>
              {selectedDaimyo ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: selectedDaimyo.color,
                        flexShrink: 0,
                        boxShadow: `0 0 8px ${selectedDaimyo.color}`,
                      }}
                    />
                    <Typography sx={{ color: '#8899aa', fontSize: '0.72rem' }}>{selectedDaimyo.nameReading}</Typography>
                  </Box>
                  <Typography sx={{ color: '#e8d5a3', fontWeight: 'bold', fontSize: '1.25rem', mb: 0.3 }}>
                    {selectedDaimyo.name}
                  </Typography>
                  <Typography sx={{ color: '#556677', fontSize: '0.72rem', mb: 1.5 }}>
                    {selectedDaimyo.clan} ／ {selectedDaimyo.era} ／ 拠点：{selectedProvinces.map((p) => p.name).join('・')}
                  </Typography>

                  <StatBar label="武力" value={selectedDaimyo.stats.military} />
                  <StatBar label="政治" value={selectedDaimyo.stats.politics} />
                  <StatBar label="魅力" value={selectedDaimyo.stats.charisma} />

                  <Typography sx={{ color: '#8899bb', fontSize: '0.78rem', lineHeight: 1.7, my: 1.5 }}>
                    {selectedDaimyo.description}
                  </Typography>

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => onStart(selectedDaimyo.id)}
                    sx={{
                      background: 'linear-gradient(135deg, #2a5a8a 0%, #3a7abc 100%)',
                      fontWeight: 'bold',
                      letterSpacing: '0.1em',
                      py: 1.4,
                      fontSize: '1rem',
                      '&:hover': { background: 'linear-gradient(135deg, #3a7abc 0%, #4a9ae0 100%)' },
                    }}
                  >
                    この大名で開始
                  </Button>
                </>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2, gap: 1.5 }}>
                  <Typography sx={{ color: '#334455', fontSize: '2.5rem' }}>⚔</Typography>
                  <Typography sx={{ color: '#445566', textAlign: 'center', fontSize: '0.88rem', lineHeight: 1.7 }}>
                    地図の色付き領地をタップして
                    <br />
                    大名を選択してください
                  </Typography>
                  <Button
                    onClick={() => setBottomTab(1)}
                    sx={{ color: '#4a8abc', fontSize: '0.82rem', mt: 0.5 }}
                  >
                    大名一覧から選ぶ →
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* 大名一覧タブ */}
          {bottomTab === 1 && (
            <Box sx={{ p: 1 }}>
              {DAIMYO_LIST.map((daimyo) => {
                const provinces = getProvincesByDaimyo(daimyo.id);
                const isSelected = selectedDaimyoId === daimyo.id;
                return (
                  <Card
                    key={daimyo.id}
                    onClick={() => handleDaimyoListClick(daimyo)}
                    sx={{
                      mb: 0.75,
                      cursor: 'pointer',
                      background: isSelected
                        ? `linear-gradient(135deg, ${daimyo.color}33 0%, ${daimyo.color}22 100%)`
                        : 'rgba(255,255,255,0.03)',
                      border: isSelected
                        ? `1px solid ${daimyo.color}88`
                        : '1px solid rgba(255,255,255,0.06)',
                      '&:active': { opacity: 0.8 },
                    }}
                  >
                    <CardContent sx={{ py: '10px !important', px: '12px !important', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: daimyo.color, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            color: isSelected ? '#e8d5a3' : '#aabbcc',
                            fontWeight: isSelected ? 'bold' : 'normal',
                            fontSize: '0.9rem',
                          }}
                        >
                          {daimyo.name}
                        </Typography>
                        <Typography sx={{ color: '#445566', fontSize: '0.65rem' }}>
                          {provinces.map((p) => p.name).join('・')} ／ {daimyo.era}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        <Chip label={`武${daimyo.stats.military}`} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#c04020aa', color: '#ffaa88' }} />
                        <Chip label={`政${daimyo.stats.politics}`} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#1040b0aa', color: '#88aaff' }} />
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}

        </Box>
      </Box>
    </Box>
  );
}
