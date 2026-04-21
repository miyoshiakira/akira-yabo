import { forwardRef, useMemo, useRef, useState } from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  LinearProgress,
  Slide,
  Typography,
} from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';
import { keyframes } from '@emotion/react';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import GavelIcon from '@mui/icons-material/Gavel';
import InfoIcon from '@mui/icons-material/Info';
import HomeIcon from '@mui/icons-material/Home';
import MapIcon from '@mui/icons-material/Map';
import BuildIcon from '@mui/icons-material/Build';
import GroupIcon from '@mui/icons-material/Group';
import SaveIcon from '@mui/icons-material/Save';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CropFreeIcon from '@mui/icons-material/CropFree';
import { getDaimyo, getPolygonPoints, getProvince, PROVINCES } from '../data/gameData';
import type { Province } from '../data/gameData';
import { getRetainersByDaimyo, getRankByExp, getNextRank, RANKS } from '../data/retainerData';
import type { Retainer, RecruitedRetainerData, MyPrisonerData, RetainerExpData, RankDefinition } from '../data/retainerData';
import type { SaveData, EnemyDaimyoState } from '../lib/saveData';
import { writeSaveSlot } from '../lib/saveDataDB';
import BattleScreen from './BattleScreen';
import type { BattleOutcome } from './BattleScreen';

// ─── 型定義 ─────────────────────────────────────────────
interface GameState {
  year: number;
  month: number;
  soldiers: number;
  food: number;
  gold: number;
  security: number;
  population: number;
  ownedProvinces: string[];
  recruitedRetainers: RecruitedRetainerData[];
  myPrisoners: MyPrisonerData[];
  retainerExp: RetainerExpData[];
  enemyDaimyoState: Record<string, EnemyDaimyoState>;
  provinceOwnership: Record<string, string>;
}


interface Props {
  save: SaveData;
  onReturnToTitle: () => void;
}

// ─── 内政アクション定義 ──────────────────────────────────
interface InternalAction {
  id: string;
  name: string;
  icon: string;
  costLabel: string;
  effectLabel: string;
  color: string;
  description: string;
  canExecute(s: GameState): boolean;
  execute(s: GameState): Partial<GameState>;
  buildLog(s: GameState): string;
}

// 武将数・領地数を考慮してアクションを生成
function buildInternalActions(retainerCount: number, provinceCount: number): InternalAction[] {
  // 武将ボーナス：武将1人につき効率5%UP（最大50%）
  const rBonus = 1 + Math.min(0.5, retainerCount * 0.05);
  // 領地ボーナス：領地1つにつきコスト3%軽減（最大30%）
  const pDiscount = 1 - Math.min(0.3, provinceCount * 0.03);

  const conscriptBase = Math.floor(250 * rBonus);
  const conscriptMax = Math.floor((250 + 100) * rBonus);
  const conscriptCost = Math.floor(200 * pDiscount);

  const taxGoldBase = Math.floor(400 * rBonus);
  const taxFoodBase = Math.floor(200 * rBonus);
  const taxSecLoss = Math.max(5, 15 - Math.floor(provinceCount * 0.5));

  const popBase = Math.floor(500 * rBonus);
  const popMax = Math.floor(1000 * rBonus);
  const popCost = Math.floor(200 * pDiscount);

  const secCost = Math.floor(100 * pDiscount);
  const secGain = Math.min(30, 20 + Math.floor(retainerCount * 1));

  const tradeGoldBase = Math.floor(150 * rBonus);
  const tradeFoodBase = Math.floor(100 * rBonus);

  return [
    {
      id: 'conscription',
      name: '徴兵',
      icon: '⚔',
      costLabel: `金 −${conscriptCost}`,
      effectLabel: `兵士 +${conscriptBase}〜${conscriptMax}`,
      color: '#b03010',
      description: `金を使って兵士を募集する。治安が高いほど多く集まる。${retainerCount > 0 ? `武将${retainerCount}名の指揮で徴兵効率+${Math.floor((rBonus - 1) * 100)}%。` : ''}${provinceCount > 1 ? `領地${provinceCount}国の基盤で経費${Math.floor((1 - pDiscount) * 100)}%削減。` : ''}`,
      canExecute: (s) => s.gold >= conscriptCost,
      execute: (s) => ({ gold: s.gold - conscriptCost, soldiers: s.soldiers + Math.floor(conscriptBase + (s.security / 100) * (conscriptMax - conscriptBase)) }),
      buildLog: (s) => `徴兵 → 兵士+${Math.floor(conscriptBase + (s.security / 100) * (conscriptMax - conscriptBase))}、金-${conscriptCost}`,
    },
    {
      id: 'taxcollection',
      name: '徴収',
      icon: '💰',
      costLabel: `治安 −${taxSecLoss}`,
      effectLabel: `金 +${taxGoldBase}〜${Math.floor(taxGoldBase * 2)}、兵糧 +${taxFoodBase}`,
      color: '#b07010',
      description: `強制的に年貢を取り立てる。治安が低下するが収入が増える。${retainerCount > 0 ? `武将${retainerCount}名の奉行で徴収効率+${Math.floor((rBonus - 1) * 100)}%。` : ''}${provinceCount > 1 ? `領地${provinceCount}国の規模で治安低下を${15 - taxSecLoss}軽減。` : ''}`,
      canExecute: (_s) => true,
      execute: (s) => {
        const g = Math.floor(taxGoldBase + (s.population / 30) * (s.security / 100));
        return { gold: s.gold + g, food: s.food + taxFoodBase, security: Math.max(0, s.security - taxSecLoss) };
      },
      buildLog: (s) => `徴収 → 金+${Math.floor(taxGoldBase + (s.population / 30) * (s.security / 100))}、兵糧+${taxFoodBase}、治安-${taxSecLoss}`,
    },
    {
      id: 'population',
      name: '人口増加',
      icon: '🌾',
      costLabel: `兵糧 −${popCost}`,
      effectLabel: `人口 +${popBase}〜${popMax}`,
      color: '#207820',
      description: `兵糧を農業に投資して人口を増やす。人口が多いほど徴収額が上がる。${retainerCount > 0 ? `武将${retainerCount}名の治水で開拓効率+${Math.floor((rBonus - 1) * 100)}%。` : ''}${provinceCount > 1 ? `領地${provinceCount}国の農地で兵糧消費${Math.floor((1 - pDiscount) * 100)}%削減。` : ''}`,
      canExecute: (s) => s.food >= popCost,
      execute: (s) => ({ food: s.food - popCost, population: s.population + Math.floor(popBase + (s.security / 100) * (popMax - popBase)) }),
      buildLog: (s) => `人口増加 → 人口+${Math.floor(popBase + (s.security / 100) * (popMax - popBase))}、兵糧-${popCost}`,
    },
    {
      id: 'security',
      name: '治安強化',
      icon: '🛡',
      costLabel: `金 −${secCost}`,
      effectLabel: `治安 +${secGain}（上限100）`,
      color: '#1040b0',
      description: `法整備や見回りで治安を改善する。徴兵・人口増加・徴収に影響する。${retainerCount > 0 ? `武将${retainerCount}名の目付で治安回復+${secGain - 20}。` : ''}${provinceCount > 1 ? `領地${provinceCount}国の財源で経費${Math.floor((1 - pDiscount) * 100)}%削減。` : ''}`,
      canExecute: (s) => s.gold >= secCost && s.security < 100,
      execute: (s) => ({ gold: s.gold - secCost, security: Math.min(100, s.security + secGain) }),
      buildLog: (s) => `治安強化 → 治安+${Math.min(secGain, 100 - s.security)}、金-${secCost}`,
    },
    {
      id: 'trade',
      name: '貿易',
      icon: '⛵',
      costLabel: 'なし',
      effectLabel: `金 +${tradeGoldBase}〜${Math.floor(tradeGoldBase * 1.7)}、兵糧 +${tradeFoodBase}`,
      color: '#0a7090',
      description: `周辺国との交易で資源を増やす。人口が多いほど交易額が増える。${retainerCount > 0 ? `武将${retainerCount}名の外交で交易効率+${Math.floor((rBonus - 1) * 100)}%。` : ''}`,
      canExecute: (_s) => true,
      execute: (s) => ({ gold: s.gold + Math.floor(tradeGoldBase + s.population / 200), food: s.food + tradeFoodBase }),
      buildLog: (s) => `貿易 → 金+${Math.floor(tradeGoldBase + s.population / 200)}、兵糧+${tradeFoodBase}`,
    },
    {
      id: 'training',
      name: '鍛錬',
      icon: '🏋',
      costLabel: `金 −${Math.floor(150 * pDiscount)}`,
      effectLabel: `全武将の経験値 +${Math.floor(30 * rBonus)}〜${Math.floor(80 * rBonus)}`,
      color: '#8050a0',
      description: `武将を鍛え、経験値を獲得させる。武将数が多いほど個人の成長にばらつきが出る。${retainerCount > 0 ? `武将${retainerCount}名の切磋琢磨で鍛錬効率+${Math.floor((rBonus - 1) * 100)}%。` : '武将がいないと効果がない。'}${provinceCount > 1 ? `領地${provinceCount}国の道場で経費${Math.floor((1 - pDiscount) * 100)}%削減。` : ''}`,
      canExecute: (s) => s.gold >= Math.floor(150 * pDiscount) && retainerCount > 0,
      execute: (s) => {
        const updatedExp = [...s.retainerExp];
        const allIds = [...new Set([...updatedExp.map(e => e.retainerId)])];
        // 全武将にランダム経験値付与
        for (const rid of allIds) {
          const idx = updatedExp.findIndex(e => e.retainerId === rid);
          const gain = Math.floor((30 + Math.random() * 50) * rBonus);
          if (idx >= 0) {
            updatedExp[idx] = { ...updatedExp[idx], exp: updatedExp[idx].exp + gain };
          } else {
            updatedExp.push({ retainerId: rid, exp: gain });
          }
        }
        return { gold: s.gold - Math.floor(150 * pDiscount), retainerExp: updatedExp };
      },
      buildLog: (_s) => {
        const gain = Math.floor((30 + Math.random() * 50) * rBonus);
        return `鍛錬 → 全武将の経験値+${gain}前後、金-${Math.floor(150 * pDiscount)}`;
      },
    },
  ];
}

