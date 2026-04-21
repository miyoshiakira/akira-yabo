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

// ランク（階級）定義
export type RankId =
  | 'gocho'           // 伍長
  | 'hyakuninsho'     // 百人将
  | 'sanbyakuninsho'  // 三百人将
  | 'gohyakuninsho'   // 五百人将
  | 'senninsho'       // 千人将
  | 'nisenninsho'     // 二千人将
  | 'sansenninsho'    // 三千人将
  | 'gosenninsho'     // 五千人将
  | 'shogun'          // 将軍
  | 'daishogun'       // 大将軍
  | 'shodaimyo'       // 小大名
  | 'daimyo';         // 大名

export interface RankDefinition {
  id: RankId;
  name: string;
  maxSoldiers: number;
  requiredExp: number;
}

export const RANKS: RankDefinition[] = [
  { id: 'gocho',          name: '伍長',       maxSoldiers: 5,      requiredExp: 0 },
  { id: 'hyakuninsho',    name: '百人将',     maxSoldiers: 100,    requiredExp: 100 },
  { id: 'sanbyakuninsho', name: '三百人将',   maxSoldiers: 300,    requiredExp: 300 },
  { id: 'gohyakuninsho',  name: '五百人将',   maxSoldiers: 500,    requiredExp: 600 },
  { id: 'senninsho',      name: '千人将',     maxSoldiers: 1000,   requiredExp: 1000 },
  { id: 'nisenninsho',    name: '二千人将',   maxSoldiers: 2000,   requiredExp: 2000 },
  { id: 'sansenninsho',   name: '三千人将',   maxSoldiers: 3000,   requiredExp: 3500 },
  { id: 'gosenninsho',    name: '五千人将',   maxSoldiers: 5000,   requiredExp: 5500 },
  { id: 'shogun',         name: '将軍',       maxSoldiers: 10000,  requiredExp: 10000 },
  { id: 'daishogun',      name: '大将軍',     maxSoldiers: 50000,  requiredExp: 25000 },
  { id: 'shodaimyo',      name: '小大名',     maxSoldiers: 100000, requiredExp: 50000 },
  { id: 'daimyo',         name: '大名',       maxSoldiers: 200000, requiredExp: 100000 },
];

// 経験値からランクを取得
export function getRankByExp(exp: number): RankDefinition {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (exp >= r.requiredExp) {
      rank = r;
    } else {
      break;
    }
  }
  return rank;
}

// 次のランクを取得（最大ランクの場合はnull）
export function getNextRank(currentRank: RankDefinition): RankDefinition | null {
  const idx = RANKS.findIndex((r) => r.id === currentRank.id);
  if (idx < 0 || idx >= RANKS.length - 1) return null;
  return RANKS[idx + 1];
}

// 武将の経験値データ
export interface RetainerExpData {
  retainerId: string;
  exp: number;
}

export interface RecruitedRetainerData {
  id: string;
  name: string;
  nameReading: string;
  originalDaimyoId: string;
  stats: { command: number; intelligence: number; loyalty: number };
}

export interface MyPrisonerData {
  id: string;
  name: string;
  nameReading: string;
  stats: { command: number; intelligence: number; loyalty: number };
  capturedByDaimyoId: string;
  turnsLeft: number;
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

  // 龍造寺隆信
  { id: 'nabeshima_naoshige', name: '鍋島直茂', nameReading: 'なべしまなおしげ', daimyoId: 'ryuzoji', stats: { command: 86, intelligence: 82, loyalty: 90 } },
  { id: 'hyakutake_tomokane', name: '百武賢兼', nameReading: 'ひゃくたけともかね', daimyoId: 'ryuzoji', stats: { command: 78, intelligence: 70, loyalty: 88 } },
  { id: 'narimatsu_nobukatsu', name: '成松信勝', nameReading: 'なりまつのぶかつ', daimyoId: 'ryuzoji', stats: { command: 76, intelligence: 68, loyalty: 85 } },

