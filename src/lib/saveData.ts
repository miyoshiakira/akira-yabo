import type { RecruitedRetainerData, MyPrisonerData, RetainerExpData } from '../data/retainerData';

export interface EnemyDaimyoState {
  soldiers: number;
  food: number;
  gold: number;
}

export interface SaveDataProps {
  id: number;
  slotName: string;
  playerName: string;
  playtimeSeconds: number;
  createdAt: Date;
  updatedAt: Date;
  // ゲーム状態
  daimyoId: string;
  year: number;
  month: number;
  soldiers: number;
  food: number;
  gold: number;
  security: number;
  population: number;
  ownedProvinces: string[];
  retainerAssignments: Record<string, number>;
  recruitedRetainers: RecruitedRetainerData[];
  myPrisoners: MyPrisonerData[];
  retainerExp: RetainerExpData[];
  enemyDaimyoState: Record<string, EnemyDaimyoState>;
  provinceOwnership: Record<string, string>;
}

export class SaveData {
  id: number;
  slotName: string;
  playerName: string;
  playtimeSeconds: number;
  createdAt: Date;
  updatedAt: Date;
  daimyoId: string;
  year: number;
  month: number;
  soldiers: number;
  food: number;
  gold: number;
  security: number;
  population: number;
  ownedProvinces: string[];
  retainerAssignments: Record<string, number>;
  recruitedRetainers: RecruitedRetainerData[];
  myPrisoners: MyPrisonerData[];
  retainerExp: RetainerExpData[];
  enemyDaimyoState: Record<string, EnemyDaimyoState>;
  provinceOwnership: Record<string, string>;

  constructor(props: Partial<SaveDataProps> & { id: number }) {
    this.id = props.id;
    this.slotName = props.slotName ?? `スロット ${props.id}`;
    this.playerName = props.playerName ?? '名無し';
    this.playtimeSeconds = props.playtimeSeconds ?? 0;
    this.createdAt = props.createdAt ? new Date(props.createdAt) : new Date();
    this.updatedAt = props.updatedAt ? new Date(props.updatedAt) : new Date();
    this.daimyoId = props.daimyoId ?? 'oda';
    this.year = props.year ?? 1560;
    this.month = props.month ?? 1;
    this.soldiers = props.soldiers ?? 0;
    this.food = props.food ?? 0;
    this.gold = props.gold ?? 0;
    this.security = props.security ?? 50;
    this.population = props.population ?? 10000;
    this.ownedProvinces = props.ownedProvinces ?? [];
    this.retainerAssignments = props.retainerAssignments ?? {};
    this.recruitedRetainers = props.recruitedRetainers ?? [];
    this.myPrisoners = props.myPrisoners ?? [];
    this.retainerExp = props.retainerExp ?? [];
    this.enemyDaimyoState = props.enemyDaimyoState ?? {};
    this.provinceOwnership = props.provinceOwnership ?? {};
  }

  get playtimeFormatted(): string {
    const h = Math.floor(this.playtimeSeconds / 3600);
    const m = Math.floor((this.playtimeSeconds % 3600) / 60);
    const s = this.playtimeSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  toJSON(): SaveDataProps {
    return {
      id: this.id,
      slotName: this.slotName,
      playerName: this.playerName,
      playtimeSeconds: this.playtimeSeconds,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      daimyoId: this.daimyoId,
      year: this.year,
      month: this.month,
      soldiers: this.soldiers,
      food: this.food,
      gold: this.gold,
      security: this.security,
      population: this.population,
      ownedProvinces: this.ownedProvinces,
      retainerAssignments: this.retainerAssignments,
      recruitedRetainers: this.recruitedRetainers,
      myPrisoners: this.myPrisoners,
      retainerExp: this.retainerExp,
      enemyDaimyoState: this.enemyDaimyoState,
      provinceOwnership: this.provinceOwnership,
    };
  }

  static fromJSON(data: Partial<SaveDataProps> & { id: number }): SaveData {
    return new SaveData(data);
  }
}
