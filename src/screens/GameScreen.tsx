import { useMemo, useRef, useState } from 'react';
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
  Typography,
} from '@mui/material';
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
import { getDaimyo, getProvince, PROVINCES } from '../data/gameData';
import type { Province } from '../data/gameData';
import { getRetainersByDaimyo } from '../data/retainerData';
import type { Retainer } from '../data/retainerData';
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
}

interface BattleDialog {
  open: boolean;
  retainers: Retainer[];
  targetProvinceId: string;
  result: BattleResult | null;
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

// ─── ゲームマップ（viewBox操作によるズーム・パン） ────────
// CSS transform ではなく viewBox を操作することで、
// ズーム時もSVGがベクター再描画され地名が常にシャープになる。

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
}: {
  ownedProvinces: string[];
  daimyoColor: string;
  attackable: string[];
  selectingTarget: boolean;
  onProvinceClick?: (id: string) => void;
  onCancelDispatch?: () => void;
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
          const isClickable = selectingTarget && isAttackable;
          return (
            <g
              key={p.id}
              onClick={isClickable ? () => { if (!hasMovedRef.current) onProvinceClick?.(p.id); } : undefined}
              style={{ cursor: isClickable ? 'pointer' : 'default' }}
            >
              <polygon
                points={p.points}
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
                strokeWidth={isOwned ? 1.2 : isAttackable && selectingTarget ? 2 : 0.7}
              />
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
  });

  const [assignments, setAssignments] = useState<Record<string, number>>(() =>
    Object.fromEntries(retainers.map((r) => [r.id, save.retainerAssignments[r.id] ?? 0])),
  );

  const [playtime, setPlaytime] = useState(save.playtimeSeconds);
  const [tab, setTab] = useState(0);
  const [log, setLog] = useState<string[]>([`${save.year}年${save.month}月: ${save.playtimeSeconds === 0 ? 'ゲーム開始' : '再開'}`]);
  const [battle, setBattle] = useState<BattleDialog>({ open: false, retainers: [], targetProvinceId: '', result: null });
  const [saving, setSaving] = useState(false);
  const [actionsUsed, setActionsUsed] = useState(0);
  const [selectedRetainers, setSelectedRetainers] = useState<Set<string>>(new Set());
  const [selectingTarget, setSelectingTarget] = useState(false);

  const totalAssigned = useMemo(() => Object.values(assignments).reduce((a, b) => a + b, 0), [assignments]);
  const availableSoldiers = state.soldiers - totalAssigned;
  const attackable = useMemo(() => getAttackableProvinces(state.ownedProvinces), [state.ownedProvinces]);

  const selectedTotalSoldiers = useMemo(
    () => Array.from(selectedRetainers).reduce((sum, id) => sum + (assignments[id] ?? 0), 0),
    [selectedRetainers, assignments],
  );
  const canDispatch = selectedRetainers.size > 0 && selectedTotalSoldiers > 0 && attackable.length > 0;

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

    const newState: GameState = {
      ...state,
      year: newYear,
      month: newMonth,
      food: Math.max(0, rawFood + income.food),
      soldiers: Math.max(0, state.soldiers - starveDead + income.soldiers),
      gold: state.gold + income.gold,
      security: Math.min(100, state.security + 1),
    };
    const newPlaytime = playtime + 600;

    setState(newState);
    setPlaytime(newPlaytime);
    setActionsUsed(0);

    const starvMsg = starveDead > 0 ? `、餓死 -${starveDead}兵` : '';
    const incomeMsg = `地域収入: 志願兵+${income.soldiers}、兵糧+${income.food}、金+${income.gold}`;
    addLog(`月が改まった（兵糧消費 -${upkeep}${starvMsg}）　${incomeMsg}`, newState);

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
    const selectedList = retainers.filter((r) => selectedRetainers.has(r.id));
    setBattle({ open: true, retainers: selectedList, targetProvinceId: provinceId, result: null });
    setSelectingTarget(false);
  };

  // ── 戦闘実行（セーブ含む） ──
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
      ownedProvinces:
        result.won && result.gained ? [...state.ownedProvinces, result.gained] : state.ownedProvinces,
    };

    setState(newState);
    setAssignments(newAssignments);
    setSelectedRetainers(new Set());

    const names = battle.retainers.map((r) => r.name).join('・');
    addLog(`[${names}] ${result.message}`, newState);
    setBattle((prev) => ({ ...prev, result }));

    persistSave(newState, newAssignments, playtime);
  };

  const closeBattle = () => setBattle({ open: false, retainers: [], targetProvinceId: '', result: null });

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
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>

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
                onProvinceClick={handleProvinceClick}
                onCancelDispatch={cancelDispatch}
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
                <Typography key={i} variant="caption" sx={{ display: 'block', color: i === 0 ? '#cce0f5' : '#445566', fontSize: '0.7rem', lineHeight: 1.7 }}>
                  {entry}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* 内政タブ */}
        {tab === 1 && (
          <Box sx={{ height: '100%', overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: '#667788', letterSpacing: '0.1em' }}>内政コマンド</Typography>
              <Typography variant="caption" sx={{ color: actionsUsed >= MAX_ACTIONS ? '#ff6644' : '#4a8abc', fontWeight: 'bold' }}>
                {actionsUsed >= MAX_ACTIONS ? '今ターン行動終了' : `あと ${MAX_ACTIONS - actionsUsed} 回`}
              </Typography>
            </Box>

            {INTERNAL_ACTIONS.map((action) => {
              const canDo = actionsUsed < MAX_ACTIONS && action.canExecute(state);
              return (
                <Card
                  key={action.id}
                  sx={{
                    background: canDo ? `${action.color}18` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${canDo ? action.color + '44' : 'rgba(255,255,255,0.05)'}`,
                  }}
                >
                  <CardContent sx={{ p: '14px 16px !important' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography sx={{ fontSize: '1.3rem' }}>{action.icon}</Typography>
                      <Typography sx={{ fontWeight: 'bold', color: canDo ? '#ddeeff' : '#445566', fontSize: '1rem' }}>{action.name}</Typography>
                      <Box sx={{ flex: 1 }} />
                      <Chip label={action.costLabel} size="small" sx={{ fontSize: '0.65rem', height: 20, bgcolor: 'rgba(255,100,100,0.12)', color: '#ff9999' }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.78rem', color: '#8899aa', mb: 1, lineHeight: 1.6 }}>{action.description}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.74rem', color: '#55aa77', flex: 1 }}>効果: {action.effectLabel}</Typography>
                      <Button
                        variant="contained"
                        disabled={!canDo}
                        onClick={() => executeAction(action)}
                        sx={{
                          fontSize: '0.82rem',
                          px: 2.5,
                          py: 0.8,
                          minWidth: 0,
                          background: canDo ? action.color : undefined,
                          '&:hover': { background: canDo ? action.color + 'cc' : undefined },
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

              {retainers.map((r) => {
                const assigned = assignments[r.id] ?? 0;
                const isSelected = selectedRetainers.has(r.id);
                return (
                  <Card
                    key={r.id}
                    sx={{
                      mb: 1.5,
                      background: isSelected ? 'rgba(180,50,20,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isSelected ? 'rgba(200,80,40,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    }}
                  >
                    <CardContent sx={{ p: '12px 14px !important' }}>
                      {/* 武将情報 */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Checkbox
                          checked={isSelected}
                          disabled={assigned === 0}
                          onChange={() => toggleRetainer(r.id)}
                          sx={{ p: 0.5, color: '#556677', '&.Mui-checked': { color: '#ff8866' } }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ color: '#cce0f5', fontSize: '0.95rem', fontWeight: 'bold' }}>{r.name}</Typography>
                          <Typography sx={{ color: '#667788', fontSize: '0.68rem' }}>{r.nameReading}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                          <Chip label={`統${r.stats.command}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#c04020aa', color: '#ffaa88' }} />
                          <Chip label={`知${r.stats.intelligence}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#1040b0aa', color: '#88aaff' }} />
                          <Chip label={`忠${r.stats.loyalty}`} size="small" sx={{ fontSize: '0.62rem', height: 20, bgcolor: '#107040aa', color: '#88dd88' }} />
                        </Box>
                      </Box>

                      {/* 兵士割当 */}
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
                    </CardContent>
                  </Card>
                );
              })}
            </Box>

            {/* 出陣ボタン（下部固定） */}
            <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}>
              {selectedRetainers.size > 0 && (
                <Typography variant="caption" sx={{ display: 'block', color: '#ff9966', mb: 1, textAlign: 'center', fontSize: '0.78rem' }}>
                  {Array.from(selectedRetainers).map((id) => retainers.find((r) => r.id === id)?.name).join('・')}
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
          '& .MuiBottomNavigationAction-root': { color: '#445566', minWidth: 0, py: 0.5 },
          '& .Mui-selected': { color: '#e8d5a3 !important' },
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
        onClose={closeBattle}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { background: '#0d1a2e', border: '1px solid #334455', mx: 2 } } }}
      >
        <DialogTitle sx={{ color: '#e8d5a3', pb: 1, fontSize: '1rem' }}>
          {battle.result
            ? '戦闘結果'
            : `出陣 ─ ${battle.retainers.map((r) => r.name).join('・')}`}
        </DialogTitle>
        <DialogContent>
          {!battle.result ? (
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
                  攻撃力は最高統率値（{battle.retainers.length > 0 ? Math.max(...battle.retainers.map((r) => r.stats.command)) : 0}）と兵数に比例します。勝敗にはランダム要素があります。
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography sx={{ fontSize: '2.5rem', mb: 1 }}>{battle.result.won ? '🏆' : '💀'}</Typography>
              <Typography sx={{ color: battle.result.won ? '#55ee88' : '#ee5555', fontWeight: 'bold', fontSize: '1.1rem', mb: 1 }}>
                {battle.result.message}
              </Typography>
              {battle.result.won && battle.result.gained && (
                <Chip label={`${getProvince(battle.result.gained)?.name} を獲得`} sx={{ bgcolor: '#2a5a2a', color: '#88ee88', mt: 0.5 }} />
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          {!battle.result ? (
            <>
              <Button onClick={closeBattle} sx={{ color: '#667788', flex: 1 }}>キャンセル</Button>
              <Button
                variant="contained"
                onClick={executeBattle}
                sx={{ background: '#c04020', '&:hover': { background: '#e06030' }, flex: 1 }}
              >
                開戦
              </Button>
            </>
          ) : (
            <Button onClick={closeBattle} variant="contained" fullWidth sx={{ background: '#2a4a6a' }}>閉じる</Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