  // 尼子晴久
  { id: 'uyama_hisakane', name: '宇山久兼', nameReading: 'うやまひさかね', daimyoId: 'amako', stats: { command: 78, intelligence: 75, loyalty: 88 } },
  { id: 'sase_kiyomune', name: '佐世清宗', nameReading: 'させきよむね', daimyoId: 'amako', stats: { command: 72, intelligence: 78, loyalty: 82 } },
  { id: 'kumagai_nobunao', name: '熊谷信直', nameReading: 'くまがいのぶなお', daimyoId: 'amako', stats: { command: 74, intelligence: 70, loyalty: 85 } },

  // 徳川家康
  { id: 'honda_tadakatsu', name: '本多忠勝', nameReading: 'ほんだただかつ', daimyoId: 'tokugawa', stats: { command: 95, intelligence: 72, loyalty: 98 } },
  { id: 'sakai_tadatsugu', name: '酒井忠次', nameReading: 'さかいただつぐ', daimyoId: 'tokugawa', stats: { command: 82, intelligence: 78, loyalty: 95 } },
  { id: 'ii_naomasa', name: '井伊直政', nameReading: 'いいなおまさ', daimyoId: 'tokugawa', stats: { command: 88, intelligence: 75, loyalty: 92 } },

  // 朝倉義景
  { id: 'asakura_kagetsura', name: '朝倉景健', nameReading: 'あさくらかげつら', daimyoId: 'asakura', stats: { command: 76, intelligence: 72, loyalty: 80 } },
  { id: 'uozumi_kagetsugu', name: '魚住景固', nameReading: 'うおずみかげつぐ', daimyoId: 'asakura', stats: { command: 72, intelligence: 68, loyalty: 75 } },
  { id: 'maeba_yoshitsugu', name: '前波吉継', nameReading: 'まえばよしつぐ', daimyoId: 'asakura', stats: { command: 70, intelligence: 75, loyalty: 72 } },

  // 最上義光
  { id: 'sakehide_hidetsuna', name: '鮭延秀綱', nameReading: 'さけのべひでつな', daimyoId: 'mogami', stats: { command: 80, intelligence: 72, loyalty: 90 } },
  { id: 'shimura_mitsuyasu', name: '志村光安', nameReading: 'しむらみつやす', daimyoId: 'mogami', stats: { command: 74, intelligence: 70, loyalty: 88 } },
  { id: 'iida_harima', name: '飯田播磨', nameReading: 'いいだはりま', daimyoId: 'mogami', stats: { command: 70, intelligence: 68, loyalty: 85 } },

  // 佐竹義重
  { id: 'satake_yoshitoshi', name: '佐竹義斯', nameReading: 'さたけよしとし', daimyoId: 'satake', stats: { command: 75, intelligence: 72, loyalty: 88 } },
  { id: 'koba_yoshizumi', name: '小場義実', nameReading: 'こばよしざね', daimyoId: 'satake', stats: { command: 72, intelligence: 70, loyalty: 85 } },
  { id: 'okamoto_akihiro', name: '岡本顕逸', nameReading: 'おかもとあきひろ', daimyoId: 'satake', stats: { command: 68, intelligence: 75, loyalty: 82 } },

  // 南部晴政
  { id: 'nanbu_nobunao', name: '南部信直', nameReading: 'なんぶのぶなお', daimyoId: 'nanbu', stats: { command: 72, intelligence: 75, loyalty: 80 } },
  { id: 'kasuya_myojo', name: '柏山明助', nameReading: 'かしやまみょうじょ', daimyoId: 'nanbu', stats: { command: 68, intelligence: 68, loyalty: 82 } },
  { id: 'kita_nobuchika', name: '北信愛', nameReading: 'きたのぶちか', daimyoId: 'nanbu', stats: { command: 70, intelligence: 72, loyalty: 85 } },

  // 本願寺顕如
  { id: 'shimotsuma_ranryo', name: '下間頼廉', nameReading: 'しもつまらいれん', daimyoId: 'honganji', stats: { command: 78, intelligence: 82, loyalty: 95 } },
  { id: 'shimotsuma_rairyu', name: '下間頼龍', nameReading: 'しもつまらいりゅう', daimyoId: 'honganji', stats: { command: 72, intelligence: 78, loyalty: 90 } },
  { id: 'kenshoji_shoe', name: '願証寺証恵', nameReading: 'けんしょうじしょうえ', daimyoId: 'honganji', stats: { command: 68, intelligence: 80, loyalty: 92 } },

