export interface Retainer {
  id: string;
  name: string;
  nameReading: string;
  daimyoId: string;
  stats: {
    command: number;      // 統率
    intelligence: number; // 知略
    loyalty: number;      // 忠誠
  };
}

export interface DaimyoInitialParams {
  year: number;
  month: number;
  soldiers: number;
  food: number;
  gold: number;
  security: number;
  population: number;
}

export const RETAINERS: Retainer[] = [
  // 島津義久
  { id: 'shimazu_yoshihiro', name: '島津義弘', nameReading: 'しまづよしひろ', daimyoId: 'shimazu', stats: { command: 94, intelligence: 82, loyalty: 95 } },
  { id: 'shimazu_toshihisa', name: '島津歳久', nameReading: 'しまづとしひさ', daimyoId: 'shimazu', stats: { command: 78, intelligence: 85, loyalty: 93 } },
  { id: 'shimazu_iehisa',   name: '島津家久', nameReading: 'しまづいえひさ', daimyoId: 'shimazu', stats: { command: 89, intelligence: 80, loyalty: 91 } },

  // 大友宗麟
  { id: 'tachibana_dosetsu', name: '立花道雪',   nameReading: 'たちばなどうせつ', daimyoId: 'otomo', stats: { command: 92, intelligence: 78, loyalty: 88 } },
  { id: 'takahashi_joun',    name: '高橋紹運',   nameReading: 'たかはしじょううん', daimyoId: 'otomo', stats: { command: 85, intelligence: 74, loyalty: 95 } },
  { id: 'yoshihiro_akimasa', name: '吉弘鑑理',   nameReading: 'よしひろあきまさ', daimyoId: 'otomo', stats: { command: 78, intelligence: 72, loyalty: 85 } },

  // 毛利元就
  { id: 'kikkawa_motoharu',     name: '吉川元春',   nameReading: 'きっかわもとはる',   daimyoId: 'mori', stats: { command: 88, intelligence: 72, loyalty: 92 } },
  { id: 'kobayakawa_takakage',  name: '小早川隆景', nameReading: 'こばやかわたかかげ', daimyoId: 'mori', stats: { command: 82, intelligence: 90, loyalty: 90 } },
  { id: 'fukuhara_sadatoshi',   name: '福原貞俊',   nameReading: 'ふくはらさだとし',   daimyoId: 'mori', stats: { command: 70, intelligence: 80, loyalty: 85 } },

  // 長宗我部元親
  { id: 'kagawa_chikakazu', name: '香川親和', nameReading: 'かがわちかかず', daimyoId: 'chosokabe', stats: { command: 72, intelligence: 75, loyalty: 88 } },
  { id: 'kira_chikasada',   name: '吉良親貞', nameReading: 'きらちかさだ',   daimyoId: 'chosokabe', stats: { command: 78, intelligence: 70, loyalty: 90 } },
  { id: 'tani_tadazumi',    name: '谷忠澄',   nameReading: 'たにただずみ',   daimyoId: 'chosokabe', stats: { command: 68, intelligence: 72, loyalty: 85 } },

  // 織田信長
  { id: 'hashiba_hideyoshi', name: '羽柴秀吉', nameReading: 'はしばひでよし', daimyoId: 'oda', stats: { command: 78, intelligence: 95, loyalty: 85 } },
  { id: 'shibata_katsuie',   name: '柴田勝家', nameReading: 'しばたかついえ', daimyoId: 'oda', stats: { command: 88, intelligence: 65, loyalty: 92 } },
  { id: 'akechi_mitsuhide',  name: '明智光秀', nameReading: 'あけちみつひで', daimyoId: 'oda', stats: { command: 82, intelligence: 90, loyalty: 70 } },
  { id: 'maeda_toshiie',     name: '前田利家', nameReading: 'まえだとしいえ', daimyoId: 'oda', stats: { command: 76, intelligence: 70, loyalty: 92 } },

  // 今川義元
  { id: 'taigen_sessai',      name: '太原雪斎',   nameReading: 'たいげんせっさい', daimyoId: 'imagawa', stats: { command: 80, intelligence: 92, loyalty: 88 } },
  { id: 'asahina_yasuyoshi',  name: '朝比奈泰能', nameReading: 'あさひなやすよし', daimyoId: 'imagawa', stats: { command: 75, intelligence: 70, loyalty: 90 } },
  { id: 'okabe_motonobu',     name: '岡部元信',   nameReading: 'おかべもとのぶ',   daimyoId: 'imagawa', stats: { command: 79, intelligence: 72, loyalty: 85 } },

  // 武田信玄
  { id: 'yamamoto_kansuke',  name: '山本勘助', nameReading: 'やまもとかんすけ', daimyoId: 'takeda', stats: { command: 78, intelligence: 94, loyalty: 90 } },
  { id: 'baba_nobuharu',     name: '馬場信春', nameReading: 'ばばのぶはる',     daimyoId: 'takeda', stats: { command: 90, intelligence: 75, loyalty: 95 } },
  { id: 'yamagata_masakage', name: '山県昌景', nameReading: 'やまがたまさかげ', daimyoId: 'takeda', stats: { command: 88, intelligence: 70, loyalty: 93 } },
  { id: 'sanada_yukitaka',   name: '真田幸隆', nameReading: 'さなだゆきたか',   daimyoId: 'takeda', stats: { command: 76, intelligence: 88, loyalty: 85 } },

  // 上杉謙信
  { id: 'naoe_kanetsugu',   name: '直江兼続',   nameReading: 'なおえかねつぐ',   daimyoId: 'uesugi', stats: { command: 80, intelligence: 92, loyalty: 95 } },
  { id: 'kakizaki_kagaie',  name: '柿崎景家',   nameReading: 'かきざきかがいえ', daimyoId: 'uesugi', stats: { command: 88, intelligence: 65, loyalty: 88 } },
  { id: 'usami_sadamitsu',  name: '宇佐美定満', nameReading: 'うさみさだみつ',   daimyoId: 'uesugi', stats: { command: 82, intelligence: 85, loyalty: 82 } },
  { id: 'honjo_shigenaga',  name: '本庄繁長',   nameReading: 'ほんじょうしげなが', daimyoId: 'uesugi', stats: { command: 84, intelligence: 70, loyalty: 78 } },

  // 北条氏康
  { id: 'hojo_ujimasa',     name: '北条氏政', nameReading: 'ほうじょううじまさ',  daimyoId: 'hojo', stats: { command: 76, intelligence: 82, loyalty: 92 } },
  { id: 'hojo_tsunashige',  name: '北条綱成', nameReading: 'ほうじょうつなしげ',  daimyoId: 'hojo', stats: { command: 90, intelligence: 72, loyalty: 90 } },
  { id: 'matsuda_yasunaga', name: '松田康長', nameReading: 'まつだやすなが',      daimyoId: 'hojo', stats: { command: 72, intelligence: 80, loyalty: 85 } },

  // 伊達政宗
  { id: 'katakura_kagetsuna', name: '片倉景綱', nameReading: 'かたくらかげつな',   daimyoId: 'date', stats: { command: 82, intelligence: 90, loyalty: 95 } },
  { id: 'date_shigezane',     name: '伊達成実', nameReading: 'だてしげざね',       daimyoId: 'date', stats: { command: 88, intelligence: 75, loyalty: 92 } },
  { id: 'oniniwa_tsunamoto',  name: '鬼庭綱元', nameReading: 'おににわつなもと',   daimyoId: 'date', stats: { command: 80, intelligence: 82, loyalty: 88 } },

  // 斎藤道三
  { id: 'takenaka_shigeharu', name: '竹中重治', nameReading: 'たけなかしげはる', daimyoId: 'saito', stats: { command: 76, intelligence: 96, loyalty: 80 } },
  { id: 'inaba_ittetsu',      name: '稲葉一鉄', nameReading: 'いなばいってつ',   daimyoId: 'saito', stats: { command: 82, intelligence: 72, loyalty: 75 } },
  { id: 'ujiie_naomoto',      name: '氏家直元', nameReading: 'うじいえなおもと', daimyoId: 'saito', stats: { command: 78, intelligence: 70, loyalty: 80 } },

  // 浅井長政
  { id: 'isono_kazumasa',    name: '磯野員昌',   nameReading: 'いそのかずまさ',   daimyoId: 'azai', stats: { command: 80, intelligence: 68, loyalty: 88 } },
  { id: 'kaihoku_tsunachika', name: '海北綱親',  nameReading: 'かいほくつなちか', daimyoId: 'azai', stats: { command: 74, intelligence: 75, loyalty: 90 } },
  { id: 'amenomori_yahei',   name: '雨森弥兵衛', nameReading: 'あめのもりやへい', daimyoId: 'azai', stats: { command: 70, intelligence: 72, loyalty: 85 } },
];

