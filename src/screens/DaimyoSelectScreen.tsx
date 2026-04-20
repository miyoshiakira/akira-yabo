import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Tooltip,
  Typography,
  Fab,
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
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography variant="caption" sx={{ color: '#8899aa' }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: '#cce0f5', fontWeight: 'bold' }}>
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

  const selectedDaimyo = selectedDaimyoId ? getDaimyo(selectedDaimyoId) : null;
  const selectedProvinces = selectedDaimyoId ? getProvincesByDaimyo(selectedDaimyoId) : [];

  const handleProvinceClick = (province: Province) => {
    const daimyo = getDaimyo(province.daimyoId);
    if (daimyo) setSelectedDaimyoId(daimyo.id);
  };

  const handleDaimyoListClick = (daimyo: Daimyo) => {
    setSelectedDaimyoId(daimyo.id);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.6));
  };

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #050a14 0%, #0d1628 50%, #080e1c 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{ color: '#8899aa', '&:hover': { color: '#cce0f5' } }}
        >
          戻る
        </Button>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Typography
            variant="h5"
            sx={{ color: '#e8d5a3', letterSpacing: '0.2em', fontWeight: 'bold' }}
          >
            大名選択
          </Typography>
          <Typography variant="caption" sx={{ color: '#556677', letterSpacing: '0.15em' }}>
            領地をクリックして大名を選択
          </Typography>
        </Box>
        <Box sx={{ width: 80 }} />
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Map panel */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 1,
            overflow: 'visible',
            position: 'relative',
          }}
        >
          {/* Zoom controls */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 30,
              right: 30,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              zIndex: 1000,
            }}
          >
            <Fab
              size="medium"
              onClick={handleZoomIn}
              disabled={zoom >= 2}
              sx={{
                bgcolor: '#4a8abc',
                color: '#ffffff',
                '&:hover': { bgcolor: '#5a9acc' },
                '&:disabled': { bgcolor: '#2a4a5c', color: '#556677' },
              }}
            >
              <ZoomInIcon />
            </Fab>
            <Fab
              size="medium"
              onClick={handleZoomOut}
              disabled={zoom <= 0.6}
              sx={{
                bgcolor: '#4a8abc',
                color: '#ffffff',
                '&:hover': { bgcolor: '#5a9acc' },
                '&:disabled': { bgcolor: '#2a4a5c', color: '#556677' },
              }}
            >
              <ZoomOutIcon />
            </Fab>
          </Box>

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
            }}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Ocean */}
            <rect x="0" y="0" width="700" height="950" fill={OCEAN_COLOR} />

            {/* Grid lines (subtle) */}
            {[175, 350, 525, 700].map((x) => (
              <line key={`vl${x}`} x1={x} y1="0" x2={x} y2="950" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            ))}
            {[237, 475, 712, 950].map((y) => (
              <line key={`hl${y}`} x1="0" y1={y} x2="700" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
            ))}

            {/* Provinces */}
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

            {/* Compass */}
            <text x="30" y="30" fontSize="11" fill="rgba(255,255,255,0.3)" fontFamily="serif">北</text>
            <text x="30" y="900" fontSize="11" fill="rgba(255,255,255,0.3)" fontFamily="serif">南</text>
          </svg>
        </Box>

        {/* Right panel */}
        <Box
          sx={{
            width: 320,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Selected daimyo info */}
          <Box
            sx={{
              flex: '0 0 auto',
              p: 2,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              minHeight: 260,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selectedDaimyo ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
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
                  <Typography variant="caption" sx={{ color: '#8899aa' }}>
                    {selectedDaimyo.nameReading}
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ color: '#e8d5a3', fontWeight: 'bold', mb: 0.3 }}>
                  {selectedDaimyo.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#556677', mb: 1.5 }}>
                  {selectedDaimyo.clan} ／ {selectedDaimyo.era} ／ 拠点：
                  {selectedProvinces.map((p) => p.name).join('・')}
                </Typography>

                <StatBar label="武力" value={selectedDaimyo.stats.military} />
                <StatBar label="政治" value={selectedDaimyo.stats.politics} />
                <StatBar label="魅力" value={selectedDaimyo.stats.charisma} />

                <Typography
                  variant="body2"
                  sx={{ color: '#8899bb', mt: 1, lineHeight: 1.7, fontSize: '0.78rem', flex: 1 }}
                >
                  {selectedDaimyo.description}
                </Typography>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => onStart(selectedDaimyo.id)}
                  sx={{
                    mt: 2,
                    background: 'linear-gradient(135deg, #2a5a8a 0%, #3a7abc 100%)',
                    fontWeight: 'bold',
                    letterSpacing: '0.1em',
                    py: 1.2,
                    '&:hover': { background: 'linear-gradient(135deg, #3a7abc 0%, #4a9ae0 100%)' },
                  }}
                >
                  この大名で開始
                </Button>
              </>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                }}
              >
                <Typography sx={{ color: '#334455', fontSize: '2rem' }}>⚔</Typography>
                <Typography variant="body2" sx={{ color: '#445566', textAlign: 'center' }}>
                  地図の色付き領地をクリックして
                  <br />
                  大名を選択してください
                </Typography>
              </Box>
            )}
          </Box>

          {/* Daimyo list */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: '#445566', px: 1, display: 'block', mb: 0.5, letterSpacing: '0.1em' }}
            >
              ─ 大名一覧 ─
            </Typography>
            {DAIMYO_LIST.map((daimyo) => {
              const provinces = getProvincesByDaimyo(daimyo.id);
              const isSelected = selectedDaimyoId === daimyo.id;
              return (
                <Tooltip
                  key={daimyo.id}
                  title={`拠点: ${provinces.map((p) => p.name).join('・')}`}
                  placement="left"
                >
                  <Card
                    onClick={() => handleDaimyoListClick(daimyo)}
                    sx={{
                      mb: 0.5,
                      cursor: 'pointer',
                      background: isSelected
                        ? `linear-gradient(135deg, ${daimyo.color}33 0%, ${daimyo.color}22 100%)`
                        : 'rgba(255,255,255,0.03)',
                      border: isSelected
                        ? `1px solid ${daimyo.color}88`
                        : '1px solid rgba(255,255,255,0.06)',
                      transition: 'all 0.15s',
                      '&:hover': {
                        background: `${daimyo.color}22`,
                        border: `1px solid ${daimyo.color}55`,
                      },
                    }}
                  >
                    <CardContent
                      sx={{ py: '6px !important', px: '10px !important', display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: daimyo.color,
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: isSelected ? '#e8d5a3' : '#aabbcc',
                            fontWeight: isSelected ? 'bold' : 'normal',
                            fontSize: '0.8rem',
                          }}
                        >
                          {daimyo.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#445566', fontSize: '0.65rem' }}>
                          {provinces.map((p) => p.name).join('・')} ／ {daimyo.era}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                        <Typography variant="caption" sx={{ color: '#cc6644', fontSize: '0.62rem' }}>
                          武{daimyo.stats.military}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#44aacc', fontSize: '0.62rem' }}>
                          政{daimyo.stats.politics}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
