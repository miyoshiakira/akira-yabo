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
import { getRetainersByDaimyo } from '../data/retainerData';
import type { Retainer, RecruitedRetainerData, MyPrisonerData } from '../data/retainerData';
import type { SaveData } from '../lib/saveData';
import { writeSaveSlot } from '../lib/saveDataDB';

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
}

type BattlePhase = 'confirm' | 'result' | 'capture' | 'prisoner';

interface BattleDialog {
  open: boolean;
  phase: BattlePhase;
  retainers: Retainer[];
  targetProvinceId: string;
  result: BattleResult | null;
  autoRecruited: Retainer[];
  pendingCapture: Retainer[];
  captureDecisions: Record<string, 'release' | 'execute'>;
  newMyPrisoners: Retainer[];
}

interface BattleResult {
  won: boolean;
  message: string;
  casualties: number;
  gained?: string;
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

const INTERNAL_ACTIONS: InternalAction[] = [
  {
    id: 'conscription',
    name: '徴兵',
    icon: '⚔',
    costLabel: '金 −200',
    effectLabel: '兵士 +250〜350',
    color: '#b03010',
    description: '金を使って兵士を募集する。治安が高いほど多く集まる。',
    canExecute: (s) => s.gold >= 200,
    execute: (s) => ({ gold: s.gold - 200, soldiers: s.soldiers + Math.floor(250 + (s.security / 100) * 100) }),
    buildLog: (s) => `徴兵 → 兵士+${Math.floor(250 + (s.security / 100) * 100)}、金-200`,
  },
  {
    id: 'taxcollection',
    name: '徴収',
    icon: '💰',
    costLabel: '治安 −15',
    effectLabel: '金 +400〜900、兵糧 +200',
    color: '#b07010',
    description: '強制的に年貢を取り立てる。治安が低下するが収入が増える。',
    canExecute: (_s) => true,
    execute: (s) => {
      const g = Math.floor(400 + (s.population / 30) * (s.security / 100));
      return { gold: s.gold + g, food: s.food + 200, security: Math.max(0, s.security - 15) };
    },
    buildLog: (s) => `徴収 → 金+${Math.floor(400 + (s.population / 30) * (s.security / 100))}、兵糧+200、治安-15`,
  },
  {
    id: 'population',
    name: '人口増加',
    icon: '🌾',
    costLabel: '兵糧 −200',
    effectLabel: '人口 +500〜1000',
    color: '#207820',
    description: '兵糧を農業に投資して人口を増やす。人口が多いほど徴収額が上がる。',
    canExecute: (s) => s.food >= 200,
    execute: (s) => ({ food: s.food - 200, population: s.population + Math.floor(500 + (s.security / 100) * 500) }),
    buildLog: (s) => `人口増加 → 人口+${Math.floor(500 + (s.security / 100) * 500)}、兵糧-200`,
  },
  {
    id: 'security',
    name: '治安強化',
    icon: '🛡',
    costLabel: '金 −100',
    effectLabel: '治安 +20（上限100）',
    color: '#1040b0',
    description: '法整備や見回りで治安を改善する。徴兵・人口増加・徴収に影響する。',
    canExecute: (s) => s.gold >= 100 && s.security < 100,
    execute: (s) => ({ gold: s.gold - 100, security: Math.min(100, s.security + 20) }),
    buildLog: (s) => `治安強化 → 治安+${Math.min(20, 100 - s.security)}、金-100`,
  },
  {
    id: 'trade',
    name: '貿易',
    icon: '⛵',
    costLabel: 'なし',
    effectLabel: '金 +150〜250、兵糧 +100',
    color: '#0a7090',
    description: '周辺国との交易で資源を増やす。人口が多いほど交易額が増える。',
    canExecute: (_s) => true,
    execute: (s) => ({ gold: s.gold + Math.floor(150 + s.population / 200), food: s.food + 100 }),
    buildLog: (s) => `貿易 → 金+${Math.floor(150 + s.population / 200)}、兵糧+100`,
  },
];

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

const PRISONER_TURNS = 10;

function resolveBattle(retainers: Retainer[], soldiers: number, target: Province): BattleResult {
  const maxCommand = Math.max(...retainers.map((r) => r.stats.command));
  const atk = soldiers * (maxCommand / 100) * (0.75 + Math.random() * 0.5);
  const def = 400 + Math.random() * 300;
  const won = atk > def;
  const casualties = Math.floor(soldiers * (won ? 0.1 + Math.random() * 0.15 : 0.25 + Math.random() * 0.25));
  return {
    won,
    casualties,
    gained: won ? target.id : undefined,
    message: won
      ? `【勝利】${target.name}を攻略！損害 ${casualties} 兵`
      : `【敗北】${target.name}の攻略に失敗。損害 ${casualties} 兵`,
  };
}

// 自軍参戦武将の平均ステータスに基づく捕縛確率（10%〜55%）
function calcCaptureChance(myRetainers: Retainer[]): number {
  if (myRetainers.length === 0) return 0;
  const avg = myRetainers.reduce((s, r) => s + r.stats.command + r.stats.intelligence + r.stats.loyalty, 0) / myRetainers.length;
  return Math.min(0.55, Math.max(0.10, (avg / 285) * 0.55));
}

// 武将のステータス総合値に基づく捕虜確率（5%〜40%）
function calcPrisonerChance(retainer: Retainer): number {
  const total = retainer.stats.command + retainer.stats.intelligence + retainer.stats.loyalty;
  return Math.max(0.05, Math.min(0.40, 0.55 - (total / 285) * 0.50));
}

// ─── ゲームマップ（viewBox操作によるズーム・パン） ────────
// CSS transform ではなく viewBox を操作することで、
// ズーム時もSVGがベクター再描画され地名が常にシャープになる。

// ─── アニメーション定義 ─────────────────────────────────
const bounceIn = keyframes`
  0%   { transform: scale(0.4) translateY(16px); opacity: 0; }
  55%  { transform: scale(1.08) translateY(-4px); opacity: 1; }
  75%  { transform: scale(0.96); }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

const shakeX = keyframes`
  0%,100% { transform: translateX(0) rotate(0deg); }
  15%      { transform: translateX(-7px) rotate(-3deg); }
  30%      { transform: translateX(7px)  rotate(3deg); }
  45%      { transform: translateX(-5px) rotate(-1.5deg); }
  60%      { transform: translateX(5px)  rotate(1.5deg); }
  75%      { transform: translateX(-2px); }
`;

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
}: {
  ownedProvinces: string[];
  daimyoColor: string;
  attackable: string[];
  selectingTarget: boolean;
  onProvinceClick?: (id: string) => void;
  onCancelDispatch?: () => void;
  showAllProvinces?: boolean;
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
                  : '#1e2e1e'
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
  const EMPTY_BATTLE: BattleDialog = { open: false, phase: 'confirm', retainers: [], targetProvinceId: '', result: null, autoRecruited: [], pendingCapture: [], captureDecisions: {}, newMyPrisoners: [] };
  const [battle, setBattle] = useState<BattleDialog>(EMPTY_BATTLE);
  const [saving, setSaving] = useState(false);
  const [actionsUsed, setActionsUsed] = useState(0);
  const [selectedRetainers, setSelectedRetainers] = useState<Set<string>>(new Set());
  const [selectingTarget, setSelectingTarget] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);

  const allRetainers = useMemo<Retainer[]>(
    () => [
      ...retainers,
      ...state.recruitedRetainers.map((r) => ({ id: r.id, name: r.name, nameReading: r.nameReading, daimyoId: daimyoId, stats: r.stats })),
    ],
    [retainers, state.recruitedRetainers, daimyoId],
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

    const newState: GameState = {
      ...state,
      year: newYear,
      month: newMonth,
      food: Math.max(0, rawFood + income.food),
      soldiers: Math.max(0, state.soldiers - starveDead + income.soldiers),
      gold: state.gold + income.gold,
      security: Math.min(100, state.security + 1),
      myPrisoners: updatedPrisoners,
    };
    const newPlaytime = playtime + 600;

    setState(newState);
    setPlaytime(newPlaytime);
    setActionsUsed(0);

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
      const capped = Math.min(Math.max(0, current + delta), state.soldiers - otherTotal);
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

  // ── マップ上で国をタップ → 戦闘ダイアログ ──
  const handleProvinceClick = (provinceId: string) => {
    if (!selectingTarget) return;
    const selectedList = allRetainers.filter((r) => selectedRetainers.has(r.id));
    setBattle({ open: true, phase: 'confirm', retainers: selectedList, targetProvinceId: provinceId, result: null, autoRecruited: [], pendingCapture: [], captureDecisions: {}, newMyPrisoners: [] });
    setSelectingTarget(false);
  };

  // ── 戦闘実行 ──
  const executeBattle = () => {
    if (!battle.retainers.length || !battle.targetProvinceId) return;
    const totalSoldiers = battle.retainers.reduce((sum, r) => sum + (assignments[r.id] ?? 0), 0);
    if (totalSoldiers === 0) return;

    const target = getProvince(battle.targetProvinceId)!;
    const result = resolveBattle(battle.retainers, totalSoldiers, target);

    const newAssignments = { ...assignments };
    const casualtyPerRetainer = Math.ceil(result.casualties / battle.retainers.length);
    for (const r of battle.retainers) {
      newAssignments[r.id] = Math.max(0, (assignments[r.id] ?? 0) - casualtyPerRetainer);
    }

    const newState: GameState = {
      ...state,
      soldiers: Math.max(0, state.soldiers - result.casualties),
      ownedProvinces: result.won && result.gained ? [...state.ownedProvinces, result.gained] : state.ownedProvinces,
    };

    const names = battle.retainers.map((r) => r.name).join('・');
    addLog(`[${names}] ${result.message}`, newState);

    if (result.won) {
      // 捕縛フェーズへ：敵大名の武将を対象に捕縛判定
      const recruitedIds = new Set(state.recruitedRetainers.map((r) => r.id));
      const enemyRetainers = getRetainersByDaimyo(target.daimyoId).filter((r) => !recruitedIds.has(r.id));
      const captureRate = calcCaptureChance(battle.retainers);
      const autoRecruited: Retainer[] = [];
      const pendingCapture: Retainer[] = [];
      for (const er of enemyRetainers) {
        if (Math.random() < captureRate) autoRecruited.push(er);
        else pendingCapture.push(er);
      }
      // 自動捕縛武将を即時追加
      const newRecruited: RecruitedRetainerData[] = autoRecruited.map((r) => ({ id: r.id, name: r.name, nameReading: r.nameReading, originalDaimyoId: r.daimyoId, stats: r.stats }));
      const addedAssignments = Object.fromEntries(autoRecruited.map((r) => [r.id, 0]));
      const finalState: GameState = { ...newState, recruitedRetainers: [...state.recruitedRetainers, ...newRecruited] };
      const finalAssignments = { ...newAssignments, ...addedAssignments };
      setState(finalState);
      setAssignments(finalAssignments);
      setSelectedRetainers(new Set());
      setBattle((prev) => ({ ...prev, phase: 'capture', result, autoRecruited, pendingCapture, captureDecisions: {} }));
      persistSave(finalState, finalAssignments, playtime);
    } else {
      // 捕虜フェーズへ：参戦武将の捕虜判定（個別にステータスで判定）
      const capturedRetainers = battle.retainers.filter((r) => Math.random() < calcPrisonerChance(r));
      setState(newState);
      setAssignments(newAssignments);
      setSelectedRetainers(new Set());
      setBattle((prev) => ({ ...prev, phase: 'prisoner', result, newMyPrisoners: capturedRetainers }));
      persistSave(newState, newAssignments, playtime);
    }
  };

  // ── 捕縛フェーズ：処遇決定 ──
  const setCaptureDecision = (retainerId: string, decision: 'release' | 'execute') => {
    setBattle((prev) => ({ ...prev, captureDecisions: { ...prev.captureDecisions, [retainerId]: decision } }));
  };

  // ── 捕縛/捕虜フェーズ完了 ──
  const finalizeBattleAndClose = () => {
    if (battle.phase === 'prisoner' && battle.newMyPrisoners.length > 0) {
      const newPrisoners: MyPrisonerData[] = battle.newMyPrisoners.map((r) => ({
        id: r.id, name: r.name, nameReading: r.nameReading, stats: r.stats,
        capturedByDaimyoId: getProvince(battle.targetProvinceId)?.daimyoId ?? '',
        turnsLeft: PRISONER_TURNS,
      }));
      const finalState: GameState = { ...state, myPrisoners: [...state.myPrisoners, ...newPrisoners] };
      setState(finalState);
      persistSave(finalState, assignments, playtime);
    }
    setBattle({ open: false, phase: 'confirm', retainers: [], targetProvinceId: '', result: null, autoRecruited: [], pendingCapture: [], captureDecisions: {}, newMyPrisoners: [] });
  };

  const closeBattle = () => setBattle({ open: false, phase: 'confirm', retainers: [], targetProvinceId: '', result: null, autoRecruited: [], pendingCapture: [], captureDecisions: {}, newMyPrisoners: [] });

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
                showAllProvinces={true}
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

              {INTERNAL_ACTIONS.map((action) => {
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
                            {isRecruited && <Chip label="捕縛" size="small" sx={{ fontSize: '0.58rem', height: 18, bgcolor: 'rgba(20,100,70,0.6)', color: '#88ddbb' }} />}
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
                            </Box>
                            <Button
                              onClick={() => changeAssignment(r.id, 50)}
                              disabled={availableSoldiers <= 0}
                              sx={{ minWidth: 44, minHeight: 40, color: '#44aa66', fontSize: '0.72rem', p: 0 }}
                            >
                              +50
                            </Button>
                            <IconButton onClick={() => changeAssignment(r.id, 100)} disabled={availableSoldiers <= 0} sx={{ p: 0.75, color: '#55bb77' }}>
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          {assigned > 0 ? (
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, (assigned / Math.max(state.soldiers, 1)) * 100)}
                              sx={{ height: 4, borderRadius: 2, mt: 0.75, bgcolor: '#1a2a1a', '& .MuiLinearProgress-bar': { bgcolor: isSelected ? '#ff8844' : '#e8c050' } }}
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

      {/* 戦闘ダイアログ */}
      <Dialog
        open={battle.open}
        onClose={battle.phase === 'confirm' ? closeBattle : undefined}
        maxWidth="xs"
        fullWidth
        slots={{ transition: SlideUp }}
        slotProps={{
          paper: { sx: { background: 'linear-gradient(160deg,#0d1a2e 0%,#0a1220 100%)', border: '1px solid #334466', mx: 2, borderRadius: 2, boxShadow: '0 24px 60px rgba(0,0,10,0.7)' } },
          backdrop: { sx: { backdropFilter: 'blur(4px)', background: 'rgba(0,0,8,0.65)' } },
        }}
      >
        <DialogTitle sx={{ color: '#e8d5a3', pb: 1, fontSize: '1rem' }}>
          {battle.phase === 'confirm' && `出陣 ─ ${battle.retainers.map((r) => r.name).join('・')}`}
          {battle.phase === 'result' && '戦闘結果'}
          {battle.phase === 'capture' && '捕縛処理'}
          {battle.phase === 'prisoner' && '捕虜報告'}
        </DialogTitle>
        <DialogContent>
          {/* 出陣確認フェーズ */}
          {battle.phase === 'confirm' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#667788' }}>出陣兵士数（合計）</Typography>
                <Typography sx={{ color: '#e8c050', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  {battle.retainers.reduce((sum, r) => sum + (assignments[r.id] ?? 0), 0).toLocaleString()} 兵
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#8899aa', mb: 0.5 }}>攻略対象</Typography>
                <Typography sx={{ fontSize: '1rem', color: '#cce0f5', fontWeight: 'bold' }}>
                  {getProvince(battle.targetProvinceId)?.name}（{getProvince(battle.targetProvinceId)?.region}）
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, background: 'rgba(255,255,255,0.04)', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#8899aa' }}>
                  攻撃力は最高統率値（{battle.retainers.length > 0 ? Math.max(...battle.retainers.map((r) => r.stats.command)) : 0}）と兵数に比例します。捕縛確率は参戦武将のステータス総合値に依存します。
                </Typography>
              </Box>
            </Box>
          )}

          {/* 戦闘結果フェーズ */}
          {battle.phase === 'result' && battle.result && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  fontSize: '2.8rem',
                  mb: 1,
                  animation: `${battle.result.won ? bounceIn : shakeX} 0.7s cubic-bezier(0.36,0.07,0.19,0.97) forwards`,
                }}
              >
                {battle.result.won ? '🏆' : '💀'}
              </Box>
              <Typography sx={{ color: battle.result.won ? '#55ee88' : '#ee5555', fontWeight: 'bold', fontSize: '1.1rem', mb: 1, animation: `${fadeSlideIn} 0.5s 0.2s ease both` }}>
                {battle.result.message}
              </Typography>
              {battle.result.won && battle.result.gained && (
                <Chip label={`${getProvince(battle.result.gained)?.name} を獲得`} sx={{ bgcolor: '#2a5a2a', color: '#88ee88', mt: 0.5, animation: `${popIn} 0.5s 0.5s cubic-bezier(0.34,1.56,0.64,1) both` }} />
              )}
            </Box>
          )}

          {/* 捕縛処理フェーズ（勝利時） */}
          {battle.phase === 'capture' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {battle.autoRecruited.length > 0 && (
                <Box>
                  <Typography sx={{ color: '#55ddaa', fontSize: '0.8rem', fontWeight: 'bold', mb: 0.6 }}>✅ 仲間になった武将</Typography>
                  {battle.autoRecruited.map((r, i) => (
                    <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1, py: 0.5, bgcolor: 'rgba(20,80,50,0.3)', borderRadius: 1, mb: 0.5, animation: `${popIn} 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.1}s both` }}>
                      <Typography sx={{ flex: 1, color: '#88ddbb', fontSize: '0.9rem', fontWeight: 'bold' }}>{r.name}</Typography>
                      <Chip label={`統${r.stats.command}`} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#c04020aa', color: '#ffaa88' }} />
                      <Chip label={`知${r.stats.intelligence}`} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#1040b0aa', color: '#88aaff' }} />
                      <Chip label={`忠${r.stats.loyalty}`} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: '#107040aa', color: '#88dd88' }} />
                    </Box>
                  ))}
                </Box>
              )}
              {battle.pendingCapture.length > 0 && (
                <Box>
                  <Typography sx={{ color: '#ddaa55', fontSize: '0.8rem', fontWeight: 'bold', mb: 0.6 }}>⚖ 処遇を選択</Typography>
                  {battle.pendingCapture.map((r) => {
                    const decision = battle.captureDecisions[r.id];
                    return (
                      <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1, py: 0.7, bgcolor: 'rgba(60,40,10,0.3)', borderRadius: 1, mb: 0.6 }}>
                        <Typography sx={{ color: '#ddcc88', fontSize: '0.85rem', fontWeight: 'bold', minWidth: 72 }}>{r.name}</Typography>
                        <Box sx={{ flex: 1 }} />
                        <Button size="small" variant={decision === 'release' ? 'contained' : 'outlined'} onClick={() => setCaptureDecision(r.id, 'release')}
                          sx={{ fontSize: '0.7rem', px: 1, py: 0.3, minWidth: 44, color: decision === 'release' ? '#fff' : '#88aacc', borderColor: '#446688', bgcolor: decision === 'release' ? '#336688' : 'transparent' }}>
                          釈放
                        </Button>
                        <Button size="small" variant={decision === 'execute' ? 'contained' : 'outlined'} onClick={() => setCaptureDecision(r.id, 'execute')}
                          sx={{ fontSize: '0.7rem', px: 1, py: 0.3, minWidth: 44, color: decision === 'execute' ? '#fff' : '#cc8888', borderColor: '#884444', bgcolor: decision === 'execute' ? '#883030' : 'transparent' }}>
                          処断
                        </Button>
                      </Box>
                    );
                  })}
                </Box>
              )}
              {battle.autoRecruited.length === 0 && battle.pendingCapture.length === 0 && (
                <Typography sx={{ color: '#667788', fontSize: '0.85rem', textAlign: 'center', py: 1 }}>
                  捕縛できた武将はいなかった。
                </Typography>
              )}
            </Box>
          )}

          {/* 捕虜フェーズ（敗北時） */}
          {battle.phase === 'prisoner' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Box component="span" sx={{ display: 'inline-block', fontSize: '2rem', mb: 0.5, animation: `${shakeX} 0.6s 0.1s ease both` }}>⛓</Box>
                <Typography sx={{ color: '#ee5555', fontSize: '0.9rem', mb: 1 }}>{battle.result?.message}</Typography>
              </Box>
              {battle.newMyPrisoners.length > 0 ? (
                <Box>
                  <Typography sx={{ color: '#cc8844', fontSize: '0.8rem', fontWeight: 'bold', mb: 0.6 }}>捕虜になった武将</Typography>
                  {battle.newMyPrisoners.map((r, i) => (
                    <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, px: 1, py: 0.5, bgcolor: 'rgba(80,20,10,0.3)', borderRadius: 1, mb: 0.5, animation: `${popIn} 0.45s cubic-bezier(0.34,1.56,0.64,1) ${0.1 + i * 0.1}s both` }}>
                      <Typography sx={{ flex: 1, color: '#cc8866', fontSize: '0.9rem', fontWeight: 'bold' }}>{r.name}</Typography>
                      <Chip label={`${PRISONER_TURNS}T後に解放`} size="small" sx={{ fontSize: '0.6rem', height: 18, bgcolor: 'rgba(120,40,10,0.5)', color: '#ffaa77' }} />
                    </Box>
                  ))}
                  <Typography sx={{ color: '#667788', fontSize: '0.72rem', mt: 1 }}>
                    ※ {PRISONER_TURNS}ターン後、または敵大名を滅ぼすと解放されます。
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ color: '#667788', fontSize: '0.85rem', textAlign: 'center' }}>
                  捕虜になった武将はいなかった。
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          {battle.phase === 'confirm' && (
            <>
              <Button onClick={closeBattle} sx={{ color: '#667788', fontSize: '0.8rem', transition: 'transform 0.12s', '&:active': { transform: 'scale(0.92)' } }}>
                キャンセル
              </Button>
              <Button onClick={executeBattle} variant="contained" sx={{ background: '#c03020', fontSize: '0.8rem', transition: 'transform 0.12s', '&:active': { transform: 'scale(0.92)' } }}>
                攻撃
              </Button>
            </>
          )}
          {battle.phase === 'result' && (
            <Button onClick={() => setBattle((prev) => ({ ...prev, phase: battle.result?.won ? 'capture' : 'prisoner' }))} variant="contained" sx={{ background: '#4a8abc', fontSize: '0.8rem', animation: `${popIn} 0.4s 0.3s cubic-bezier(0.34,1.56,0.64,1) both`, transition: 'transform 0.12s', '&:active': { transform: 'scale(0.92)' } }}>
              次へ
            </Button>
          )}
          {battle.phase === 'capture' && (
            <Button
              onClick={finalizeBattleAndClose}
              variant="contained"
              disabled={battle.pendingCapture.some((r) => !battle.captureDecisions[r.id])}
              sx={{ background: '#4a8abc', fontSize: '0.8rem', transition: 'transform 0.12s', '&:active': { transform: 'scale(0.92)' }, '&.Mui-disabled': { opacity: 0.4 } }}
            >
              完了
            </Button>
          )}
          {battle.phase === 'prisoner' && (
            <Button onClick={finalizeBattleAndClose} variant="contained" sx={{ background: '#4a8abc', fontSize: '0.8rem', transition: 'transform 0.12s', '&:active': { transform: 'scale(0.92)' } }}>
              閉じる
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: getDaimyo(selectedProvince.daimyoId)?.color, flexShrink: 0 }} />
                <Typography sx={{ color: '#8899aa', fontSize: '0.8rem' }}>
                  所属大名: {getDaimyo(selectedProvince.daimyoId)?.name || '中立'}
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
    </Box>
  );
}
