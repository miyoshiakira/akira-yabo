import { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { Daimyo, Province } from '../data/gameData';
import { DAIMYO_LIST, PROVINCES, getDaimyo, getProvincesByDaimyo, getPolygonPoints } from '../data/gameData';
import ZoomControls from '../components/ZoomControls';
import type { VB } from '../components/ZoomControls';
import { VB_FULL } from '../components/ZoomControls';

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
        points={getPolygonPoints(province)}
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
  const [vb, setVb] = useState<VB>(VB_FULL);
  const [bottomTab, setBottomTab] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMovedRef = useRef(false);
  const gestureRef = useRef<{
    startTouches: { x: number; y: number }[];
    startVb: VB;
    display: { left: number; top: number; w: number; h: number };
  } | null>(null);

  const selectedDaimyo = selectedDaimyoId ? getDaimyo(selectedDaimyoId) : null;
  const selectedProvinces = selectedDaimyoId ? getProvincesByDaimyo(selectedDaimyoId) : [];

  const getDisplay = (rect: DOMRect) => {
    const mapAr = 810 / 930;
    const containerAr = rect.width / rect.height;
    let displayW, displayH;
    if (containerAr > mapAr) {
      displayH = rect.height;
      displayW = rect.height * mapAr;
    } else {
      displayW = rect.width;
      displayH = rect.width / mapAr;
    }
    return {
      left: (rect.width - displayW) / 2,
      top: (rect.height - displayH) / 2,
      w: displayW,
      h: displayH,
    };
  };

  const toSvg = (sx: number, sy: number, d: ReturnType<typeof getDisplay>, v: VB) => ({
    x: ((sx - d.left) / d.w) * v.w + v.x,
    y: ((sy - d.top) / d.h) * v.h + v.y,
  });

  const clampVb = (x: number, y: number, w: number, h: number): VB => ({
    x: Math.max(0, Math.min(810 - w, x)),
    y: Math.max(0, Math.min(930 - h, y)),
    w, h,
  });

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    hasMovedRef.current = false;
    gestureRef.current = {
      startTouches: Array.from(e.touches).map((t) => ({ x: t.clientX - rect.left, y: t.clientY - rect.top })),
      startVb: { ...vb },
      display: getDisplay(rect),
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!gestureRef.current) return;
    const { startTouches, startVb, display } = gestureRef.current;
    const containerRect = containerRef.current!.getBoundingClientRect();
    const cur = Array.from(e.touches).map((t) => ({ x: t.clientX - containerRect.left, y: t.clientY - containerRect.top }));

    if (cur.length === 1 && startTouches.length === 1) {
      const dx = cur[0].x - startTouches[0].x;
      const dy = cur[0].y - startTouches[0].y;
      if (Math.hypot(dx, dy) > 5) hasMovedRef.current = true;
      if (startVb.w >= 810 * 0.99) return;
      const svgDx = (dx / display.w) * startVb.w;
      const svgDy = (dy / display.h) * startVb.h;
      setVb(clampVb(startVb.x - svgDx, startVb.y - svgDy, startVb.w, startVb.h));
    } else if (cur.length >= 2 && startTouches.length >= 2) {
      hasMovedRef.current = true;
      const sd = Math.hypot(startTouches[1].x - startTouches[0].x, startTouches[1].y - startTouches[0].y);
      const cd = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
      if (sd === 0) return;
      const factor = cd / sd;
      const newW = Math.max(810 / 5, Math.min(810, startVb.w / factor));
      const newH = newW * (930 / 810);
      const center = toSvg((startTouches[0].x + startTouches[1].x) / 2, (startTouches[0].y + startTouches[1].y) / 2, display, startVb);
      const curCenter = toSvg((cur[0].x + cur[1].x) / 2, (cur[0].y + cur[1].y) / 2, display, startVb);
      const shiftX = center.x - curCenter.x;
      const shiftY = center.y - curCenter.y;
      const cx = startVb.x + startVb.w / 2 - shiftX;
      const cy = startVb.y + startVb.h / 2 - shiftY;
      setVb(clampVb(cx - newW / 2, cy - newH / 2, newW, newH));
    }
  };

  const handleTouchEnd = () => {
    gestureRef.current = null;
  };

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
        ref={containerRef}
        sx={{
          flex: '0 0 45%',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: OCEAN_COLOR,
          touchAction: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          style={{ width: '100%', height: '100%', display: 'block' }}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x="0" y="0" width="810" height="930" fill={OCEAN_COLOR} />

          {[175, 350, 525, 700].map((x) => (
            <line key={`vl${x}`} x1={x} y1="0" x2={x} y2="930" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          ))}
          {[237, 475, 712, 930].map((y) => (
            <line key={`hl${y}`} x1="0" y1={y} x2="810" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
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

        <ZoomControls vb={vb} onVbChange={setVb} />
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