export const INITIAL_PARAMS: Record<string, DaimyoInitialParams> = {
  shimazu:   { year: 1566, month: 1, soldiers: 1000, food: 900,  gold: 300, security: 65, population: 12000 },
  otomo:     { year: 1550, month: 1, soldiers:  800, food: 700,  gold: 600, security: 65, population: 13000 },
  mori:      { year: 1540, month: 1, soldiers:  900, food: 1000, gold: 500, security: 70, population: 18000 },
  chosokabe: { year: 1560, month: 1, soldiers:  500, food: 600,  gold: 300, security: 65, population:  8000 },
  oda:       { year: 1560, month: 1, soldiers: 1000, food: 800,  gold: 600, security: 65, population: 15000 },
  imagawa:   { year: 1550, month: 1, soldiers:  900, food: 800,  gold: 600, security: 75, population: 14000 },
  takeda:    { year: 1552, month: 1, soldiers: 1200, food: 1000, gold: 400, security: 70, population: 12000 },
  uesugi:    { year: 1553, month: 1, soldiers: 1100, food: 900,  gold: 350, security: 75, population: 10000 },
  hojo:      { year: 1546, month: 1, soldiers:  800, food: 800,  gold: 700, security: 80, population: 20000 },
  date:      { year: 1584, month: 1, soldiers:  700, food: 600,  gold: 400, security: 60, population:  8000 },
  saito:     { year: 1542, month: 1, soldiers:  600, food: 500,  gold: 500, security: 55, population: 10000 },
  azai:      { year: 1560, month: 1, soldiers:  500, food: 500,  gold: 400, security: 70, population:  8000 },
};

export function getRetainersByDaimyo(daimyoId: string): Retainer[] {
  return RETAINERS.filter((r) => r.daimyoId === daimyoId);
}