  // 三好長慶
  { id: 'miyoshi_nagayasu', name: '三好長逸', nameReading: 'みよしながやす', daimyoId: 'miyoshi', stats: { command: 75, intelligence: 72, loyalty: 78 } },
  { id: 'miyoshi_masayasu', name: '三好政康', nameReading: 'みよしますやす', daimyoId: 'miyoshi', stats: { command: 78, intelligence: 70, loyalty: 75 } },
  { id: 'iwanari_tomomichi', name: '岩成友通', nameReading: 'いわなりともみち', daimyoId: 'miyoshi', stats: { command: 74, intelligence: 75, loyalty: 78 } },

  // 宗氏
  { id: 'so_yoshitoki', name: '宗義智', nameReading: 'そうよしとし', daimyoId: 'so', stats: { command: 65, intelligence: 78, loyalty: 85 } },
  { id: 'so_shogen', name: '宗将監', nameReading: 'そうしょうげん', daimyoId: 'so', stats: { command: 62, intelligence: 72, loyalty: 80 } },

  // 大友義統
  { id: 'tawara_chikakata', name: '田原親賢', nameReading: 'たわらちかかた', daimyoId: 'otomo_sorin', stats: { command: 65, intelligence: 70, loyalty: 78 } },
  { id: 'yoshihiro_toyokuni', name: '吉弘統幸', nameReading: 'よしひろとよくに', daimyoId: 'otomo_sorin', stats: { command: 72, intelligence: 68, loyalty: 82 } },

  // 有馬晴信
  { id: 'arima_yoshisada', name: '有馬義貞', nameReading: 'ありまよしさだ', daimyoId: 'arama', stats: { command: 68, intelligence: 65, loyalty: 80 } },
  { id: 'fukabori_kiyokata', name: '深堀純賢', nameReading: 'ふかぼりすみかた', daimyoId: 'arama', stats: { command: 65, intelligence: 62, loyalty: 78 } },

  // 松浦隆信
  { id: 'matsuura_shizuharu', name: '松浦鎮', nameReading: 'まつらしずはる', daimyoId: 'matsuura', stats: { command: 62, intelligence: 68, loyalty: 80 } },
  { id: 'hata_chikashige', name: '波多親重', nameReading: 'はたちかしげ', daimyoId: 'matsuura', stats: { command: 60, intelligence: 65, loyalty: 78 } },

  // 河野通宣
  { id: 'kono_mitsunao', name: '河野通直', nameReading: 'こうのみつなお', daimyoId: 'kono', stats: { command: 65, intelligence: 68, loyalty: 80 } },
  { id: 'kutsuna_michiakira', name: '忽那通著', nameReading: 'くつなみちあきら', daimyoId: 'kono', stats: { command: 68, intelligence: 65, loyalty: 82 } },

  // 三好義継
  { id: 'shinohara_nagafusa', name: '篠原長房', nameReading: 'しのはらながふさ', daimyoId: 'miyoshi_yoshitsugu', stats: { command: 72, intelligence: 78, loyalty: 75 } },
  { id: 'miyoshi_masakatsu', name: '三好政勝', nameReading: 'みよしますかつ', daimyoId: 'miyoshi_yoshitsugu', stats: { command: 68, intelligence: 70, loyalty: 72 } },

  // 細川藤孝
  { id: 'hosokawa_tadaoki', name: '細川忠興', nameReading: 'ほそかわただおき', daimyoId: 'hosokawa', stats: { command: 80, intelligence: 82, loyalty: 88 } },
  { id: 'ogasawara_hidekiyo', name: '小笠原秀清', nameReading: 'おがさわらひできよ', daimyoId: 'hosokawa', stats: { command: 72, intelligence: 70, loyalty: 85 } },

  // 細川澄元
  { id: 'miyoshi_yukinaga', name: '三好之長', nameReading: 'みよしゆきなが', daimyoId: 'hosokawa_sumimoto', stats: { command: 72, intelligence: 68, loyalty: 78 } },
  { id: 'hosokawa_masaharu', name: '細川政春', nameReading: 'ほそかわまさはる', daimyoId: 'hosokawa_sumimoto', stats: { command: 65, intelligence: 65, loyalty: 75 } },

