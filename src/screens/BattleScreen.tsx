import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, LinearProgress, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';
import { getDaimyo, getProvince, PROVINCES, DAIMYO_LIST } from '../data/gameData';
import { getRetainersByDaimyo, getRankByExp } from '../data/retainerData';
import type { Retainer, RecruitedRetainerData } from '../data/retainerData';
import type { EnemyDaimyoState } from '../lib/saveData';

export interface BattleOutcome {
  won: boolean;
  playerCasualties: number;
  enemyCasualties: number;
  gainedProvinceId: string | null;
  updatedAssignments: Record<string, number>;
  capturedRetainers: { retainer: Retainer; decision: 'recruit' | 'release' | 'execute' }[];
  expGain: number;
  releasedRetainers: Retainer[];
}

interface BattleUnit {
  retainer: Retainer;
  soldiers: number;
  maxSoldiers: number;
  side: 'player' | 'enemy';
  defeated: boolean;
}

interface CapturedRetainer {
  retainer: Retainer;
  decision: 'recruit' | 'release' | 'execute' | null;
}

interface Props {
  playerDaimyoId: string;
  playerRetainers: Retainer[];
  playerAssignments: Record<string, number>;
  targetProvinceId: string;
  playerOwnedProvinces: string[];
  recruitedRetainers: RecruitedRetainerData[];
  enemyDaimyoState: Record<string, EnemyDaimyoState>;
  provinceOwnership: Record<string, string>;
  onFinish: (result: BattleOutcome) => void;
}

const bannerIn = keyframes`0%{transform:scaleY(0);opacity:0}50%{transform:scaleY(1.1);opacity:1}100%{transform:scaleY(1);opacity:1}`;
const slideL = keyframes`from{transform:translateX(-100%);opacity:0}to{transform:translateX(0);opacity:1}`;
const slideR = keyframes`from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}`;
const pulseGlow = keyframes`0%,100%{box-shadow:0 0 8px rgba(255,200,50,0.3)}50%{box-shadow:0 0 24px rgba(255,200,50,0.7)}`;
const marchL = keyframes`0%{transform:translateX(-20px);opacity:0}100%{transform:translateX(0);opacity:1}`;
const marchR = keyframes`0%{transform:translateX(20px);opacity:0}100%{transform:translateX(0);opacity:1}`;
const shakeDmg = keyframes`0%,100%{transform:translateX(0)}10%{transform:translateX(-6px)}20%{transform:translateX(6px)}30%{transform:translateX(-4px)}40%{transform:translateX(4px)}50%{transform:translateX(-2px)}`;
const flashGold = keyframes`0%,100%{background-color:transparent}50%{background-color:rgba(255,200,50,0.2)}`;
const defeatFade = keyframes`0%{opacity:1;transform:scale(1)}100%{opacity:0.25;transform:scale(0.85);filter:grayscale(1)}`;
const victoryBounce = keyframes`0%{transform:scale(0.3);opacity:0}50%{transform:scale(1.15);opacity:1}70%{transform:scale(0.95)}100%{transform:scale(1);opacity:1}`;
const floatUp = keyframes`0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-50px)}`;
const slashR = keyframes`0%{transform:translateX(-30px) scaleX(0.3);opacity:0}30%{transform:translateX(8px) scaleX(1.1);opacity:1}100%{transform:translateX(0);opacity:0}`;
const slashL = keyframes`0%{transform:translateX(30px) scaleX(-0.3);opacity:0}30%{transform:translateX(-8px) scaleX(-1.1);opacity:1}100%{transform:translateX(0);opacity:0}`;

function calcSpeed(r: Retainer, s: number) { return r.stats.command * 0.5 + r.stats.intelligence * 0.3 + Math.min(s / 100, 20) * 0.2; }
function calcDmg(r: Retainer, s: number) { const b = s * (r.stats.command / 100) * 0.15; return Math.max(1, Math.floor(b + (Math.random() - 0.5) * b * 0.6)); }
function isCrit(r: Retainer) { return Math.random() < r.stats.intelligence / 300; }
function isMiss(a: Retainer, d: Retainer) { return Math.random() < Math.max(0.02, (d.stats.intelligence - a.stats.intelligence) / 400); }

