export interface Province {
  id: string;
  name: string;
  region: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  labelX: number;
  labelY: number;
  daimyoId: string;
  adjacent: string[];
  productionMilitary: number;
  productionFood: number;
  productionGold: number;
}

export function getPolygonPoints(province: Province): string {
  const halfW = province.width / 2;
  const halfH = province.height / 2;
  const x1 = province.centerX - halfW;
  const y1 = province.centerY - halfH;
  const x2 = province.centerX + halfW;
  const y2 = province.centerY + halfH;
  return `${x1},${y1} ${x2},${y1} ${x2},${y2} ${x1},${y2}`;
}

import provincesData from './provinces.json';

export const PROVINCES: Province[] = provincesData as Province[];

export interface Daimyo {
  id: string;
  name: string;
  nameReading: string;
  clan: string;
  color: string;
  homeProvinceId: string;
  stats: {
    military: number;
    politics: number;
    charisma: number;
  };
  description: string;
  era: string;
}

import daimyosData from './daimyos.json';

export const DAIMYO_LIST: Daimyo[] = daimyosData as Daimyo[];

export function getDaimyo(id: string): Daimyo | undefined {
  return DAIMYO_LIST.find((d) => d.id === id);
}

export function getProvince(id: string): Province | undefined {
  return PROVINCES.find((p) => p.id === id);
}

export function getProvincesByDaimyo(daimyoId: string): Province[] {
  return PROVINCES.filter((p) => p.daimyoId === daimyoId);
}