// ─── 地域収入テーブル（1国あたり/ターン） ────────────────
const REGION_INCOME: Record<string, { soldiers: number; food: number; gold: number }> = {
  '九州': { soldiers: 50, food: 100, gold: 80 },
  '四国': { soldiers: 45, food: 110, gold: 70 },
  '中国': { soldiers: 60, food:  90, gold: 90 },
  '近畿': { soldiers: 35, food:  80, gold: 150 },
  '北陸': { soldiers: 55, food: 130, gold: 70 },
  '中部': { soldiers: 70, food: 100, gold: 110 },
  '東海': { soldiers: 65, food:  90, gold: 100 },
  '関東': { soldiers: 80, food:  85, gold: 90 },
  '東北': { soldiers: 90, food: 120, gold: 65 },
};

const MAX_ACTIONS = 3;

function calcProvinceIncome(ownedProvinces: string[]): { soldiers: number; food: number; gold: number } {
  let soldiers = 0, food = 0, gold = 0;
  for (const id of ownedProvinces) {
    const p = getProvince(id);
    if (!p) continue;
    const inc = REGION_INCOME[p.region] ?? { soldiers: 50, food: 90, gold: 80 };
    soldiers += inc.soldiers;
    food += inc.food;
    gold += inc.gold;
  }
  return { soldiers, food, gold };
}

// ─── ユーティリティ ──────────────────────────────────────
function getAttackableProvinces(owned: string[]): Province[] {
  const set = new Set<string>();
  for (const id of owned) {
    const p = getProvince(id);
    if (p) p.adjacent.forEach((adj) => { if (!owned.includes(adj)) set.add(adj); });
  }
  return Array.from(set).map((id) => getProvince(id)!).filter(Boolean);
}

// 領地の現在の支配大名IDを取得（provinceOwnership優先、なければPROVINCESの既定値）
function getProvinceOwner(provinceId: string, ownership: Record<string, string>): string {
  return ownership[provinceId] ?? getProvince(provinceId)?.daimyoId ?? '';
}

// 指定大名が現在支配している領地一覧を取得
function getOwnedByDaimyo(daimyoId: string, playerOwned: string[], ownership: Record<string, string>): string[] {
  const result: string[] = [];
  for (const p of PROVINCES) {
    if (playerOwned.includes(p.id)) continue;
    const owner = getProvinceOwner(p.id, ownership);
    if (owner === daimyoId) result.push(p.id);
  }
  return result;
}


// ─── ゲームマップ（viewBox操作によるズーム・パン） ────────
// CSS transform ではなく viewBox を操作することで、
// ズーム時もSVGがベクター再描画され地名が常にシャープになる。

// ─── アニメーション定義 ─────────────────────────────────
const glowRed = keyframes`
  0%,100% { box-shadow: 0 0 6px rgba(192,48,32,0.4); }
  50%      { box-shadow: 0 0 22px rgba(220,60,30,0.9), 0 0 44px rgba(200,40,20,0.35); }
`;

const glowGreen = keyframes`
  0%,100% { box-shadow: 0 0 4px rgba(42,90,58,0.4); }
  50%      { box-shadow: 0 0 14px rgba(58,160,80,0.75), 0 0 28px rgba(42,120,58,0.3); }
`;

const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const popIn = keyframes`
  0%   { transform: scale(0); opacity: 0; }
  65%  { transform: scale(1.12); }
  100% { transform: scale(1); opacity: 1; }
`;

const dotPulse = keyframes`
  0%,100% { transform: scale(1);    opacity: 1; }
  50%      { transform: scale(1.35); opacity: 0.8; }
`;

// ダイアログ用スライドアップトランジション
const SlideUp = forwardRef<unknown, TransitionProps & { children: React.ReactElement }>(
  (props, ref) => <Slide direction="up" ref={ref} {...props} />,
);

const FAB_STYLE = {
  bgcolor: 'rgba(20,40,70,0.88)',
  color: '#88aacc',
  border: '1px solid rgba(80,130,200,0.3)',
  boxShadow: 'none',
  width: 40,
  height: 40,
  minHeight: 40,
  '&:disabled': { bgcolor: 'rgba(15,25,45,0.7)', color: '#2a3a4a', border: '1px solid rgba(40,60,90,0.3)' },
  '&:hover': { bgcolor: 'rgba(30,60,100,0.9)' },
} as const;

const VB_FULL = { x: 0, y: 0, w: 810, h: 930 };
const MAP_AR = 810 / 930; // 地図の縦横比（固定）
const MIN_VB_W = 810 / 5;  // 最大5倍ズーム

type VB = typeof VB_FULL;