  // 赤井直正
  { id: 'akai_tadaiye', name: '赤井忠家', nameReading: 'あかいただいえ', daimyoId: 'akai', stats: { command: 72, intelligence: 65, loyalty: 82 } },
  { id: 'ogino_naomasa_akai', name: '荻野直正', nameReading: 'おぎのなおまさ', daimyoId: 'akai', stats: { command: 75, intelligence: 68, loyalty: 80 } },

  // 細川幽斎
  { id: 'mukai_masatsuna', name: '向井正綱', nameReading: 'むかいまさつな', daimyoId: 'hosokawa_yusai', stats: { command: 72, intelligence: 78, loyalty: 88 } },
  { id: 'nagaoka_tadayuki', name: '長岡忠征', nameReading: 'ながおかただゆき', daimyoId: 'hosokawa_yusai', stats: { command: 68, intelligence: 80, loyalty: 90 } },

  // 橘氏（若狭）
  { id: 'takeda_nobutaka_wakasa', name: '武田信豊', nameReading: 'たけだのぶとよ', daimyoId: 'tachibana', stats: { command: 68, intelligence: 72, loyalty: 75 } },
  { id: 'kumagai_naotsugu', name: '熊谷直続', nameReading: 'くまがいなおつぐ', daimyoId: 'tachibana', stats: { command: 62, intelligence: 65, loyalty: 72 } },

  // 足利義昭
  { id: 'ishiko_fujinaga', name: '一色藤長', nameReading: 'いっしきふじなが', daimyoId: 'ashikaga', stats: { command: 62, intelligence: 75, loyalty: 82 } },
  { id: 'fujita_yukimasa', name: '藤田行政', nameReading: 'ふじたゆきまさ', daimyoId: 'ashikaga', stats: { command: 58, intelligence: 68, loyalty: 78 } },

  // 畠山高政
  { id: 'yusa_nobunori', name: '遊佐信教', nameReading: 'ゆさのぶのり', daimyoId: 'hatakeyama', stats: { command: 70, intelligence: 72, loyalty: 72 } },
  { id: 'yukawa_naomitsu', name: '湯川直光', nameReading: 'ゆかわなおみつ', daimyoId: 'hatakeyama', stats: { command: 65, intelligence: 68, loyalty: 70 } },

  // 畠山秋政
  { id: 'nonomura_yamato', name: '野々村大和守', nameReading: 'ののむらやまとのかみ', daimyoId: 'hatakeyama_akimasa', stats: { command: 62, intelligence: 65, loyalty: 72 } },
  { id: 'hatakeyama_masakuni', name: '畠山政国', nameReading: 'はたけやままさくに', daimyoId: 'hatakeyama_akimasa', stats: { command: 58, intelligence: 60, loyalty: 68 } },

  // 筒井順昭
  { id: 'tsutsui_junkei', name: '筒井順慶', nameReading: 'つついじゅんけい', daimyoId: 'tsutsui', stats: { command: 75, intelligence: 82, loyalty: 80 } },
  { id: 'shima_katsuhiro', name: '島勝猛', nameReading: 'しまかつたけ', daimyoId: 'tsutsui', stats: { command: 78, intelligence: 70, loyalty: 78 } },

  // 北畠具房
  { id: 'kitabatake_tomomichi', name: '北畠具教', nameReading: 'きたばたけとものり', daimyoId: 'kitabatake', stats: { command: 72, intelligence: 78, loyalty: 85 } },
  { id: 'kizuki_tomoyasu', name: '木造具康', nameReading: 'きぞくりともやす', daimyoId: 'kitabatake', stats: { command: 65, intelligence: 70, loyalty: 80 } },

  // 九鬼嘉隆
  { id: 'kuki_moritaka', name: '九鬼守隆', nameReading: 'くきもりたか', daimyoId: 'kuki', stats: { command: 75, intelligence: 72, loyalty: 88 } },
  { id: 'chigachi_shigenobu', name: '千賀地重信', nameReading: 'ちがちしげのぶ', daimyoId: 'kuki', stats: { command: 68, intelligence: 65, loyalty: 82 } },