// 守備隊ユニット用のダミーRetainer
function makeGarrisonRetainer(daimyoId: string, idx: number): Retainer {
  const d = getDaimyo(daimyoId);
  const cmd = d ? Math.floor(d.stats.military * 0.6 + 20) : 50;
  const int = d ? Math.floor(d.stats.politics * 0.5 + 15) : 30;
  return { id: `__garrison_${daimyoId}_${idx}`, name: `守備隊${idx > 1 ? idx : ''}`, nameReading: `しゅびたい`, daimyoId, stats: { command: cmd, intelligence: int, loyalty: 80 } };
}

export default function BattleScreen({
  playerDaimyoId, playerRetainers, playerAssignments, targetProvinceId,
  playerOwnedProvinces, recruitedRetainers, enemyDaimyoState, provinceOwnership, onFinish,
}: Props) {
  const pDaimyo = getDaimyo(playerDaimyoId)!;
  const tProvince = getProvince(targetProvinceId)!;
  // provinceOwnershipから現在の支配大名を取得（AI間戦争で変更されている可能性）
  // プレイヤー領地の場合はプレイヤーIDが入っているので、その場合は元のdaimyoIdを使う
  const ownerInMap = provinceOwnership[targetProvinceId];
  const eDaimyoId = (ownerInMap && ownerInMap !== playerDaimyoId) ? ownerInMap : tProvince.daimyoId;
  const eDaimyo = getDaimyo(eDaimyoId);
  const recIds = useMemo(() => new Set(recruitedRetainers.map(r => r.id)), [recruitedRetainers]);
  const eRetainers = useMemo(() => getRetainersByDaimyo(eDaimyoId).filter(r => !recIds.has(r.id)), [eDaimyoId, recIds]);

  // 敵大名の蓄積兵力を使用。未蓄積の場合は領地生産力ベースの最低値
  const eStored = enemyDaimyoState[eDaimyoId];
  const eBaseSoldiers = eStored ? eStored.soldiers : (tProvince.productionMilitary * 50 + 200);

  // 武将がいない場合は守備隊を追加
  const eAllRetainers = useMemo(() => {
    if (eRetainers.length > 0) return eRetainers;
    const garrisonCount = Math.max(1, Math.min(3, Math.floor(eBaseSoldiers / 300)));
    return Array.from({ length: garrisonCount }, (_, i) => makeGarrisonRetainer(eDaimyoId, i + 1));
  }, [eRetainers, eBaseSoldiers, eDaimyoId]);

  const eRetExp = useMemo(() => eStored?.retainerExp ?? [], [eStored]);
  const eSoldierCounts = useMemo(() => {
    const c: Record<string, number> = {};
    const total = Math.max(200, eBaseSoldiers);
    for (const r of eAllRetainers) {
      const isGarrison = r.id.startsWith('__garrison_');
      const rank = isGarrison ? { maxSoldiers: 1500 } : getRankByExp(eRetExp.find(e => e.retainerId === r.id)?.exp ?? 0);
      c[r.id] = Math.min(rank.maxSoldiers, Math.floor(total * (0.8 + Math.random() * 0.4) / Math.max(1, eAllRetainers.length)));
    }
    return c;
  }, [eAllRetainers, eBaseSoldiers, eRetExp]);

  // 大名滅亡判定：対象大名の全領地がプレイヤー支配下になるか
  const isDaimyoDestroyed = useMemo(() => {
    const eProvs = PROVINCES.filter(p => (provinceOwnership[p.id] ?? p.daimyoId) === eDaimyoId);
    const afterOwned = [...playerOwnedProvinces, targetProvinceId];
    return eProvs.length > 0 && eProvs.every(p => afterOwned.includes(p.id));
  }, [eDaimyoId, playerOwnedProvinces, targetProvinceId, provinceOwnership]);

  // 滅亡時は全武将を捕縛対象にする
  const allEnemyRetainers = useMemo(() => {
    if (!isDaimyoDestroyed) return eRetainers;
    return getRetainersByDaimyo(eDaimyoId).filter(r => !recIds.has(r.id));
  }, [isDaimyoDestroyed, eDaimyoId, eRetainers, recIds]);

  const [units, setUnits] = useState<BattleUnit[]>(() => [
    ...playerRetainers.map(r => ({ retainer: r, soldiers: playerAssignments[r.id] ?? 0, maxSoldiers: playerAssignments[r.id] ?? 0, side: 'player' as const, defeated: false })),
    ...eAllRetainers.map(r => ({ retainer: r, soldiers: eSoldierCounts[r.id] ?? 200, maxSoldiers: eSoldierCounts[r.id] ?? 200, side: 'enemy' as const, defeated: false })),
  ]);

  const [phase, setPhase] = useState<'intro' | 'battle' | 'result'>('intro');
  const [turn, setTurn] = useState(0);
  const [actorId, setActorId] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [captured, setCaptured] = useState<CapturedRetainer[]>([]);
  const [lastAction, setLastAction] = useState<{ actorSide: string; targetId: string; critical: boolean; damage: number; miss: boolean } | null>(null);
  const [dmgFloater, setDmgFloater] = useState<{ id: string; value: number; crit: boolean } | null>(null);

  const pTotal = useMemo(() => units.filter(u => u.side === 'player' && !u.defeated).reduce((s, u) => s + u.soldiers, 0), [units]);
  const eTotal = useMemo(() => units.filter(u => u.side === 'enemy' && !u.defeated).reduce((s, u) => s + u.soldiers, 0), [units]);
  const pMax = useMemo(() => units.filter(u => u.side === 'player').reduce((s, u) => s + u.maxSoldiers, 0), [units]);
  const eMax = useMemo(() => units.filter(u => u.side === 'enemy').reduce((s, u) => s + u.maxSoldiers, 0), [units]);

  const won = eTotal <= 0 && pTotal > 0;
  const lost = pTotal <= 0 && eTotal > 0;

  useEffect(() => {
    if (phase !== 'intro') return;
    const t = [setTimeout(() => setIntroStep(1), 500), setTimeout(() => setIntroStep(2), 1000), setTimeout(() => setIntroStep(3), 1500), setTimeout(() => setIntroStep(4), 2000), setTimeout(() => setPhase('battle'), 2800)];
    return () => t.forEach(clearTimeout);
  }, [phase]);

  const executeTurn = useCallback(() => {
    if (animating) return;
    const alive = units.filter(u => !u.defeated && u.soldiers > 0);
    if (alive.filter(u => u.side === 'player').length === 0 || alive.filter(u => u.side === 'enemy').length === 0) { setPhase('result'); return; }

    const sorted = [...alive].sort((a, b) => calcSpeed(b.retainer, b.soldiers) - calcSpeed(a.retainer, a.soldiers));
    setAnimating(true);
    const newUnits = [...units];
    let idx = 0;

    const next = () => {
      if (idx >= sorted.length) {
        setUnits(newUnits);
        setTurn(t => t + 1);
        setActorId(null);
        setLastAction(null);
        setAnimating(false);
        const pA = newUnits.filter(u => u.side === 'player' && !u.defeated && u.soldiers > 0);
        const eA = newUnits.filter(u => u.side === 'enemy' && !u.defeated && u.soldiers > 0);
        if (pA.length === 0 || eA.length === 0) setTimeout(() => setPhase('result'), 600);
        return;
      }
      const act = sorted[idx];
      const au = newUnits.find(u => u.retainer.id === act.retainer.id)!;
      if (au.defeated || au.soldiers <= 0) { idx++; next(); return; }
      setActorId(act.retainer.id);
      const targets = newUnits.filter(u => u.side !== act.side && !u.defeated && u.soldiers > 0);
      if (targets.length === 0) { idx++; next(); return; }
      const tgt = targets[Math.floor(Math.random() * targets.length)];
      const miss = isMiss(act.retainer, tgt.retainer);
      const crit = !miss && isCrit(act.retainer);
      let dmg = miss ? 0 : calcDmg(act.retainer, au.soldiers);
      if (crit) dmg = Math.floor(dmg * 1.8);
      const killed = Math.min(tgt.soldiers, dmg);
      tgt.soldiers -= killed;
      if (tgt.soldiers <= 0) { tgt.defeated = true; tgt.soldiers = 0; }
      setLastAction({ actorSide: act.side, targetId: tgt.retainer.id, critical: crit, damage: killed, miss });
      setDmgFloater({ id: tgt.retainer.id, value: killed, crit });
      setTimeout(() => setDmgFloater(null), 800);
      idx++;
      setTimeout(next, 550);
    };
    next();
  }, [units, animating]);

  useEffect(() => {
    if (phase !== 'battle' || animating) return;
    const t = setTimeout(executeTurn, 300);
    return () => clearTimeout(t);
  }, [phase, turn, animating, executeTurn]);

  useEffect(() => {
    if (phase !== 'result' || !won) return;
    // 滅亡時は全武将、そうでない場合は戦闘参加武将のみ
    const capturedList = isDaimyoDestroyed ? allEnemyRetainers : eRetainers.filter(r => !r.id.startsWith('__garrison_'));
    setCaptured(capturedList.map(r => ({ retainer: r, decision: null })));
  }, [phase, won, isDaimyoDestroyed, allEnemyRetainers, eRetainers]);

  const setDecision = (rid: string, d: 'recruit' | 'release' | 'execute') => setCaptured(prev => prev.map(c => c.retainer.id === rid ? { ...c, decision: d } : c));

  const findReleaseDest = (r: Retainer): string => {
    const origProv = PROVINCES.filter(p => (provinceOwnership[p.id] ?? p.daimyoId) === r.daimyoId);
    const origAlive = origProv.length > 0 && !origProv.every(p => playerOwnedProvinces.includes(p.id));
    if (origAlive) return r.daimyoId;
    const alive = DAIMYO_LIST.filter(d => {
      const ps = PROVINCES.filter(p => (provinceOwnership[p.id] ?? p.daimyoId) === d.id);
      return ps.length > 0 && !ps.every(p => playerOwnedProvinces.includes(p.id));
    }).filter(d => d.id !== playerDaimyoId);
    return alive.length > 0 ? alive[Math.floor(Math.random() * alive.length)].id : r.daimyoId;
  };

  const handleFinish = () => {
    const pCas = units.filter(u => u.side === 'player').reduce((s, u) => s + (u.maxSoldiers - u.soldiers), 0);
    const eCas = units.filter(u => u.side === 'enemy').reduce((s, u) => s + (u.maxSoldiers - u.soldiers), 0);
    const uAssign: Record<string, number> = { ...playerAssignments };
    units.filter(u => u.side === 'player').forEach(u => { uAssign[u.retainer.id] = u.soldiers; });
    const finalCap = captured.filter(c => c.decision) as { retainer: Retainer; decision: 'recruit' | 'release' | 'execute' }[];
    const expG = won ? Math.floor(100 + playerRetainers.reduce((s, r) => s + (playerAssignments[r.id] ?? 0), 0) / 10) : 20;
    onFinish({ won, playerCasualties: pCas, enemyCasualties: eCas, gainedProvinceId: won ? targetProvinceId : null, updatedAssignments: uAssign, capturedRetainers: finalCap, expGain: expG, releasedRetainers: finalCap.filter(c => c.decision === 'release').map(c => c.retainer) });
  };

  const allDecided = captured.length === 0 || captured.every(c => c.decision !== null);

  return (
    <Box sx={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#070d1a', overflow: 'hidden' }}>

      {/* ═══ INTRO ═══ */}
      {phase === 'intro' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at center,#1a0a0a 0%,#070d1a 70%)' }}>
          {introStep >= 0 && <Typography sx={{ fontSize: '2rem', fontWeight: 'bold', color: '#e8d5a3', animation: `${bannerIn} 0.6s cubic-bezier(0.34,1.56,0.64,1) both`, textShadow: '0 0 20px rgba(232,213,163,0.5)', letterSpacing: 0.15 }}>⚔ 出陣 ⚔</Typography>}
          {introStep >= 1 && (
            <Box sx={{ mt: 3, animation: `${slideL} 0.5s ease both` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', mb: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: pDaimyo.color, boxShadow: `0 0 8px ${pDaimyo.color}` }} />
                <Typography sx={{ color: '#cce0f5', fontSize: '1.1rem', fontWeight: 'bold' }}>{pDaimyo.name}</Typography>
              </Box>
              <Typography sx={{ color: '#e87050', fontSize: '0.85rem' }}>兵数 {playerRetainers.reduce((s, r) => s + (playerAssignments[r.id] ?? 0), 0).toLocaleString()}</Typography>
            </Box>
          )}
          {introStep >= 2 && <Typography sx={{ my: 1.5, fontSize: '1.3rem', color: '#cc3030', fontWeight: 'bold', animation: `${pulseGlow} 1s ease infinite` }}>VS</Typography>}
          {introStep >= 3 && (
            <Box sx={{ animation: `${slideR} 0.5s ease both` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', mb: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: eDaimyo?.color ?? '#666', boxShadow: `0 0 8px ${eDaimyo?.color ?? '#666'}` }} />
                <Typography sx={{ color: '#cce0f5', fontSize: '1.1rem', fontWeight: 'bold' }}>{eDaimyo?.name ?? '守軍'}</Typography>
              </Box>
              <Typography sx={{ color: '#e87050', fontSize: '0.85rem' }}>兵数 {Object.values(eSoldierCounts).reduce((s, v) => s + v, 0).toLocaleString()}</Typography>
            </Box>
          )}
          {introStep >= 4 && <Typography sx={{ mt: 2, color: '#8899aa', fontSize: '0.8rem', animation: `${bannerIn} 0.4s ease both` }}>─ {tProvince.name}の戦 ─</Typography>}
        </Box>
      )}

      {/* ═══ BATTLE ═══ */}
      {phase === 'battle' && (
        <>
          <Box sx={{ px: 1.5, py: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
            <Typography sx={{ color: '#e8d5a3', fontWeight: 'bold', fontSize: '0.85rem' }}>{tProvince.name}の戦</Typography>
            <Typography sx={{ color: '#8899aa', fontSize: '0.75rem' }}>ターン {turn + 1}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 0.8, flexShrink: 0 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#55aa77' }}>{pDaimyo.name}軍</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#e87050' }}>{pTotal.toLocaleString()}</Typography>
              </Box>
              <LinearProgress variant="determinate" value={pMax > 0 ? (pTotal / pMax) * 100 : 0} sx={{ height: 7, borderRadius: 3.5, bgcolor: '#1a2a1a', '& .MuiLinearProgress-bar': { bgcolor: '#55aa77', borderRadius: 3.5 } }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                <Typography sx={{ fontSize: '0.6rem', color: '#cc6644' }}>{eDaimyo?.name ?? '守軍'}軍</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: '#e87050' }}>{eTotal.toLocaleString()}</Typography>
              </Box>
              <LinearProgress variant="determinate" value={eMax > 0 ? (eTotal / eMax) * 100 : 0} sx={{ height: 7, borderRadius: 3.5, bgcolor: '#2a1a1a', '& .MuiLinearProgress-bar': { bgcolor: '#cc6644', borderRadius: 3.5 } }} />
            </Box>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative', background: 'radial-gradient(ellipse at 50% 80%,#1a0808 0%,#070d1a 60%)' }}>
            {/* Slash effect */}
            {lastAction && !lastAction.miss && (
              <Box sx={{ position: 'absolute', top: '30%', left: lastAction.actorSide === 'player' ? '40%' : '20%', zIndex: 10, fontSize: '3rem', animation: `${lastAction.actorSide === 'player' ? slashR : slashL} 0.5s ease forwards`, pointerEvents: 'none' }}>
                {lastAction.critical ? '⚡' : '⚔'}
              </Box>
            )}
            {/* Player side */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.4, p: 0.8, overflowY: 'auto' }}>
              {units.filter(u => u.side === 'player').map((u, i) => {
                const isActive = actorId === u.retainer.id;
                const isTgt = lastAction?.targetId === u.retainer.id && lastAction?.actorSide === 'enemy';
                const hp = u.maxSoldiers > 0 ? u.soldiers / u.maxSoldiers : 0;
                return (
                  <Box key={u.retainer.id} sx={{
                    p: 0.6, borderRadius: 1.5, position: 'relative',
                    background: u.defeated ? 'rgba(40,40,40,0.4)' : isActive ? 'rgba(80,160,80,0.15)' : 'rgba(20,60,40,0.12)',
                    border: `1px solid ${u.defeated ? 'rgba(60,60,60,0.3)' : isActive ? 'rgba(80,200,80,0.5)' : 'rgba(40,100,60,0.3)'}`,
                    animation: `${marchL} 0.4s ease ${i * 0.08}s both${isTgt && !u.defeated ? `, ${shakeDmg} 0.4s ease` : ''}${isTgt && lastAction?.critical ? `, ${flashGold} 0.3s ease` : ''}${u.defeated ? `, ${defeatFade} 0.6s ease forwards` : ''}`,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 'bold', flex: 1, color: u.defeated ? '#444' : '#aaddbb', textDecoration: u.defeated ? 'line-through' : 'none' }}>{u.retainer.name}</Typography>
                      <Chip label={`統${u.retainer.stats.command}`} size="small" sx={{ fontSize: '0.5rem', height: 14, bgcolor: '#c0402066', color: '#ffaa88' }} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                      <LinearProgress variant="determinate" value={hp * 100} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#1a2a1a', '& .MuiLinearProgress-bar': { bgcolor: hp > 0.5 ? '#55aa77' : hp > 0.25 ? '#ddaa44' : '#dd4444', borderRadius: 2 } }} />
                      <Typography sx={{ fontSize: '0.55rem', color: u.defeated ? '#555' : '#e8c050', minWidth: 36, textAlign: 'right' }}>{u.soldiers.toLocaleString()}</Typography>
                    </Box>
                    {dmgFloater?.id === u.retainer.id && (
                      <Typography sx={{ position: 'absolute', top: -4, right: 8, fontSize: dmgFloater.crit ? '1rem' : '0.8rem', fontWeight: 'bold', color: dmgFloater.crit ? '#ffdd44' : '#ff6644', animation: `${floatUp} 0.7s ease forwards`, pointerEvents: 'none' }}>
                        {dmgFloater.crit ? `⚡-${dmgFloater.value}` : `-${dmgFloater.value}`}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
            {/* Center divider */}
            <Box sx={{ width: 2, bgcolor: 'rgba(255,255,255,0.08)', my: 2 }} />
            {/* Enemy side */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.4, p: 0.8, overflowY: 'auto' }}>
              {units.filter(u => u.side === 'enemy').map((u, i) => {
                const isActive = actorId === u.retainer.id;
                const isTgt = lastAction?.targetId === u.retainer.id && lastAction?.actorSide === 'player';
                const hp = u.maxSoldiers > 0 ? u.soldiers / u.maxSoldiers : 0;
                return (
                  <Box key={u.retainer.id} sx={{
                    p: 0.6, borderRadius: 1.5, position: 'relative',
                    background: u.defeated ? 'rgba(40,40,40,0.4)' : isActive ? 'rgba(160,80,80,0.15)' : 'rgba(60,20,20,0.12)',
                    border: `1px solid ${u.defeated ? 'rgba(60,60,60,0.3)' : isActive ? 'rgba(200,80,80,0.5)' : 'rgba(100,40,40,0.3)'}`,
                    animation: `${marchR} 0.4s ease ${i * 0.08}s both${isTgt && !u.defeated ? `, ${shakeDmg} 0.4s ease` : ''}${isTgt && lastAction?.critical ? `, ${flashGold} 0.3s ease` : ''}${u.defeated ? `, ${defeatFade} 0.6s ease forwards` : ''}`,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 'bold', flex: 1, color: u.defeated ? '#444' : '#ddaabb', textDecoration: u.defeated ? 'line-through' : 'none' }}>{u.retainer.name}</Typography>
                      <Chip label={`統${u.retainer.stats.command}`} size="small" sx={{ fontSize: '0.5rem', height: 14, bgcolor: '#c0402066', color: '#ffaa88' }} />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                      <LinearProgress variant="determinate" value={hp * 100} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#2a1a1a', '& .MuiLinearProgress-bar': { bgcolor: hp > 0.5 ? '#cc6644' : hp > 0.25 ? '#ddaa44' : '#dd4444', borderRadius: 2 } }} />
                      <Typography sx={{ fontSize: '0.55rem', color: u.defeated ? '#555' : '#e8c050', minWidth: 36, textAlign: 'right' }}>{u.soldiers.toLocaleString()}</Typography>
                    </Box>
                    {dmgFloater?.id === u.retainer.id && (
                      <Typography sx={{ position: 'absolute', top: -4, left: 8, fontSize: dmgFloater.crit ? '1rem' : '0.8rem', fontWeight: 'bold', color: dmgFloater.crit ? '#ffdd44' : '#ff6644', animation: `${floatUp} 0.7s ease forwards`, pointerEvents: 'none' }}>
                        {dmgFloater.crit ? `⚡-${dmgFloater.value}` : `-${dmgFloater.value}`}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        </>
      )}

      {/* ═══ RESULT ═══ */}
      {phase === 'result' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'radial-gradient(ellipse at 50% 30%,#1a0a0a 0%,#070d1a 60%)' }}>
          <Box sx={{ textAlign: 'center', py: 3, flexShrink: 0 }}>
            <Box component="span" sx={{ display: 'inline-block', fontSize: '3rem', animation: `${victoryBounce} 0.7s cubic-bezier(0.34,1.56,0.64,1) both` }}>
              {won ? '🏆' : '💀'}
            </Box>
            <Typography sx={{ color: won ? '#55ee88' : '#ee5555', fontWeight: 'bold', fontSize: '1.3rem', mt: 1 }}>
              {won ? '勝利！' : '敗北...'}
            </Typography>
            <Typography sx={{ color: '#8899aa', fontSize: '0.8rem', mt: 0.5 }}>
              {won ? `${tProvince.name}を攻略！` : `${tProvince.name}の攻略に失敗`}
            </Typography>
          </Box>

          <Box sx={{ px: 2, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1, p: 1.5, background: 'rgba(20,60,40,0.2)', borderRadius: 1, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#55aa77' }}>自軍損害</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e87050' }}>{units.filter(u => u.side === 'player').reduce((s, u) => s + (u.maxSoldiers - u.soldiers), 0).toLocaleString()}</Typography>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, background: 'rgba(60,20,20,0.2)', borderRadius: 1, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.65rem', color: '#cc6644' }}>敵軍損害</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e87050' }}>{units.filter(u => u.side === 'enemy').reduce((s, u) => s + (u.maxSoldiers - u.soldiers), 0).toLocaleString()}</Typography>
              </Box>
            </Box>
          </Box>

          {/* 捕縛武将の処遇（勝利時のみ） */}
          {won && captured.length > 0 && (
            <Box sx={{ px: 2, flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <Typography sx={{ color: '#ddaa55', fontSize: '0.85rem', fontWeight: 'bold', mb: 1 }}>⚖ 捕縛武将の処遇</Typography>
              {captured.map((c) => {
                const d = c.decision;
                const dest = c.decision === 'release' ? findReleaseDest(c.retainer) : null;
                const destName = dest ? getDaimyo(dest)?.name : null;
                return (
                  <Box key={c.retainer.id} sx={{ p: 1.2, mb: 1, background: 'rgba(60,40,10,0.2)', borderRadius: 1.5, border: '1px solid rgba(180,140,60,0.3)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography sx={{ color: '#ddcc88', fontSize: '0.95rem', fontWeight: 'bold', flex: 1 }}>{c.retainer.name}</Typography>
                      <Chip label={`統${c.retainer.stats.command}`} size="small" sx={{ fontSize: '0.55rem', height: 18, bgcolor: '#c04020aa', color: '#ffaa88' }} />
                      <Chip label={`知${c.retainer.stats.intelligence}`} size="small" sx={{ fontSize: '0.55rem', height: 18, bgcolor: '#1040b0aa', color: '#88aaff' }} />
                      <Chip label={`忠${c.retainer.stats.loyalty}`} size="small" sx={{ fontSize: '0.55rem', height: 18, bgcolor: '#107040aa', color: '#88dd88' }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.8 }}>
                      <Button size="small" variant={d === 'recruit' ? 'contained' : 'outlined'} onClick={() => setDecision(c.retainer.id, 'recruit')}
                        sx={{ flex: 1, fontSize: '0.75rem', py: 0.5, color: d === 'recruit' ? '#fff' : '#88ddbb', borderColor: '#2a6a4a', bgcolor: d === 'recruit' ? '#2a6a4a' : 'transparent' }}>
                        登用
                      </Button>
                      <Button size="small" variant={d === 'release' ? 'contained' : 'outlined'} onClick={() => setDecision(c.retainer.id, 'release')}
                        sx={{ flex: 1, fontSize: '0.75rem', py: 0.5, color: d === 'release' ? '#fff' : '#88aacc', borderColor: '#336688', bgcolor: d === 'release' ? '#336688' : 'transparent' }}>
                        釈放
                      </Button>
                      <Button size="small" variant={d === 'execute' ? 'contained' : 'outlined'} onClick={() => setDecision(c.retainer.id, 'execute')}
                        sx={{ flex: 1, fontSize: '0.75rem', py: 0.5, color: d === 'execute' ? '#fff' : '#cc8888', borderColor: '#884444', bgcolor: d === 'execute' ? '#883030' : 'transparent' }}>
                        処断
                      </Button>
                    </Box>
                    {d === 'release' && destName && (
                      <Typography sx={{ fontSize: '0.65rem', color: '#88aacc', mt: 0.5 }}>
                        → {destName}の元へ帰還
                      </Typography>
                    )}
                    {d === 'recruit' && (
                      <Typography sx={{ fontSize: '0.65rem', color: '#88ddbb', mt: 0.5 }}>
                        → 自軍の家臣として迎える
                      </Typography>
                    )}
                    {d === 'execute' && (
                      <Typography sx={{ fontSize: '0.65rem', color: '#cc8888', mt: 0.5 }}>
                        → 処断する
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* 敗北時 */}
          {lost && (
            <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
              <Typography sx={{ color: '#667788', fontSize: '0.8rem' }}>武将は撤退しました。</Typography>
            </Box>
          )}

          {/* 勝利時・捕縛なし */}
          {won && captured.length === 0 && (
            <Box sx={{ px: 2, py: 2, textAlign: 'center' }}>
              <Typography sx={{ color: '#667788', fontSize: '0.8rem' }}>捕縛できた武将はいなかった。</Typography>
            </Box>
          )}

          {/* 完了ボタン */}
          <Box sx={{ p: 2, flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Button fullWidth variant="contained" onClick={handleFinish} disabled={won && captured.length > 0 && !allDecided}
              sx={{ background: won ? 'linear-gradient(135deg,#2a5a3a,#3a8a4a)' : '#4a8abc', fontWeight: 'bold', fontSize: '0.95rem', py: 1.2, '&.Mui-disabled': { opacity: 0.4 } }}>
              {won ? '戦果確定' : '撤退'}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