function GameMap({
  ownedProvinces,
  daimyoColor,
  attackable,
  selectingTarget,
  onProvinceClick,
  onCancelDispatch,
  showAllProvinces,
  provinceOwnership,
}: {
  ownedProvinces: string[];
  daimyoColor: string;
  attackable: string[];
  selectingTarget: boolean;
  onProvinceClick?: (id: string) => void;
  onCancelDispatch?: () => void;
  showAllProvinces?: boolean;
  provinceOwnership: Record<string, string>;
}) {
  const [vb, setVb] = useState<VB>(VB_FULL);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMovedRef = useRef(false);
  const gestureRef = useRef<{
    startTouches: { x: number; y: number }[];
    startVb: VB;
    display: { left: number; top: number; w: number; h: number };
  } | null>(null);

  // SVG要素内でコンテンツが実際に表示される領域（letterbox考慮）
  const getDisplay = (rect: DOMRect) => {
    const elAR = rect.width / rect.height;
    if (elAR > MAP_AR) {
      const dw = rect.height * MAP_AR;
      return { left: (rect.width - dw) / 2, top: 0, w: dw, h: rect.height };
    }
    const dh = rect.width / MAP_AR;
    return { left: 0, top: (rect.height - dh) / 2, w: rect.width, h: dh };
  };

  // 画面座標（コンテナ相対）→ SVG viewBox座標
  const toSvg = (sx: number, sy: number, d: ReturnType<typeof getDisplay>, v: VB) => ({
    x: v.x + ((sx - d.left) / d.w) * v.w,
    y: v.y + ((sy - d.top) / d.h) * v.h,
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
      if (startVb.w >= 810 * 0.99) return; // 全体表示中はパン無効
      // 画面移動量をSVG座標差に変換し逆方向にviewBox移動
      const svgDx = (dx / display.w) * startVb.w;
      const svgDy = (dy / display.h) * startVb.h;
      setVb(clampVb(startVb.x - svgDx, startVb.y - svgDy, startVb.w, startVb.h));
    } else if (cur.length >= 2 && startTouches.length >= 2) {
      hasMovedRef.current = true;
      const sd = Math.hypot(startTouches[1].x - startTouches[0].x, startTouches[1].y - startTouches[0].y);
      const cd = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
      if (sd === 0) return;
      const scale = cd / sd;
      const newW = Math.max(MIN_VB_W, Math.min(810, startVb.w / scale));
      const newH = newW * (930 / 810);
      // ピンチ中心をSVG座標で固定
      const px = (cur[0].x + cur[1].x) / 2;
      const py = (cur[0].y + cur[1].y) / 2;
      const pinchSvg = toSvg(px, py, display, startVb);
      const relX = (px - display.left) / display.w;
      const relY = (py - display.top) / display.h;
      setVb(clampVb(pinchSvg.x - relX * newW, pinchSvg.y - relY * newH, newW, newH));
    }
  };

  const handleTouchEnd = () => { gestureRef.current = null; };

  const zoomBy = (factor: number) => {
    setVb((prev) => {
      const newW = Math.max(MIN_VB_W, Math.min(810, prev.w / factor));
      if (newW >= 810 * 0.99) return VB_FULL;
      const newH = newW * (930 / 810);
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      return clampVb(cx - newW / 2, cy - newH / 2, newW, newH);
    });
  };

  const resetZoom = () => setVb(VB_FULL);
  const isZoomed = vb.w < 810 * 0.95;

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ width: '100%', height: '100%', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="0" y="0" width="810" height="930" fill="#0a1628" />
        {PROVINCES.map((p) => {
          const isOwned = ownedProvinces.includes(p.id);
          const isAttackable = attackable.includes(p.id);
          const isClickable = (selectingTarget && isAttackable) || (showAllProvinces && onProvinceClick);
          const owner = getProvinceOwner(p.id, provinceOwnership);
          const ownerDaimyo = owner ? getDaimyo(owner) : null;
          const ownerColor = ownerDaimyo?.color ?? '#1e2e1e';
          return (
            <g
              key={p.id}
              onClick={isClickable ? () => { if (!hasMovedRef.current) onProvinceClick?.(p.id); } : undefined}
              style={{ cursor: isClickable ? 'pointer' : 'default' }}
            >
              <polygon
                points={getPolygonPoints(p)}
                fill={
                  isOwned ? daimyoColor
                  : isAttackable && selectingTarget ? '#cc3030'
                  : isAttackable ? '#8b2020'
                  : ownerColor
                }
                fillOpacity={isOwned ? 0.85 : isAttackable && selectingTarget ? 0.75 : isAttackable ? 0.55 : 0.5}
                stroke={
                  isOwned ? '#ffffff55'
                  : isAttackable && selectingTarget ? '#ff4444cc'
                  : isAttackable ? '#ff666688'
                  : '#2a4a2a'
                }
                strokeWidth={isOwned ? 1.2 : isAttackable && selectingTarget ? 2.5 : 0.7}
              >
                {isAttackable && selectingTarget && (
                  <animate attributeName="fill-opacity" values="0.55;0.88;0.55" dur="1.4s" repeatCount="indefinite" />
                )}
                {isAttackable && selectingTarget && (
                  <animate attributeName="stroke-width" values="1.5;3;1.5" dur="1.4s" repeatCount="indefinite" />
                )}
              </polygon>
              <text
                x={p.labelX}
                y={p.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight={isOwned ? 'bold' : 'normal'}
                fill={isOwned ? '#fff' : isAttackable && selectingTarget ? '#ffbbbb' : '#778877'}
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {p.name}
              </text>
            </g>
          );
        })}
        <text x="18" y="22" fontSize="10" fill="rgba(255,255,255,0.2)">北</text>
        <text x="18" y="912" fontSize="10" fill="rgba(255,255,255,0.2)">南</text>
        {selectingTarget && (
          <>
            <rect x="150" y="8" width="510" height="28" rx="6" fill="rgba(180,30,30,0.85)" />
            <text x="405" y="26" textAnchor="middle" dominantBaseline="middle" fontSize="13" fill="#fff" fontWeight="bold">
              ▼ 攻め込む国をタップしてください
            </text>
          </>
        )}
      </svg>

      {/* ズームコントロール */}
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

      {/* キャンセルボタン（出陣選択中） */}
      {selectingTarget && (
        <Button
          onClick={onCancelDispatch}
          sx={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            color: '#ddd',
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid #555',
            fontSize: '0.85rem',
            px: 2.5,
            py: 1,
            zIndex: 10,
          }}
        >
          キャンセル
        </Button>
      )}
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────────────
export default function GameScreen({ save, onReturnToTitle }: Props) {
  const daimyoId = save.daimyoId;
  const daimyo = getDaimyo(daimyoId)!;
  const retainers = getRetainersByDaimyo(daimyoId);

  const [state, setState] = useState<GameState>({
    year: save.year,
    month: save.month,
    soldiers: save.soldiers,
    food: save.food,
    gold: save.gold,
    security: save.security,
    population: save.population,
    ownedProvinces: save.ownedProvinces.length > 0 ? save.ownedProvinces : [daimyo.homeProvinceId],
    recruitedRetainers: save.recruitedRetainers ?? [],
    myPrisoners: save.myPrisoners ?? [],
    retainerExp: save.retainerExp ?? [],
    enemyDaimyoState: save.enemyDaimyoState ?? {},
    provinceOwnership: save.provinceOwnership ?? {},
  });

  const [assignments, setAssignments] = useState<Record<string, number>>(() => {
    const allIds = [
      ...retainers.map((r) => r.id),
      ...(save.recruitedRetainers ?? []).map((r) => r.id),
    ];
    return Object.fromEntries(allIds.map((id) => [id, save.retainerAssignments[id] ?? 0]));
  });

  const [playtime, setPlaytime] = useState(save.playtimeSeconds);
  const [tab, setTab] = useState(0);
  const [log, setLog] = useState<string[]>([`${save.year}年${save.month}月: ${save.playtimeSeconds === 0 ? 'ゲーム開始' : '再開'}`]);
  const [saving, setSaving] = useState(false);
  const [actionsUsed, setActionsUsed] = useState(0);
  const [selectedRetainers, setSelectedRetainers] = useState<Set<string>>(new Set());
  const [selectingTarget, setSelectingTarget] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [selectedRetainerInfo, setSelectedRetainerInfo] = useState<Retainer | null>(null);
  const [battleScreenData, setBattleScreenData] = useState<{ retainers: Retainer[]; targetProvinceId: string } | null>(null);

  // 武将の経験値を取得
  const getRetainerExp = (retainerId: string): number => {
    return state.retainerExp.find((e) => e.retainerId === retainerId)?.exp ?? 0;
  };

  // 武将のランクを取得
  const getRetainerRank = (retainerId: string): RankDefinition => {
    return getRankByExp(getRetainerExp(retainerId));
  };

  const allRetainers = useMemo<Retainer[]>(
    () => [
      ...retainers,
      ...state.recruitedRetainers.map((r) => ({ id: r.id, name: r.name, nameReading: r.nameReading, daimyoId: daimyoId, stats: r.stats })),
    ],
    [retainers, state.recruitedRetainers, daimyoId],
  );

  // 武将数・領地数に応じて内政アクションを動的に生成
  const internalActions = useMemo(
    () => buildInternalActions(allRetainers.length, state.ownedProvinces.length),
    [allRetainers.length, state.ownedProvinces.length],
  );

  const prisonerIds = useMemo(() => new Set(state.myPrisoners.map((p) => p.id)), [state.myPrisoners]);

  const totalAssigned = useMemo(() => Object.values(assignments).reduce((a, b) => a + b, 0), [assignments]);
  const availableSoldiers = state.soldiers - totalAssigned;
  const attackable = useMemo(() => getAttackableProvinces(state.ownedProvinces), [state.ownedProvinces]);

  const selectedTotalSoldiers = useMemo(
    () => Array.from(selectedRetainers).reduce((sum, id) => sum + (assignments[id] ?? 0), 0),
    [selectedRetainers, assignments],
  );
  const canDispatch = selectedRetainers.size > 0 && selectedTotalSoldiers > 0 && attackable.length > 0 && Array.from(selectedRetainers).every(id => !prisonerIds.has(id));

  const addLog = (msg: string, s: GameState = state) =>
    setLog((prev) => [`${s.year}年${s.month}月: ${msg}`, ...prev].slice(0, 25));

  // ── セーブ ──
  const persistSave = async (newState: GameState, newAssignments: Record<string, number>, newPlaytime: number) => {
    setSaving(true);
    save.year = newState.year;
    save.month = newState.month;
    save.soldiers = newState.soldiers;
    save.food = newState.food;
    save.gold = newState.gold;
    save.security = newState.security;
    save.population = newState.population;
    save.ownedProvinces = newState.ownedProvinces;
    save.retainerAssignments = newAssignments;
    save.playtimeSeconds = newPlaytime;
    save.recruitedRetainers = newState.recruitedRetainers;
    save.myPrisoners = newState.myPrisoners;
    save.retainerExp = newState.retainerExp;
    save.enemyDaimyoState = newState.enemyDaimyoState;
    save.provinceOwnership = newState.provinceOwnership;
    await writeSaveSlot(save);
    setSaving(false);
  };

  // ── 内政実行 ──
  const executeAction = (action: InternalAction) => {
    if (actionsUsed >= MAX_ACTIONS || !action.canExecute(state)) return;
    const msg = action.buildLog(state);
    setState((prev) => ({ ...prev, ...action.execute(prev) }));
    setActionsUsed((n) => n + 1);
    addLog(msg);
  };

  // ── ターン終了（セーブ含む） ──
  const endTurn = () => {
    const upkeep = Math.floor(state.soldiers / 20);
    const rawFood = state.food - upkeep;
    const starveDead = rawFood < 0 ? Math.floor(Math.abs(rawFood) / 2) : 0;
    const newMonth = state.month === 12 ? 1 : state.month + 1;
    const newYear = state.month === 12 ? state.year + 1 : state.year;

    const income = calcProvinceIncome(state.ownedProvinces);

    // 捕虜解放チェック（ターン経過 or 敵大名の全領地制圧）
    const newOwnedProvinces = state.ownedProvinces;
    const releasedNames: string[] = [];
    const updatedPrisoners: MyPrisonerData[] = [];
    for (const p of state.myPrisoners) {
      const enemyProvinces = PROVINCES.filter((prov) => prov.daimyoId === p.capturedByDaimyoId);
      const enemyDefeated = enemyProvinces.length > 0 && enemyProvinces.every((prov) => newOwnedProvinces.includes(prov.id));
      const newTurnsLeft = p.turnsLeft - 1;
      if (newTurnsLeft <= 0 || enemyDefeated) {
        releasedNames.push(p.name);
      } else {
        updatedPrisoners.push({ ...p, turnsLeft: newTurnsLeft });
      }
    }

    // ── AI大名の行動 ──
    const newEnemyState: Record<string, EnemyDaimyoState> = { ...state.enemyDaimyoState };
    const newOwnership: Record<string, string> = { ...state.provinceOwnership };
    // プレイヤー領地をownershipに反映
    for (const pid of state.ownedProvinces) {
      newOwnership[pid] = daimyoId;
    }

    // 全ての大名IDを収集（ownershipベース）
    const allOwnerIds = new Set<string>();
    for (const p of PROVINCES) {
      const owner = getProvinceOwner(p.id, newOwnership);
      if (owner && !state.ownedProvinces.includes(p.id)) allOwnerIds.add(owner);
    }

    for (const eDaimyoId of allOwnerIds) {
      const eDaimyoData = getDaimyo(eDaimyoId);
      if (!eDaimyoData) continue;

      // この大名が支配している領地
      const eOwned = getOwnedByDaimyo(eDaimyoId, state.ownedProvinces, newOwnership);
      if (eOwned.length === 0) {
        // 滅亡済み：蓄積データ削除
        delete newEnemyState[eDaimyoId];
        continue;
      }

      // 地域収入
      const eIncome = calcProvinceIncome(eOwned);
      const prev = newEnemyState[eDaimyoId] ?? { soldiers: 0, food: 0, gold: 0 };
      const eUpkeep = Math.floor(prev.soldiers / 20);
      const eRawFood = prev.food - eUpkeep;
      const eStarve = eRawFood < 0 ? Math.floor(Math.abs(eRawFood) / 2) : 0;
      let eSoldiers = Math.max(0, prev.soldiers - eStarve + eIncome.soldiers);
      let eFood = Math.max(0, eRawFood + eIncome.food);
      let eGold = prev.gold + eIncome.gold;

      // 内政：徴兵（金がある場合）
      if (eGold >= 200) {
        const recruitCount = Math.floor(250 + (eDaimyoData.stats.military / 100) * 100);
        eSoldiers += recruitCount;
        eGold -= 200;
      }

      // 戦：軍事力が高いほど戦を仕掛ける確率UP
      const warChance = Math.min(0.6, eDaimyoData.stats.military / 200);
      if (Math.random() < warChance && eSoldiers > 300) {
        // 隣接する他大名の領地を探す
        const adjacentEnemies: { provId: string; ownerId: string }[] = [];
        for (const pid of eOwned) {
          const prov = getProvince(pid);
          if (!prov) continue;
          for (const adjId of prov.adjacent) {
            if (state.ownedProvinces.includes(adjId) || eOwned.includes(adjId)) continue;
            const adjOwner = getProvinceOwner(adjId, newOwnership);
            if (adjOwner && adjOwner !== eDaimyoId) {
              adjacentEnemies.push({ provId: adjId, ownerId: adjOwner });
            }
          }
        }

        if (adjacentEnemies.length > 0) {
          const target = adjacentEnemies[Math.floor(Math.random() * adjacentEnemies.length)];
          const targetProv = getProvince(target.provId)!;
          const targetDaimyo = getDaimyo(target.ownerId);
          const targetES = newEnemyState[target.ownerId] ?? { soldiers: 0, food: 0, gold: 0 };

          // 戦闘判定
          const atkPower = eSoldiers * (eDaimyoData.stats.military / 100) * (0.75 + Math.random() * 0.5);
          const defPower = (targetES.soldiers || 400) * ((targetDaimyo?.stats.military ?? 50) / 100) * (0.6 + Math.random() * 0.5);
          const attackerWon = atkPower > defPower;

          if (attackerWon) {
            const atkCas = Math.floor(eSoldiers * (0.1 + Math.random() * 0.15));
            eSoldiers -= atkCas;
            // 領地奪取
            newOwnership[target.provId] = eDaimyoId;
            addLog(`【戦】${eDaimyoData.name}が${targetProv.name}を攻略！`, { ...state, year: newYear, month: newMonth });
            // 防御側の兵力も減少
            if (newEnemyState[target.ownerId]) {
              const defCas = Math.floor((targetES.soldiers || 400) * (0.25 + Math.random() * 0.25));
              newEnemyState[target.ownerId] = { ...newEnemyState[target.ownerId], soldiers: Math.max(0, targetES.soldiers - defCas) };
            }
          } else {
            const atkCas = Math.floor(eSoldiers * (0.25 + Math.random() * 0.25));
            eSoldiers -= atkCas;
            addLog(`【戦】${eDaimyoData.name}が${targetProv.name}を攻めるも敗北`, { ...state, year: newYear, month: newMonth });
          }
        }
      }

      newEnemyState[eDaimyoId] = { soldiers: Math.max(0, eSoldiers), food: eFood, gold: eGold };
    }

    const newState: GameState = {
      ...state,
      year: newYear,
      month: newMonth,
      food: Math.max(0, rawFood + income.food),
      soldiers: Math.max(0, state.soldiers - starveDead + income.soldiers),
      gold: state.gold + income.gold,
      security: Math.min(100, state.security + 1),
      myPrisoners: updatedPrisoners,
      enemyDaimyoState: newEnemyState,
      provinceOwnership: newOwnership,
    };
    const newPlaytime = playtime + 600;

    setState(newState);
    setPlaytime(newPlaytime);
    setActionsUsed(0);
    setTab(0); // 地図タブに切り替え

    const starvMsg = starveDead > 0 ? `、餓死 -${starveDead}兵` : '';
    const incomeMsg = `地域収入: 志願兵+${income.soldiers}、兵糧+${income.food}、金+${income.gold}`;
    addLog(`月が改まった（兵糧消費 -${upkeep}${starvMsg}）　${incomeMsg}`, newState);
    if (releasedNames.length > 0) {
      addLog(`【釈放】${releasedNames.join('・')}が帰還した`, newState);
    }

    persistSave(newState, assignments, newPlaytime);
  };

  // ── 兵士割当変更 ──
  const changeAssignment = (retainerId: string, delta: number) => {
    setAssignments((prev) => {
      const current = prev[retainerId] ?? 0;
      const otherTotal = Object.entries(prev).filter(([k]) => k !== retainerId).reduce((a, [, v]) => a + v, 0);
      const rank = getRetainerRank(retainerId);
      const maxByRank = rank.maxSoldiers;
      const maxByAvailable = state.soldiers - otherTotal;
      const capped = Math.min(Math.max(0, current + delta), maxByRank, maxByAvailable);
      return { ...prev, [retainerId]: capped };
    });
  };

  // ── 武将チェック切替 ──
  const toggleRetainer = (id: string) => {
    setSelectedRetainers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── 出陣ボタン → マップ選択モードへ ──
  const startDispatch = () => {
    if (!canDispatch) return;
    setSelectingTarget(true);
    setTab(0);
  };

  const cancelDispatch = () => {
    setSelectingTarget(false);
  };

  // ── マップ上で国をタップ → 戦闘画面 ──
  const handleProvinceClick = (provinceId: string) => {
    if (!selectingTarget) return;
    const selectedList = allRetainers.filter((r) => selectedRetainers.has(r.id));
    setBattleScreenData({ retainers: selectedList, targetProvinceId: provinceId });
    setSelectingTarget(false);
  };

  // ── 戦闘画面からの結果処理 ──
  const handleBattleFinish = (outcome: BattleOutcome) => {
    const target = getProvince(battleScreenData!.targetProvinceId)!;
    const names = battleScreenData!.retainers.map((r) => r.name).join('・');

    // 兵士数更新
    const totalPlayerCasualties = outcome.playerCasualties;
    const newAssignments = { ...outcome.updatedAssignments };

    let newState: GameState = {
      ...state,
      soldiers: Math.max(0, state.soldiers - totalPlayerCasualties),
      ownedProvinces: outcome.won && outcome.gainedProvinceId ? [...state.ownedProvinces, outcome.gainedProvinceId] : state.ownedProvinces,
      provinceOwnership: outcome.won && outcome.gainedProvinceId ? { ...state.provinceOwnership, [outcome.gainedProvinceId]: daimyoId } : state.provinceOwnership,
    };

    // 経験値付与
    if (outcome.expGain > 0) {
      const updatedExp = [...state.retainerExp];
      for (const r of battleScreenData!.retainers) {
        const idx = updatedExp.findIndex((e) => e.retainerId === r.id);
        if (idx >= 0) {
          updatedExp[idx] = { ...updatedExp[idx], exp: updatedExp[idx].exp + outcome.expGain };
        } else {
          updatedExp.push({ retainerId: r.id, exp: outcome.expGain });
        }
      }
      newState = { ...newState, retainerExp: updatedExp };
    }

    // 登用武将の追加
    const recruited = outcome.capturedRetainers.filter(c => c.decision === 'recruit');
    if (recruited.length > 0) {
      const newRecruited: RecruitedRetainerData[] = recruited.map(c => ({
        id: c.retainer.id, name: c.retainer.name, nameReading: c.retainer.nameReading,
        originalDaimyoId: c.retainer.daimyoId, stats: c.retainer.stats,
      }));
      const addedAssignments = Object.fromEntries(recruited.map(c => [c.retainer.id, 0]));
      newState = { ...newState, recruitedRetainers: [...newState.recruitedRetainers, ...newRecruited] };
      Object.assign(newAssignments, addedAssignments);
    }

    // ログ
    if (outcome.won) {
      addLog(`[${names}] 【勝利】${target.name}を攻略！損害 ${totalPlayerCasualties} 兵`, newState);
      if (recruited.length > 0) addLog(`登用: ${recruited.map(c => c.retainer.name).join('・')}`, newState);
      const executed = outcome.capturedRetainers.filter(c => c.decision === 'execute');
      if (executed.length > 0) addLog(`処断: ${executed.map(c => c.retainer.name).join('・')}`, newState);
      const released = outcome.capturedRetainers.filter(c => c.decision === 'release');
      if (released.length > 0) addLog(`釈放: ${released.map(c => c.retainer.name).join('・')}`, newState);
      // 大名滅亡チェック（provinceOwnership更新前の元の支配者を使用）
      const eDaimyoId = state.provinceOwnership[target.id] ?? target.daimyoId;
      const eProvs = PROVINCES.filter(p => getProvinceOwner(p.id, state.provinceOwnership) === eDaimyoId);
      if (eProvs.length > 0 && eProvs.every(p => newState.ownedProvinces.includes(p.id))) {
        addLog(`【滅亡】${getDaimyo(eDaimyoId)?.name ?? eDaimyoId}は滅亡した！`, newState);
        // 滅亡した大名の蓄積データを削除
        const updatedEnemyState = { ...newState.enemyDaimyoState };
        delete updatedEnemyState[eDaimyoId];
        newState = { ...newState, enemyDaimyoState: updatedEnemyState };
      } else {
        // 滅亡していない場合、敵の蓄積兵力を戦闘損害分だけ減らす
        const ePrev = newState.enemyDaimyoState[eDaimyoId];
        if (ePrev) {
          const updatedEnemyState = { ...newState.enemyDaimyoState };
          updatedEnemyState[eDaimyoId] = { ...ePrev, soldiers: Math.max(0, ePrev.soldiers - outcome.enemyCasualties) };
          newState = { ...newState, enemyDaimyoState: updatedEnemyState };
        }
      }
    } else {
      addLog(`[${names}] 【敗北】${target.name}の攻略に失敗。損害 ${totalPlayerCasualties} 兵`, newState);
    }

    setState(newState);
    setAssignments(newAssignments);
    setSelectedRetainers(new Set());
    setBattleScreenData(null);
    persistSave(newState, newAssignments, playtime);
  };


  const handleProvinceInfoClick = (provinceId: string) => {
    const province = getProvince(provinceId);
    if (province) {
      setSelectedProvince(province);
    }
  };

  // ─── レンダリング ──────────────────────────────────────
  return (
    <Box sx={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#070d1a' }}>

      {/* ヘッダー */}
      <Box sx={{
        px: 1.5,
        py: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        background: 'rgba(0,0,0,0.65)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexShrink: 0,
        minHeight: 50,
      }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: daimyo.color, boxShadow: `0 0 6px ${daimyo.color}`, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#e8d5a3', fontWeight: 'bold', fontSize: '0.9rem', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {daimyo.name}
          </Typography>
          <Typography sx={{ color: '#556677', fontSize: '0.65rem', lineHeight: 1.2 }}>
            {state.year}年{state.month}月
          </Typography>
        </Box>

        {/* 残りアクション数 */}
        <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center', flexShrink: 0 }}>
          {Array.from({ length: MAX_ACTIONS }).map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 9,
                height: 9,
                borderRadius: 1,
                bgcolor: i < actionsUsed ? 'rgba(60,60,80,0.6)' : '#4a8abc',
                border: `1px solid ${i < actionsUsed ? '#334' : '#6aacdc'}`,
                transition: 'all 0.3s ease',
                animation: i >= actionsUsed ? `${dotPulse} ${1.8 + i * 0.3}s ease infinite` : 'none',
              }}
            />
          ))}
        </Box>

        {saving && <SaveIcon sx={{ fontSize: '0.95rem', color: '#55aa77', flexShrink: 0 }} />}

        <IconButton size="small" onClick={onReturnToTitle} sx={{ color: '#556677', p: 0.5, flexShrink: 0 }}>
          <HomeIcon sx={{ fontSize: '1.15rem' }} />
        </IconButton>

        <Button
          variant="contained"
          size="small"
          onClick={endTurn}
          sx={{
            background: 'linear-gradient(135deg, #2a5a3a, #3a8a4a)',
            fontWeight: 'bold',
            fontSize: '0.75rem',
            px: 1.2,
            py: 0.7,
            minWidth: 0,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            animation: `${glowGreen} 2.4s ease infinite`,
            transition: 'transform 0.12s ease',
            '&:active': { transform: 'scale(0.93)' },
          }}
        >
          ターン終了
        </Button>
      </Box>

      {/* リソースバー */}
      <Box sx={{
        display: 'flex',
        overflowX: 'auto',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.45)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {[
          { label: '兵士', value: state.soldiers.toLocaleString(), color: '#e87050' },
          { label: '兵糧', value: state.food.toLocaleString(), color: '#70c870' },
          { label: '金', value: state.gold.toLocaleString(), color: '#e8c050' },
          { label: '治安', value: `${state.security}%`, color: '#5090e8' },
          { label: '人口', value: state.population.toLocaleString(), color: '#a070d0' },
          { label: '領地', value: `${state.ownedProvinces.length}国`, color: '#88cccc' },
        ].map(({ label, value, color }) => (
          <Box
            key={label}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              px: 1.5,
              py: 0.5,
              minWidth: 58,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <Typography sx={{ fontSize: '0.55rem', color: '#556677', letterSpacing: '0.03em' }}>{label}</Typography>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 'bold', color, lineHeight: 1.3 }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {/* メインコンテンツ */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>

        {/* 地図タブ */}
        {tab === 0 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              border: selectingTarget ? '2px solid rgba(200,50,50,0.5)' : '1px solid rgba(255,255,255,0.04)',
              transition: 'border-color 0.2s',
            }}>
              <GameMap
                ownedProvinces={state.ownedProvinces}
                daimyoColor={daimyo.color}
                attackable={attackable.map((p) => p.id)}
                selectingTarget={selectingTarget}
                onProvinceClick={selectingTarget ? handleProvinceClick : handleProvinceInfoClick}
                onCancelDispatch={cancelDispatch}
                showAllProvinces
                provinceOwnership={state.provinceOwnership}
              />
            </Box>

            {/* ログ */}
            <Box sx={{
              height: 74,
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.55)',
              px: 1.5,
              py: 0.5,
              flexShrink: 0,
              borderTop: '1px solid rgba(255,255,255,0.06)',
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
            }}>
              {log.map((entry, i) => (
                <Typography
                  key={entry}
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: i === 0 ? '#cce0f5' : '#445566',
                    fontSize: '0.7rem',
                    lineHeight: 1.7,
                    animation: i === 0 ? `${fadeSlideIn} 0.35s ease` : 'none',
                  }}
                >
                  {entry}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* 内政タブ */}
        {tab === 1 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#667788', letterSpacing: '0.1em', fontSize: '0.85rem' }}>内政コマンド</Typography>
                <Typography variant="caption" sx={{ color: actionsUsed >= MAX_ACTIONS ? '#ff6644' : '#4a8abc', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {actionsUsed >= MAX_ACTIONS ? '今ターン行動終了' : `あと ${MAX_ACTIONS - actionsUsed} 回`}
                </Typography>
              </Box>

              {internalActions.map((action) => {
                const canDo = actionsUsed < MAX_ACTIONS && action.canExecute(state);
                return (
                  <Card
                    key={action.id}
                    sx={{
                      mb: 1.5,
                      background: canDo ? `${action.color}18` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${canDo ? action.color + '44' : 'rgba(255,255,255,0.05)'}`,
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      '&:active': canDo ? { transform: 'scale(0.975)', boxShadow: `0 0 14px ${action.color}55` } : {},
                    }}
                  >
                    <CardContent sx={{ p: '16px 18px !important' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontSize: '1.4rem', transition: 'transform 0.2s', '.MuiCard-root:active &': canDo ? { transform: 'scale(1.15) rotate(-8deg)' } : {} }}>{action.icon}</Typography>
                        <Typography sx={{ fontWeight: 'bold', color: canDo ? '#ddeeff' : '#445566', fontSize: '1.05rem' }}>{action.name}</Typography>
                        <Box sx={{ flex: 1 }} />
                        <Chip label={action.costLabel} size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: 'rgba(255,100,100,0.12)', color: '#ff9999' }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.82rem', color: '#8899aa', mb: 1, lineHeight: 1.6 }}>{action.description}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.78rem', color: '#55aa77', flex: 1 }}>効果: {action.effectLabel}</Typography>
                        <Button
                          variant="contained"
                          disabled={!canDo}
                          onClick={() => executeAction(action)}
                          sx={{
                            fontSize: '0.85rem',
                            px: 2.8,
                            py: 0.9,
                            minWidth: 0,
                            background: canDo ? action.color : undefined,
                            transition: 'transform 0.12s ease, background 0.2s ease',
                            '&:hover': { background: canDo ? action.color + 'cc' : undefined },
                            '&:active': { transform: 'scale(0.90)' },
                            '&.Mui-disabled': { opacity: 0.3 },
                          }}
                        >
                          実行
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Box>
        )}

        {/* 家臣タブ */}
        {tab === 2 && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#667788' }}>武将を選択して出陣</Typography>
                <Typography variant="caption" sx={{ color: availableSoldiers < 0 ? '#ff4444' : '#55aa77' }}>
                  待機: {availableSoldiers.toLocaleString()} / {state.soldiers.toLocaleString()}
                </Typography>
              </Box>

              {/* 捕虜中の武将セクション */}
              {state.myPrisoners.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ color: '#cc6644', fontSize: '0.75rem', mb: 0.8, letterSpacing: '0.05em' }}>◆ 捕虜中の武将</Typography>
                  {state.myPrisoners.map((p, i) => (
                    <Card key={p.id} sx={{ mb: 1, background: 'rgba(100,30,10,0.18)', border: '1px solid rgba(180,60,20,0.3)', animation: `${popIn} 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.07}s both` }}>
                      <CardContent sx={{ p: '10px 14px !important' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ color: '#cc8866', fontSize: '0.9rem', fontWeight: 'bold' }}>{p.name}</Typography>
                            <Typography sx={{ color: '#667788', fontSize: '0.65rem' }}>{p.nameReading}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                            <Chip label={`統${p.stats.command}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#c04020aa', color: '#ffaa88' }} />
                            <Chip label={`知${p.stats.intelligence}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#1040b0aa', color: '#88aaff' }} />
                            <Chip label={`忠${p.stats.loyalty}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#107040aa', color: '#88dd88' }} />
                          </Box>
                          <Chip label={`残${p.turnsLeft}T`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: 'rgba(150,50,20,0.5)', color: '#ffaa77' }} />
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}

              {allRetainers.map((r, idx) => {
                const assigned = assignments[r.id] ?? 0;
                const isSelected = selectedRetainers.has(r.id);
                const isPrisoner = prisonerIds.has(r.id);
                const isRecruited = state.recruitedRetainers.some((rec) => rec.id === r.id);
                const rank = getRetainerRank(r.id);
                const atMaxForRank = assigned >= rank.maxSoldiers;
                return (
                  <Card
                    key={r.id}
                    sx={{
                      mb: 1.5,
                      background: isPrisoner ? 'rgba(80,20,10,0.2)' : isSelected ? 'rgba(180,50,20,0.15)' : isRecruited ? 'rgba(20,80,60,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isPrisoner ? 'rgba(120,40,20,0.4)' : isSelected ? 'rgba(200,80,40,0.5)' : isRecruited ? 'rgba(40,150,100,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                      transform: isSelected ? 'scale(1.015)' : 'scale(1)',
                      animation: `${fadeSlideIn} 0.3s ease ${idx * 0.04}s both`,
                    }}
                  >
                    <CardContent sx={{ p: '12px 14px !important' }}>
                      {/* 武将情報 */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: isPrisoner ? 0 : 1 }}>
                        {!isPrisoner && (
                          <Checkbox
                            checked={isSelected}
                            disabled={assigned === 0}
                            onChange={() => toggleRetainer(r.id)}
                            sx={{ p: 0.5, color: '#556677', '&.Mui-checked': { color: '#ff8866' } }}
                          />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <Typography sx={{ color: isPrisoner ? '#886655' : '#cce0f5', fontSize: '0.95rem', fontWeight: 'bold' }}>{r.name}</Typography>
                            <Chip label={rank.name} size="small" sx={{ fontSize: '0.55rem', height: 16, bgcolor: 'rgba(180,140,60,0.5)', color: '#ffd080' }} />
                            {isRecruited && <Chip label="捕縛" size="small" sx={{ fontSize: '0.58rem', height: 18, bgcolor: 'rgba(20,100,70,0.6)', color: '#88ddbb' }} />}
                            <IconButton
                              size="small"
                              onClick={() => setSelectedRetainerInfo(r)}
                              sx={{ p: 0.3, color: '#7799bb', '&:hover': { color: '#aaccee' } }}
                            >
                              <InfoIcon sx={{ fontSize: '0.9rem' }} />
                            </IconButton>
                          </Box>
                          <Typography sx={{ color: '#667788', fontSize: '0.68rem' }}>{r.nameReading}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          <Chip label={`統${r.stats.command}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#c04020aa', color: '#ffaa88' }} />
                          <Chip label={`知${r.stats.intelligence}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#1040b0aa', color: '#88aaff' }} />
                          <Chip label={`忠${r.stats.loyalty}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#107040aa', color: '#88dd88' }} />
                        </Box>
                      </Box>

                      {/* 兵士割当（捕虜中は非表示） */}
                      {!isPrisoner && (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '0.7rem', color: '#556677', flexShrink: 0, mr: 0.5 }}>割当:</Typography>
                            <IconButton onClick={() => changeAssignment(r.id, -100)} sx={{ p: 0.75, color: '#cc6644' }}>
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Button
                              onClick={() => changeAssignment(r.id, -50)}
                              sx={{ minWidth: 44, minHeight: 40, color: '#aa5533', fontSize: '0.72rem', p: 0 }}
                            >
                              -50
                            </Button>
                            <Box sx={{ flex: 1, textAlign: 'center' }}>
                              <Typography sx={{ color: assigned > 0 ? '#e8c050' : '#445566', fontWeight: 'bold', fontSize: '1rem' }}>
                                {assigned.toLocaleString()}
                              </Typography>
                              <Typography sx={{ fontSize: '0.55rem', color: atMaxForRank ? '#ff9944' : '#556677' }}>
                                上限: {rank.maxSoldiers.toLocaleString()}
                              </Typography>
                            </Box>
                            <Button
                              onClick={() => changeAssignment(r.id, 50)}
                              disabled={availableSoldiers <= 0 || atMaxForRank}
                              sx={{ minWidth: 44, minHeight: 40, color: '#44aa66', fontSize: '0.72rem', p: 0 }}
                            >
                              +50
                            </Button>
                            <IconButton onClick={() => changeAssignment(r.id, 100)} disabled={availableSoldiers <= 0 || atMaxForRank} sx={{ p: 0.75, color: '#55bb77' }}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          {assigned > 0 ? (
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, (assigned / rank.maxSoldiers) * 100)}
                              sx={{ height: 4, borderRadius: 2, mt: 0.75, bgcolor: '#1a2a1a', '& .MuiLinearProgress-bar': { bgcolor: atMaxForRank ? '#ff6644' : isSelected ? '#ff8844' : '#e8c050' } }}
                            />
                          ) : (
                            <Typography sx={{ fontSize: '0.66rem', color: '#445566', mt: 0.3 }}>
                              ※ 兵士を割り当てると選択できます
                            </Typography>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>

            {/* 出陣ボタン（下部固定） */}
            <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}>
              {selectedRetainers.size > 0 && (
                <Typography variant="caption" sx={{ display: 'block', color: '#ff9966', mb: 1, textAlign: 'center', fontSize: '0.78rem' }}>
                  {Array.from(selectedRetainers).map((id) => allRetainers.find((r) => r.id === id)?.name).join('・')}
                  　計 {selectedTotalSoldiers.toLocaleString()} 兵
                </Typography>
              )}
              <Button
                fullWidth
                variant="contained"
                disabled={!canDispatch}
                startIcon={<GavelIcon />}
                onClick={startDispatch}
                sx={{
                  background: canDispatch ? 'linear-gradient(135deg, #8b1a0a, #c03020)' : undefined,
                  fontWeight: 'bold',
                  fontSize: '0.95rem',
                  py: 1.2,
                  animation: canDispatch ? `${glowRed} 2s ease infinite` : 'none',
                  transition: 'transform 0.12s ease',
                  '&:active': { transform: 'scale(0.95)' },
                  '&.Mui-disabled': { opacity: 0.35 },
                }}
              >
                出陣
              </Button>
              {!canDispatch && (
                <Typography variant="caption" sx={{ display: 'block', color: '#556677', textAlign: 'center', mt: 0.5, fontSize: '0.7rem' }}>
                  {selectedRetainers.size === 0
                    ? '武将にチェックを入れてください'
                    : selectedTotalSoldiers === 0
                    ? '兵士を割り当てた武将を選択してください'
                    : '攻略可能な隣接領地がありません'}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* ボトムナビゲーション */}
      <BottomNavigation
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          flexShrink: 0,
          background: 'rgba(5,10,20,0.95)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          '& .MuiBottomNavigationAction-root': { color: '#445566', minWidth: 0, py: 0.5, transition: 'color 0.2s ease' },
          '& .Mui-selected': { color: '#e8d5a3 !important' },
          '& .Mui-selected svg': { animation: `${popIn} 0.35s cubic-bezier(0.34,1.56,0.64,1)` },
          '& .Mui-selected .MuiBottomNavigationAction-label': { animation: `${fadeSlideIn} 0.3s ease` },
          '& .MuiBottomNavigationAction-label': { fontSize: '0.68rem !important' },
        }}
      >
        <BottomNavigationAction label="地図" icon={<MapIcon sx={{ fontSize: '1.3rem' }} />} />
        <BottomNavigationAction label="内政" icon={<BuildIcon sx={{ fontSize: '1.3rem' }} />} />
        <BottomNavigationAction label="家臣" icon={<GroupIcon sx={{ fontSize: '1.3rem' }} />} />
      </BottomNavigation>

      {/* 戦闘画面 */}
      {battleScreenData && (
        <BattleScreen
          playerDaimyoId={daimyoId}
          playerRetainers={battleScreenData.retainers}
          playerAssignments={assignments}
          targetProvinceId={battleScreenData.targetProvinceId}
          playerOwnedProvinces={state.ownedProvinces}
          recruitedRetainers={state.recruitedRetainers}
          retainerExp={state.retainerExp}
          enemyDaimyoState={state.enemyDaimyoState}
          provinceOwnership={state.provinceOwnership}
          onFinish={handleBattleFinish}
        />
      )}

      {/* 地域情報ダイアログ */}
      <Dialog
        open={selectedProvince !== null}
        onClose={() => setSelectedProvince(null)}
        maxWidth="xs"
        fullWidth
        slots={{ transition: SlideUp }}
        slotProps={{
          paper: { sx: { background: 'linear-gradient(160deg,#0d1a2e 0%,#0a1220 100%)', border: '1px solid #334466', mx: 2, borderRadius: 2, boxShadow: '0 24px 60px rgba(0,0,10,0.7)' } },
          backdrop: { sx: { backdropFilter: 'blur(4px)', background: 'rgba(0,0,8,0.65)' } },
        }}
      >
        <DialogTitle sx={{ color: '#e8d5a3', pb: 1, fontSize: '1rem' }}>
          {selectedProvince?.name}
        </DialogTitle>
        <DialogContent>
          {selectedProvince && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: getDaimyo(getProvinceOwner(selectedProvince.id, state.provinceOwnership))?.color, flexShrink: 0 }} />
                <Typography sx={{ color: '#8899aa', fontSize: '0.8rem' }}>
                  所属大名: {getDaimyo(getProvinceOwner(selectedProvince.id, state.provinceOwnership))?.name || '中立'}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#8899aa', mb: 0.5 }}>地域情報</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#cce0f5', mb: 0.5 }}>
                  地方: {selectedProvince.region}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#8899aa' }}>生産兵力</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#e87050', fontWeight: 'bold' }}>
                    {selectedProvince.productionMilitary}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#8899aa' }}>生産兵糧</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#70c870', fontWeight: 'bold' }}>
                    {selectedProvince.productionFood}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#8899aa' }}>生産金</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: '#e8c050', fontWeight: 'bold' }}>
                    {selectedProvince.productionGold}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#8899aa', mb: 0.5 }}>隣接地域</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selectedProvince.adjacent.map((adj) => {
                    const adjProvince = getProvince(adj);
                    return (
                      <Chip
                        key={adj}
                        label={adjProvince?.name || adj}
                        size="small"
                        sx={{ fontSize: '0.7rem', height: 20, bgcolor: 'rgba(255,255,255,0.08)', color: '#8899aa' }}
                      />
                    );
                  })}
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setSelectedProvince(null)} variant="contained" sx={{ background: '#4a8abc', fontSize: '0.8rem' }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>

      {/* 武将情報モーダル */}
      <Dialog
        open={selectedRetainerInfo !== null}
        onClose={() => setSelectedRetainerInfo(null)}
        maxWidth="xs"
        fullWidth
        slots={{ transition: SlideUp }}
        slotProps={{
          paper: { sx: { background: 'linear-gradient(160deg,#0d1a2e 0%,#0a1220 100%)', border: '1px solid #334466', mx: 2, borderRadius: 2, boxShadow: '0 24px 60px rgba(0,0,10,0.7)' } },
          backdrop: { sx: { backdropFilter: 'blur(4px)', background: 'rgba(0,0,8,0.65)' } },
        }}
      >
        <DialogTitle sx={{ color: '#e8d5a3', pb: 1, fontSize: '1rem' }}>
          武将情報
        </DialogTitle>
        <DialogContent>
          {selectedRetainerInfo && (() => {
            const retainer = selectedRetainerInfo;
            const exp = getRetainerExp(retainer.id);
            const rank = getRankByExp(exp);
            const nextRank = getNextRank(rank);
            const expToNext = nextRank ? nextRank.requiredExp - exp : 0;
            const progressToNext = nextRank ? ((exp - rank.requiredExp) / (nextRank.requiredExp - rank.requiredExp)) * 100 : 100;

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* 名前と読み */}
                <Box sx={{ textAlign: 'center', py: 1 }}>
                  <Typography sx={{ color: '#cce0f5', fontSize: '1.4rem', fontWeight: 'bold' }}>{retainer.name}</Typography>
                  <Typography sx={{ color: '#667788', fontSize: '0.8rem' }}>{retainer.nameReading}</Typography>
                </Box>

                {/* ランク情報 */}
                <Box sx={{ p: 1.5, background: 'rgba(180,140,60,0.15)', borderRadius: 1, border: '1px solid rgba(180,140,60,0.3)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#8899aa' }}>現在の階級</Typography>
                    <Chip label={rank.name} sx={{ fontSize: '0.85rem', height: 26, bgcolor: 'rgba(180,140,60,0.5)', color: '#ffd080', fontWeight: 'bold' }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#667788' }}>指揮可能兵数</Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#e8c050', fontWeight: 'bold' }}>{rank.maxSoldiers.toLocaleString()} 人</Typography>
                  </Box>
                </Box>

                {/* 経験値情報 */}
                <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#8899aa' }}>経験値</Typography>
                    <Typography sx={{ fontSize: '0.85rem', color: '#88ccff', fontWeight: 'bold' }}>{exp.toLocaleString()}</Typography>
                  </Box>
                  {nextRank ? (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.7rem', color: '#667788' }}>次の階級</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#aabbcc' }}>{nextRank.name}（残り {expToNext.toLocaleString()}）</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progressToNext}
                        sx={{ height: 6, borderRadius: 3, bgcolor: '#1a2a3a', '& .MuiLinearProgress-bar': { bgcolor: '#4a9acc' } }}
                      />
                    </>
                  ) : (
                    <Typography sx={{ fontSize: '0.75rem', color: '#55aa77', textAlign: 'center' }}>最高階級に到達</Typography>
                  )}
                </Box>

                {/* ステータス */}
                <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#8899aa', mb: 1 }}>能力値</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.8rem', color: '#8899aa' }}>統率</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={retainer.stats.command} sx={{ width: 100, height: 6, borderRadius: 3, bgcolor: '#2a1a1a', '& .MuiLinearProgress-bar': { bgcolor: '#c04020' } }} />
                        <Typography sx={{ fontSize: '0.85rem', color: '#ffaa88', fontWeight: 'bold', minWidth: 28, textAlign: 'right' }}>{retainer.stats.command}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.8rem', color: '#8899aa' }}>知略</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={retainer.stats.intelligence} sx={{ width: 100, height: 6, borderRadius: 3, bgcolor: '#1a1a2a', '& .MuiLinearProgress-bar': { bgcolor: '#1040b0' } }} />
                        <Typography sx={{ fontSize: '0.85rem', color: '#88aaff', fontWeight: 'bold', minWidth: 28, textAlign: 'right' }}>{retainer.stats.intelligence}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.8rem', color: '#8899aa' }}>忠誠</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={retainer.stats.loyalty} sx={{ width: 100, height: 6, borderRadius: 3, bgcolor: '#1a2a1a', '& .MuiLinearProgress-bar': { bgcolor: '#107040' } }} />
                        <Typography sx={{ fontSize: '0.85rem', color: '#88dd88', fontWeight: 'bold', minWidth: 28, textAlign: 'right' }}>{retainer.stats.loyalty}</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>

                {/* 階級一覧 */}
                <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#8899aa', mb: 1 }}>階級一覧</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {RANKS.map((r) => (
                      <Chip
                        key={r.id}
                        label={`${r.name}(${r.maxSoldiers >= 10000 ? `${r.maxSoldiers / 10000}万` : r.maxSoldiers})`}
                        size="small"
                        sx={{
                          fontSize: '0.6rem',
                          height: 20,
                          bgcolor: r.id === rank.id ? 'rgba(180,140,60,0.5)' : 'rgba(255,255,255,0.08)',
                          color: r.id === rank.id ? '#ffd080' : '#667788',
                          border: r.id === rank.id ? '1px solid rgba(180,140,60,0.5)' : 'none',
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setSelectedRetainerInfo(null)} variant="contained" sx={{ background: '#4a8abc', fontSize: '0.8rem' }}>
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