  // 服部半蔵
  { id: 'hattori_masashige', name: '服部正重', nameReading: 'はっとりまさしげ', daimyoId: 'hattori', stats: { command: 78, intelligence: 72, loyalty: 88 } },
  { id: 'fujibayashi_yasutaka', name: '藤林保豊', nameReading: 'ふじばやしやすとよ', daimyoId: 'hattori', stats: { command: 72, intelligence: 80, loyalty: 82 } },

  // 雑賀孫一
  { id: 'dobashi_heiji', name: '土橋平次', nameReading: 'どばしへいじ', daimyoId: 'saika', stats: { command: 72, intelligence: 68, loyalty: 78 } },
  { id: 'saika_sanpei', name: '雑賀三平', nameReading: 'さいかさんぺい', daimyoId: 'saika', stats: { command: 68, intelligence: 65, loyalty: 75 } },

  // 浦上宗景
  { id: 'akashi_yukiaki', name: '明石行雄', nameReading: 'あかしゆきお', daimyoId: 'ura', stats: { command: 68, intelligence: 72, loyalty: 72 } },
  { id: 'nagafune_sadachika', name: '長船貞親', nameReading: 'ながふねさだちか', daimyoId: 'ura', stats: { command: 65, intelligence: 68, loyalty: 70 } },

  // 宇喜多直家
  { id: 'ukita_hideie', name: '宇喜多秀家', nameReading: 'うきたひでいえ', daimyoId: 'ukita', stats: { command: 78, intelligence: 75, loyalty: 85 } },
  { id: 'togawa_achiyasu', name: '戸川達安', nameReading: 'とかわたつやす', daimyoId: 'ukita', stats: { command: 75, intelligence: 70, loyalty: 82 } },
  { id: 'oka_toshitada', name: '岡利忠', nameReading: 'おかとしただ', daimyoId: 'ukita', stats: { command: 72, intelligence: 68, loyalty: 80 } },

  // 赤松政秀
  { id: 'akamatsu_norifusa', name: '赤松則房', nameReading: 'あかまつのりふさ', daimyoId: 'akamatsu', stats: { command: 65, intelligence: 62, loyalty: 75 } },
  { id: 'kodera_narisue', name: '小寺則職', nameReading: 'こでらなりのり', daimyoId: 'akamatsu', stats: { command: 62, intelligence: 65, loyalty: 72 } },

  // 山名豊国（但馬）
  { id: 'yamana_suketoyo', name: '山名祐豊', nameReading: 'やまやすけとよ', daimyoId: 'yamana_tajima', stats: { command: 62, intelligence: 65, loyalty: 72 } },
  { id: 'kikkawa_michiyasu', name: '吉川経安', nameReading: 'きっかわみちやす', daimyoId: 'yamana_tajima', stats: { command: 58, intelligence: 60, loyalty: 70 } },

  // 山名豊国（因幡）
  { id: 'yamana_toyohiro', name: '山名豊弘', nameReading: 'やまなとよひろ', daimyoId: 'yamana_inaba', stats: { command: 60, intelligence: 62, loyalty: 70 } },
  { id: 'kakiya_mitsunari', name: '垣屋光成', nameReading: 'かきやみつなり', daimyoId: 'yamana_inaba', stats: { command: 58, intelligence: 60, loyalty: 68 } },

  // 山中鹿之介
  { id: 'tatehara_hisatsuna', name: '立原久綱', nameReading: 'たてはらひさつな', daimyoId: 'yamanaka', stats: { command: 75, intelligence: 72, loyalty: 92 } },
  { id: 'sugihara_morishige', name: '杉原盛重', nameReading: 'すぎはらもりしげ', daimyoId: 'yamanaka', stats: { command: 70, intelligence: 68, loyalty: 88 } },

  // 隠岐氏
  { id: 'oki_kiyozane', name: '隠岐清実', nameReading: 'おききよざね', daimyoId: 'oki_hiko', stats: { command: 55, intelligence: 60, loyalty: 72 } },
  { id: 'oki_tamekiyo', name: '隠岐為清', nameReading: 'おきためきよ', daimyoId: 'oki_hiko', stats: { command: 52, intelligence: 58, loyalty: 70 } },

  // 堀秀政
  { id: 'hori_hideharu', name: '堀秀治', nameReading: 'ほりひではる', daimyoId: 'hori', stats: { command: 72, intelligence: 75, loyalty: 82 } },
  { id: 'aoyama_tadanari', name: '青山忠成', nameReading: 'あおやまただなり', daimyoId: 'hori', stats: { command: 68, intelligence: 70, loyalty: 80 } },

  // 神保長職
  { id: 'jinbo_nagashige', name: '神保長城', nameReading: 'じんぼながしげ', daimyoId: 'jinbo', stats: { command: 65, intelligence: 62, loyalty: 75 } },
  { id: 'kojima_motoshige', name: '小島職鎮', nameReading: 'こじまもとしげ', daimyoId: 'jinbo', stats: { command: 62, intelligence: 60, loyalty: 72 } },

  // 北条早雲
  { id: 'hojo_ujitsuna', name: '北条氏綱', nameReading: 'ほうじょううじつな', daimyoId: 'hojo_soun', stats: { command: 82, intelligence: 85, loyalty: 92 } },
  { id: 'omori_ujiyori', name: '大森氏頼', nameReading: 'おおもりうじより', daimyoId: 'hojo_soun', stats: { command: 72, intelligence: 70, loyalty: 85 } },

  // 結城氏朝
  { id: 'yuki_masakatsu', name: '結城政勝', nameReading: 'ゆうきまさかつ', daimyoId: 'yuki', stats: { command: 65, intelligence: 68, loyalty: 78 } },
  { id: 'mizuya_masamura', name: '水谷正村', nameReading: 'みずやまさむら', daimyoId: 'yuki', stats: { command: 62, intelligence: 62, loyalty: 75 } },

  // 佐竹義重（下野）
  { id: 'satake_yoshikage', name: '佐竹義廉', nameReading: 'さたけよしかど', daimyoId: 'satake_yoshishige', stats: { command: 72, intelligence: 70, loyalty: 85 } },
  { id: 'okamoto_yoshikatsu', name: '岡本義勝', nameReading: 'おかもとよしかつ', daimyoId: 'satake_yoshishige', stats: { command: 68, intelligence: 68, loyalty: 82 } },

  // 千葉氏
  { id: 'chiba_tanetomi', name: '千葉胤富', nameReading: 'ちばたねとみ', daimyoId: 'chiba', stats: { command: 62, intelligence: 60, loyalty: 72 } },
  { id: 'hara_tanesada', name: '原胤貞', nameReading: 'はらたねさだ', daimyoId: 'chiba', stats: { command: 58, intelligence: 58, loyalty: 70 } },

  // 正木氏
  { id: 'masaki_yoritada', name: '正木頼忠', nameReading: 'まさきよりただ', daimyoId: 'masaki', stats: { command: 65, intelligence: 62, loyalty: 78 } },
  { id: 'masaki_tokushige', name: '正木時茂', nameReading: 'まさきときしげ', daimyoId: 'masaki', stats: { command: 68, intelligence: 60, loyalty: 75 } },

  // 里見義堯
  { id: 'satomi_yoshihiro', name: '里見義弘', nameReading: 'さとみよしひろ', daimyoId: 'satomi', stats: { command: 72, intelligence: 68, loyalty: 85 } },
  { id: 'ansai_sanemoto', name: '安西実元', nameReading: 'あんざいさねもと', daimyoId: 'satomi', stats: { command: 68, intelligence: 65, loyalty: 82 } },

  // 岩城常隆
  { id: 'iwaki_shigetaka', name: '岩城重隆', nameReading: 'いわきしげたか', daimyoId: 'iwaki_tsunetaka', stats: { command: 62, intelligence: 60, loyalty: 75 } },
  { id: 'kusano_tamekiyo', name: '草野為清', nameReading: 'くさのためきよ', daimyoId: 'iwaki_tsunetaka', stats: { command: 58, intelligence: 58, loyalty: 72 } },

  // 安東愛季
  { id: 'ando_sanesue', name: '安東実季', nameReading: 'あんどうさねすえ', daimyoId: 'ando', stats: { command: 62, intelligence: 68, loyalty: 78 } },
  { id: 'minato_nobuchika', name: '湊信愛', nameReading: 'みなとのぶちか', daimyoId: 'ando', stats: { command: 58, intelligence: 62, loyalty: 72 } },
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
