/**
 * 成語大冒險 - 狀態管理模組
 */
const getPreferences = () => {
  if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences) {
    return window.Capacitor.Plugins.Preferences;
  }
  return {
    get: async ({ key }) => {
      return { value: localStorage.getItem(key) };
    },
    set: async ({ key, value }) => {
      localStorage.setItem(key, value);
    }
  };
};
import {
  flushCloudSave,
  getCloudSaveState,
  initCloudSave,
  loadCloudSave,
  queueCloudSave,
  signInWithGoogle,
  signOutCloudSave
} from './cloud-save.js';

const Preferences = getPreferences();

const SAVE_UPDATED_AT_KEY = "idiom_adv_save_updated_at";
const ABILITY_SCORE_TARGET_XP = 300;
const ABILITY_CORRECT_GAIN = 5;
const CHECKIN_CYCLE_DAYS = 7;

export function getAbilityScore(rawXP = 0) {
  const normalizedXP = Math.max(0, Number(rawXP) || 0);
  if (normalizedXP <= 0) return 0;
  return Math.min(100, Math.round(Math.sqrt(normalizedXP / ABILITY_SCORE_TARGET_XP) * 100));
}

function getTodayStartMs() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
}

function normalizeLearningLog(state = gameState) {
  if (!state.learningLog || typeof state.learningLog !== "object") {
    state.learningLog = {};
  }
  if (!state.learningLog.learnedAt || typeof state.learningLog.learnedAt !== "object") {
    state.learningLog.learnedAt = {};
  }
  if (!state.learningLog.wrongById || typeof state.learningLog.wrongById !== "object") {
    state.learningLog.wrongById = {};
  }
  if (!state.learningLog.correctById || typeof state.learningLog.correctById !== "object") {
    state.learningLog.correctById = {};
  }
  return state.learningLog;
}

export function getUniqueIdiomCount() {
  return getUniqueIdiomItems().length;
}

export function getUniqueIdiomItems() {
  if (typeof IDIOMS_DATA === "undefined" || !Array.isArray(IDIOMS_DATA)) return [];
  const seen = new Set();
  return IDIOMS_DATA.filter(item => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function getLearnedIdiomCount(state = gameState) {
  return new Set((state.learnedIdioms || []).filter(Boolean)).size;
}

export function getUnlockedCardCount(state = gameState) {
  return new Set((state.unlockedCards || []).filter(Boolean)).size;
}

export function getClaimedCardSetCount(state = gameState) {
  return new Set((state.claimedSets || []).filter(id => typeof id === "string" && id.startsWith("set_"))).size;
}

export function syncLearnedIdiomsFromCards(state = gameState) {
  if (!Array.isArray(state.learnedIdioms)) state.learnedIdioms = [];
  if (!Array.isArray(state.unlockedCards)) state.unlockedCards = [];
  const learningLog = normalizeLearningLog(state);
  let changed = false;
  state.unlockedCards.forEach(id => {
    if (id && !state.learnedIdioms.includes(id)) {
      state.learnedIdioms.push(id);
      changed = true;
    }
    if (id && !Object.prototype.hasOwnProperty.call(learningLog.learnedAt, id)) {
      learningLog.learnedAt[id] = 0;
      changed = true;
    }
  });
  state.learnedIdioms.forEach(id => {
    if (id && !state.unlockedCards.includes(id)) {
      state.unlockedCards.push(id);
      changed = true;
    }
    if (id && !Object.prototype.hasOwnProperty.call(learningLog.learnedAt, id)) {
      learningLog.learnedAt[id] = 0;
      changed = true;
    }
  });
  return changed;
}

export function recordLearnedIdiom(idiomId, state = gameState) {
  if (!idiomId) return false;
  const learningLog = normalizeLearningLog(state);
  if (Object.prototype.hasOwnProperty.call(learningLog.learnedAt, idiomId)) return false;
  learningLog.learnedAt[idiomId] = Date.now();
  return true;
}

export function recordCorrectIdiom(idiomId, state = gameState) {
  if (!idiomId) return false;
  const learningLog = normalizeLearningLog(state);
  const current = learningLog.correctById[idiomId] || { count: 0, lastAt: 0 };
  learningLog.correctById[idiomId] = {
    count: (current.count || 0) + 1,
    lastAt: Date.now()
  };
  return true;
}

export function recordIncorrectIdiom(idiomId, state = gameState) {
  if (!idiomId) return false;
  const learningLog = normalizeLearningLog(state);
  const current = learningLog.wrongById[idiomId] || { count: 0, lastAt: 0 };
  learningLog.wrongById[idiomId] = {
    count: (current.count || 0) + 1,
    lastAt: Date.now()
  };
  return true;
}

export function getLearningReport(state = gameState) {
  const learningLog = normalizeLearningLog(state);
  const idioms = getUniqueIdiomItems();
  const idiomById = new Map(idioms.map(item => [item.id, item]));
  const weekStart = getTodayStartMs() - 6 * 24 * 60 * 60 * 1000;
  const learnedThisWeek = Object.entries(learningLog.learnedAt)
    .filter(([, learnedAt]) => Number(learnedAt) >= weekStart)
    .map(([id, learnedAt]) => ({ item: idiomById.get(id), learnedAt }))
    .filter(entry => entry.item)
    .sort((a, b) => b.learnedAt - a.learnedAt);

  const mistakes = Object.entries(learningLog.wrongById)
    .map(([id, wrong]) => {
      const item = idiomById.get(id);
      const correct = learningLog.correctById[id] || {};
      const wrongCount = wrong?.count || 0;
      const correctCount = correct?.count || 0;
      return {
        item,
        wrongCount,
        correctCount,
        lastWrongAt: wrong?.lastAt || 0,
        reviewScore: wrongCount * 2 - correctCount
      };
    })
    .filter(entry => entry.item && entry.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount || b.lastWrongAt - a.lastWrongAt);

  const reviewCandidates = mistakes
    .filter(entry => entry.reviewScore > 0)
    .sort((a, b) => b.reviewScore - a.reviewScore || b.lastWrongAt - a.lastWrongAt)
    .slice(0, 5);

  const total = state.stats?.totalQuestions || 0;
  const correct = state.stats?.correctQuestions || 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    learnedThisWeek,
    mistakes: mistakes.slice(0, 5),
    reviewCandidates,
    total,
    correct,
    accuracy
  };
}

export function unlockCardAndLearn(idiomId, state = gameState) {
  if (!idiomId) return false;
  if (!Array.isArray(state.unlockedCards)) state.unlockedCards = [];
  if (!Array.isArray(state.learnedIdioms)) state.learnedIdioms = [];
  let changed = false;
  if (!state.unlockedCards.includes(idiomId)) {
    state.unlockedCards.push(idiomId);
    changed = true;
  }
  if (!state.learnedIdioms.includes(idiomId)) {
    state.learnedIdioms.push(idiomId);
    changed = true;
  }
  if (recordLearnedIdiom(idiomId, state)) {
    changed = true;
  }
  return changed;
}


export const LEVELS_DATA = [
  { id: 1, title: "成語冒險 第 1 關", idiomIds: ["frog_well","lost_sheep","snake_feet","rabbit_tree"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 2, title: "成語冒險 第 2 關", idiomIds: ["play_cow","pull_seedling","one_cry","fox_tiger"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 3, title: "成語冒險 第 3 關", idiomIds: ["scared_bird","self_contradict","drink_source","iron_needle"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 4, title: "成語冒險 第 4 關", idiomIds: ["halfway_stop","one_arrow_two","cover_ears_steal","blind_elephant"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 5, title: "階段複習 5", idiomIds: ["frog_well","lost_sheep","snake_feet","rabbit_tree","play_cow","pull_seedling","one_cry","fox_tiger","scared_bird","self_contradict","drink_source","iron_needle","halfway_stop","one_arrow_two","cover_ears_steal","blind_elephant"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 6, title: "成語冒險 第 6 關", idiomIds: ["chest_bamboo","carve_boat","buy_box","paint_dragon"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 7, title: "成語冒險 第 7 關", idiomIds: ["cup_snake","practice_perfect","foolish_mountain","plum_thirst"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 8, title: "成語冒險 第 8 關", idiomIds: ["frog_well","scared_bird","one_cry","one_arrow_two"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 9, title: "成語冒險 第 9 關", idiomIds: ["wo_xin","zhao_san","dui_zheng","po_fu"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 10, title: "魔王挑戰 1", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第一區：動物森林", zoneTheme: "zone-1" },
  { id: 11, title: "成語冒險 第 11 關", idiomIds: ["gua_tian","pao_zhuan","hua_bing","jing_wei"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 12, title: "成語冒險 第 12 關", idiomIds: ["kua_fu","qi_ren","wan_bi","fu_jing"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 13, title: "成語冒險 第 13 關", idiomIds: ["zhi_shang","jiao_tu","he_li","shun_shou"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 14, title: "成語冒險 第 14 關", idiomIds: ["zou_ma","da_cao","zhi_sang","yu_qin"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 15, title: "階段複習 15", idiomIds: ["gua_tian","pao_zhuan","hua_bing","jing_wei","kua_fu","qi_ren","wan_bi","fu_jing","zhi_shang","jiao_tu","he_li","shun_shou","zou_ma","da_cao","zhi_sang","yu_qin"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 16, title: "成語冒險 第 16 關", idiomIds: ["lost_sheep","shun_shou","hua_di","bu_mao"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 17, title: "成語冒險 第 17 關", idiomIds: ["jiu_niu","ru_mu","ba_xian","qian_jun"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 18, title: "成語冒險 第 18 關", idiomIds: ["da_gong","xiao_xin","bu_ke","wu_yan"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 19, title: "成語冒險 第 19 關", idiomIds: ["tian_yi","ri_xin","si_mian","ru_yu"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 20, title: "魔王挑戰 2", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第二區：數字沙漠", zoneTheme: "zone-2" },
  { id: 21, title: "成語冒險 第 21 關", idiomIds: ["bai_fa","lao_ma","han_ma","hu_lun"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 22, title: "成語冒險 第 22 關", idiomIds: ["zi_zi","yi_yi","xin_xin","jin_jin"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 23, title: "成語冒險 第 23 關", idiomIds: ["xi_er","xu_xu","hai_kuo","po_jing"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 24, title: "成語冒險 第 24 關", idiomIds: ["snake_feet","paint_dragon","cup_snake","hua_bing"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 25, title: "階段複習 25", idiomIds: ["bai_fa","lao_ma","han_ma","hu_lun","zi_zi","yi_yi","xin_xin","jin_jin","xi_er","xu_xu","hai_kuo","po_jing","wen_gu","xue_zhong","jin_shang","hua_di"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 26, title: "成語冒險 第 26 關", idiomIds: ["tuo_ying","gua_mu","peng_cheng","yi_gu"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 27, title: "成語冒險 第 27 關", idiomIds: ["wang_zi","dui_da","shou_kou","ming_luo"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 28, title: "成語冒險 第 28 關", idiomIds: ["men_ting","man_zai","bu_lao","san_si"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 29, title: "成語冒險 第 29 關", idiomIds: ["wei_yu","ke_gu","ju_sha","di_shui"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 30, title: "魔王挑戰 3", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第三區：色彩星空", zoneTheme: "zone-3" },
  { id: 31, title: "成語冒險 第 31 關", idiomIds: ["li_bu","wu_wei","po_bu","le_bu"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 32, title: "成語冒險 第 32 關", idiomIds: ["rabbit_tree","jiao_tu","zhao_san","ru_mu"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 33, title: "成語冒險 第 33 關", idiomIds: ["kan_kan","ke_bu","gong_kui","qian_yan"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 34, title: "成語冒險 第 34 關", idiomIds: ["ban_xin","tong_gan","ming_lie","ge_shu"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 35, title: "階段複習 35", idiomIds: ["li_bu","wu_wei","po_bu","le_bu","bu_mao","bu_chi","jing_jing","wu_ti","kan_kan","ke_bu","gong_kui","qian_yan","ban_xin","tong_gan","ming_lie","ge_shu"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 36, title: "成語冒險 第 36 關", idiomIds: ["chui_mao","he_ai","xi_chu","chui_tou"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 37, title: "成語冒險 第 37 關", idiomIds: ["jian_ren","da_jing","miao_shou","shi_zhong"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 38, title: "成語冒險 第 38 關", idiomIds: ["cha_yan","shi_shi","zhuan_xin","lv_jian"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 39, title: "成語冒險 第 39 關", idiomIds: ["nong_qiao","zhang_kou","de_gao","xin_kuang"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 40, title: "魔王挑戰 4", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第四區：天氣峽谷", zoneTheme: "zone-4" },
  { id: 41, title: "成語冒險 第 41 關", idiomIds: ["nu_fa","xi_shi","huang_ran","xuan_ya"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 42, title: "成語冒險 第 42 關", idiomIds: ["re_shi","ba_dao","pao_tou","ti_xin"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 43, title: "成語冒險 第 43 關", idiomIds: ["ming_zhi","you_bei","gen_shen","le_ci"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 44, title: "成語冒險 第 44 關", idiomIds: ["tao_tao","man_mu","wu_di","li_zhi"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 45, title: "階段複習 45", idiomIds: ["nu_fa","xi_shi","huang_ran","xuan_ya","re_shi","ba_dao","pao_tou","ti_xin","ming_zhi","you_bei","gen_shen","le_ci","tao_tao","man_mu","wu_di","li_zhi"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 46, title: "成語冒險 第 46 關", idiomIds: ["yi_xiang","deng_feng","bai_zhe","jin_xin"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 47, title: "成語冒險 第 47 關", idiomIds: ["shi_si","jin_xiu","bu_ji","chu_ren"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 48, title: "成語冒險 第 48 關", idiomIds: ["play_cow","dui_zheng","gua_tian","jiu_niu"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 49, title: "成語冒險 第 49 關", idiomIds: ["tui_chen","zhong_wang","li_suo","wu_li"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 50, title: "魔王挑戰 5", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第五區：神話天際", zoneTheme: "zone-5" },
  { id: 51, title: "成語冒險 第 51 關", idiomIds: ["ba_shan","kai_men","shun_qi","huan_ran"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 52, title: "成語冒險 第 52 關", idiomIds: ["sui_ji","ju_shi","feng_yi","zhuan_wei"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 53, title: "成語冒險 第 53 關", idiomIds: ["huan_tian","jiao_bing","jing_tian","ti_tie"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 54, title: "成語冒險 第 54 關", idiomIds: ["luo_yi","zan_bu","yi_zhen","da_qi"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 55, title: "階段複習 55", idiomIds: ["ba_shan","kai_men","shun_qi","huan_ran","sui_ji","ju_shi","feng_yi","zhuan_wei","huan_tian","jiao_bing","jing_tian","ti_tie","luo_yi","zan_bu","yi_zhen","da_qi"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 56, title: "成語冒險 第 56 關", idiomIds: ["pull_seedling","jian_ren","bu_ke","zi_zi"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 57, title: "成語冒險 第 57 關", idiomIds: ["bai_zhi","yin_xiao","you_kou","zi_bao"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 58, title: "成語冒險 第 58 關", idiomIds: ["jian_yi","che_shui","qi_xing","gu_zhu"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 59, title: "成語冒險 第 59 關", idiomIds: ["xiao_rong","qi_xiang","po_ti","ji_yi"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 60, title: "魔王挑戰 6", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第六區：植物迷宮", zoneTheme: "zone-6" },
  { id: 61, title: "成語冒險 第 61 關", idiomIds: ["jia_xi","cu_xin","yi_kou","mo_ming"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 62, title: "成語冒險 第 62 關", idiomIds: ["tuo_tai","lv_shi","zi_qi","yan_xing"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 63, title: "成語冒險 第 63 關", idiomIds: ["di_da","di_lao","di_dong","ren_shan"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 64, title: "成語冒險 第 64 關", idiomIds: ["fox_tiger","jia_xi","zhen_xiang_da_bai","guang_ming_zheng_da"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 65, title: "階段複習 65", idiomIds: ["jia_xi","cu_xin","yi_kou","mo_ming","tuo_tai","lv_shi","zi_qi","yan_xing","di_da","di_lao","di_dong","ren_shan","ren_jie","ren_zhi_chang","shan_qing","shan_meng"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 66, title: "成語冒險 第 66 關", idiomIds: ["shan_qiong","xin_chen","xin_guan","ma_dao"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 67, title: "成語冒險 第 67 關", idiomIds: ["ma_bu","hua_hao","hua_yan","gui_xin"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 68, title: "成語冒險 第 68 關", idiomIds: ["hai_na","shui_luo","qi_ji","xin_ping"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 69, title: "成語冒險 第 69 關", idiomIds: ["long_fei","zu_zhi","dan_xiao","bo_gu"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 70, title: "魔王挑戰 7", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第七區：人體奧秘", zoneTheme: "zone-7" },
  { id: 71, title: "成語冒險 第 71 關", idiomIds: ["san_gu_mao_lu","si_kong_jian_guan","ye_lang_zi_da","liu_an_hua_ming"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 72, title: "成語冒險 第 72 關", idiomIds: ["self_contradict","bird_clam","gua_mu","ba_dao"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 73, title: "成語冒險 第 73 關", idiomIds: ["guang_ming_zheng_da","xin_zhi_du_ming","jing_yi_qiu_jing","yi_wang_wu_qian"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 74, title: "成語冒險 第 74 關", idiomIds: ["yu_yin_rao_liang","le_ji_sheng_bei","an_bu_dang_che","bing_gui_shen_su"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 75, title: "階段複習 75", idiomIds: ["san_gu_mao_lu","si_kong_jian_guan","ye_lang_zi_da","liu_an_hua_ming","zhen_xiang_da_bai","yi_ju_liang_de","kai_juan_you_yi","qing_chu_yu_lan","guang_ming_zheng_da","xin_zhi_du_ming","jing_yi_qiu_jing","yi_wang_wu_qian","yu_yin_rao_liang","le_ji_sheng_bei","an_bu_dang_che","bing_gui_shen_su"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 76, title: "成語冒險 第 76 關", idiomIds: ["cao_chuan_jie_jian","cheng_men_li_xue","dao_bei_ru_liu","dong_shan_zai_qi"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 77, title: "成語冒險 第 77 關", idiomIds: ["er_mu_yi_xin","fen_bi_ji_shu","hai_shi_shan_meng","liu_an_hua_ming"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 78, title: "成語冒險 第 78 關", idiomIds: ["bei_shui_yi_zhan","luo_jing_xia_shi"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 79, title: "成語冒險 第 79 關", idiomIds: ["li_yin_wai_he","zhe_fen_xia_dui","yua_mu_jin_zhe","wa_min_cha_zao"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 80, title: "魔王挑戰 8", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第八區：方位遺跡", zoneTheme: "zone-8" },
  { id: 81, title: "成語冒險 第 81 關", idiomIds: ["you_bei","gen_shen","le_ci","tao_tao"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 82, title: "成語冒險 第 82 關", idiomIds: ["nia_yu_hua_xia","dun_pai_jia_gu","yua_yua_bu_jue","fei_qin_wan_shi"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 83, title: "成語冒險 第 83 關", idiomIds: ["lin_she_xia_lia","xia_zhe_ji_xia","zhu_bao_pin_an","jia_ba_nu_zha"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 84, title: "成語冒險 第 84 關", idiomIds: ["zhu_lia_bi_he","jin_cai_jue_lun","yin_yin_chu_chu","qia_duo_tia_gon"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 85, title: "階段複習 85", idiomIds: ["you_bei","gen_shen","le_ci","tao_tao","nia_yu_hua_xia","dun_pai_jia_gu","yua_yua_bu_jue","fei_qin_wan_shi","lin_she_xia_lia","xia_zhe_ji_xia","zhu_bao_pin_an","jia_ba_nu_zha","zhu_lia_bi_he","jin_cai_jue_lun","yin_yin_chu_chu","qia_duo_tia_gon"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 86, title: "成語冒險 第 86 關", idiomIds: ["ke_lu_ben_qua","fu_zao_hen_ji","zhe_xia_kon_hou","yao_dao_bin_chu"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 87, title: "成語冒險 第 87 關", idiomIds: ["zho_ji_xia_pei","xia_bi_che_zha","yu_jie_bin_qin","ji_ke_jia_po"], mode: "bubble", desc: "點擊泡泡選出答案。", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 88, title: "成語冒險 第 88 關", idiomIds: ["drink_source","hun_shui","blind_elephant","qi_ren"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 89, title: "成語冒險 第 89 關", idiomIds: ["man_mu","wu_di","li_zhi","yi_xiang"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 90, title: "魔王挑戰 9", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第九區：時光迴廊", zoneTheme: "zone-9" },
  { id: 91, title: "成語冒險 第 91 關", idiomIds: ["xin_huo_xia_chu","yu_shu_xia_de","ke_mu_tin_li","gon_wu_bu_ke"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 92, title: "成語冒險 第 92 關", idiomIds: ["mao_sui_zi_jia","fen_mia_bi_zhe","yi_yi_xia_xin","yi_lun_fen_fen"], mode: "typo", desc: "糾出文句中的錯字！", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 93, title: "成語冒險 第 93 關", idiomIds: ["tu_jin_min_que","lao_ku_gon_gao","shui_luo","qi_ji"], mode: "radical", desc: "拼裝部首字完成挑戰。", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 94, title: "成語冒險 第 94 關", idiomIds: ["zao_li_she_xin","jua_nia_zhi_hua","ron_hua_fu_gui","wei_ton_jia_la"], mode: "story", desc: "在故事劇場中選出合適成語。", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 95, title: "階段複習 95", idiomIds: ["xin_huo_xia_chu","yu_shu_xia_de","ke_mu_tin_li","gon_wu_bu_ke","mao_sui_zi_jia","fen_mia_bi_zhe","yi_yi_xia_xin","yi_lun_fen_fen","se_cai_bin_fen","zho_liu_di_zhu","tu_jin_min_que","lao_ku_gon_gao","zao_li_she_xin","jua_nia_zhi_hua","ron_hua_fu_gui","wei_ton_jia_la"], mode: "match", desc: "綜合記憶配對，挑戰對成語釋義的熟練度！", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 96, title: "成語冒險 第 96 關", idiomIds: ["iron_needle","yi_zhen","qian_jun","yi_gu"], mode: "crossword", desc: "動腦解開交叉填字。", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 97, title: "成語冒險 第 97 關", idiomIds: ["deng_feng","bai_zhe","jin_xin","shi_si"], mode: "image", desc: "觀察 3D 插圖，拼出成語！", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 98, title: "成語冒險 第 98 關", idiomIds: ["miu_qia_xin_si","ta_jia_min_den","shi_po_tia_jin","zhi_si_bu_yu"], mode: "fill", desc: "在句子中填入正確的成語字詞。", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 99, title: "成語冒險 第 99 關", idiomIds: ["dai_ren_jie_wu","shu_dao_nan_xin","wen_xin_wu_kui","tia_li_fen_min"], mode: "simchar", desc: "分辨形近字找出正確寫法。", isBoss: false, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" },
  { id: 100, title: "魔王挑戰 10", idiomIds: [], mode: "time", desc: "極限魔王戰！在 60 秒內連續答對 5 題來擊敗魔王！", isBoss: true, zoneTitle: "第十區：成語大師城", zoneTheme: "zone-10" }
];

export let gameState = {
  xp: 0,
  level: 1,
  rank: "童生",
  equippedTitle: "成語小達人",
  learnedIdioms: [],
  unlockedAchievements: [],

  currentAdventureLevel: 1,
  levelStars: {},
  isAdventureMode: false,
  isMapEvent: false,
  mapEvent: null,
  currentPlayingLevel: null,

  energy: 0,
  drawTickets: 0,
  intimacyLevel: 1,
  intimacyXP: 0,
  intimacyPerks: {
    date: "",
    dailyGiftClaimed: false,
    interactionBonusCount: 0,
    hintShieldUsed: false
  },
  unlockedCards: [],
  claimedSets: [],

  lastCheckInDate: "",
  checkInStreak: 0,
  dailyMissions: null,
  comboStreak: 0,
  bestCombo: 0,
  socialRewards: {
    shareEnergyClaimed: false,
    ratingEnergyClaimed: false
  },
  learningLog: {
    learnedAt: {},
    wrongById: {},
    correctById: {}
  },
  dailyAdDraws: { date: "", count: 0 },

  stats: {
    totalQuestions: 0,
    correctQuestions: 0,
    shapeXP: 0,
    meaningXP: 0,
    assocXP: 0,
    reactionXP: 0,
    memoryXP: 0
  },

  currentMode: "",
  currentQuestionIndex: 0,
  currentRoundQuestions: [],
  roundAccuracy: true,
  roundTotalQuestions: 0,
  roundCorrectAnswers: 0,

  selectedChars: [],

  flippedCards: [],
  matchedPairs: 0,
  totalPairs: 4,

  timeRemaining: 0,
  timerInterval: null,
  timeCorrectCount: 0,
  timeTotalScore: 0
};

export const ACHIEVEMENTS_LIST = [
  {
    id: "first_steps",
    title: "初露鋒芒 🧭",
    desc: "完成任意模式的一輪挑戰",
    check: (state, roundSuccess) => roundSuccess,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "perfect_round",
    title: "十全十美 🌟",
    desc: "在一輪挑戰中獲得 100% 正確",
    check: (state, roundSuccess, accuracy) => roundSuccess && accuracy === 100,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "rank_xiucai",
    title: "秀才及第 📜",
    desc: "經驗值提升，等級達到 秀才 (Lv.2)",
    check: (state) => state.level >= 2,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "rank_juren",
    title: "高中舉人 🎓",
    desc: "經驗值提升，等級達到 舉人 (Lv.3)",
    check: (state) => state.level >= 3,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "rank_jinshi",
    title: "金榜進士 🥇",
    desc: "經驗值提升，等級達到 進士 (Lv.4)",
    check: (state) => state.level >= 4,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "rank_zhuangyuan",
    title: "獨占鰲頭 👑",
    desc: "經驗值提升，等級達到 狀元 (Lv.5)",
    check: (state) => state.level >= 5,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "rank_hanlin",
    title: "入主翰林 🖋️",
    desc: "經驗值提升，等級達到 翰林 (Lv.12)",
    check: (state) => state.level >= 12,
    reward: { type: 'drawTickets', amount: 1 }
  },
  {
    id: "rank_wensheng",
    title: "一代文聖 🌟👑",
    desc: "經驗值提升，最高境界，等級達到 文聖 (Lv.16)",
    check: (state) => state.level >= 16,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "idiom_collector",
    title: "初入成語林 📚",
    desc: "學會資料庫中至少 25 個成語",
    target: 25,
    progress: (state) => getLearnedIdiomCount(state),
    check: (state) => getLearnedIdiomCount(state) >= 25,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "idiom_grandmaster",
    title: "成語熟手 🏆",
    desc: "學會資料庫中至少 50 個成語",
    target: 50,
    progress: (state) => getLearnedIdiomCount(state),
    check: (state) => getLearnedIdiomCount(state) >= 50,
    reward: { type: 'drawTickets', amount: 1 }
  },
  {
    id: "idiom_scholar",
    title: "學富五車 🎒",
    desc: "學會資料庫中至少 100 個成語",
    target: 100,
    progress: (state) => getLearnedIdiomCount(state),
    check: (state) => getLearnedIdiomCount(state) >= 100,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "idiom_master",
    title: "出口成章 ✍️",
    desc: "學會資料庫中至少 150 個成語",
    target: 150,
    progress: (state) => getLearnedIdiomCount(state),
    check: (state) => getLearnedIdiomCount(state) >= 150,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "idiom_sage",
    title: "一代宗師 🌌",
    desc: "學會資料庫中的全部成語",
    target: () => getUniqueIdiomCount(),
    progress: (state) => getLearnedIdiomCount(state),
    check: (state) => getLearnedIdiomCount(state) >= getUniqueIdiomCount(),
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "level_road_5",
    title: "闖關小將 🗺️",
    desc: "冒險地圖中通過 5 個關卡",
    target: 5,
    progress: (state) => Object.values(state.levelStars || {}).filter(stars => stars > 0).length,
    check: (state) => Object.values(state.levelStars || {}).filter(stars => stars > 0).length >= 5,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "level_road_10",
    title: "一路高歌 🚩",
    desc: "冒險地圖中通過 10 個關卡",
    target: 10,
    progress: (state) => Object.values(state.levelStars || {}).filter(stars => stars > 0).length,
    check: (state) => Object.values(state.levelStars || {}).filter(stars => stars > 0).length >= 10,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "level_road_15",
    title: "全關制霸 🐉",
    desc: "通過冒險地圖全部 15 個關卡",
    target: 15,
    progress: (state) => Object.values(state.levelStars || {}).filter(stars => stars > 0).length,
    check: (state) => Object.values(state.levelStars || {}).filter(stars => stars > 0).length >= 15,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "star_hunter_15",
    title: "星光獵人 ⭐",
    desc: "冒險關卡累積獲得 15 顆星",
    target: 15,
    progress: (state) => Object.values(state.levelStars || {}).reduce((sum, stars) => sum + stars, 0),
    check: (state) => Object.values(state.levelStars || {}).reduce((sum, stars) => sum + stars, 0) >= 15,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "star_master_30",
    title: "滿天星斗 🌠",
    desc: "冒險關卡累積獲得 30 顆星",
    target: 30,
    progress: (state) => Object.values(state.levelStars || {}).reduce((sum, stars) => sum + stars, 0),
    check: (state) => Object.values(state.levelStars || {}).reduce((sum, stars) => sum + stars, 0) >= 30,
    reward: { type: 'drawTickets', amount: 1 }
  },
  {
    id: "question_50",
    title: "勤學不倦 ✏️",
    desc: "累積作答 50 題",
    target: 50,
    progress: (state) => state.stats?.totalQuestions || 0,
    check: (state) => (state.stats?.totalQuestions || 0) >= 50,
    reward: { type: 'drawTickets', amount: 1 }
  },
  {
    id: "correct_30",
    title: "百步穿楊 🎯",
    desc: "累積答對 30 題",
    target: 30,
    progress: (state) => state.stats?.correctQuestions || 0,
    check: (state) => (state.stats?.correctQuestions || 0) >= 30,
    reward: { type: 'drawTickets', amount: 1 }
  },
  {
    id: "shape_expert",
    title: "字形偵探 🔍",
    desc: "字形辨析能力達到 100",
    target: 100,
    progress: (state) => getAbilityScore(state.stats?.shapeXP || 0),
    check: (state) => getAbilityScore(state.stats?.shapeXP || 0) >= 100,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "meaning_expert",
    title: "詞意通達 📖",
    desc: "詞意理解能力達到 100",
    target: 100,
    progress: (state) => getAbilityScore(state.stats?.meaningXP || 0),
    check: (state) => getAbilityScore(state.stats?.meaningXP || 0) >= 100,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "assoc_expert",
    title: "圖文聯想家 🖼️",
    desc: "圖文聯想能力達到 100",
    target: 100,
    progress: (state) => getAbilityScore(state.stats?.assocXP || 0),
    check: (state) => getAbilityScore(state.stats?.assocXP || 0) >= 100,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "reaction_expert",
    title: "快手書生 ⚡",
    desc: "反應力能力達到 100",
    target: 100,
    progress: (state) => getAbilityScore(state.stats?.reactionXP || 0),
    check: (state) => getAbilityScore(state.stats?.reactionXP || 0) >= 100,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "memory_expert",
    title: "記憶宮殿 🃏",
    desc: "記憶聯結能力達到 100",
    target: 100,
    progress: (state) => getAbilityScore(state.stats?.memoryXP || 0),
    check: (state) => getAbilityScore(state.stats?.memoryXP || 0) >= 100,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "card_collector_10",
    title: "閃卡收藏家 💎",
    desc: "收集 25 張成語閃卡",
    target: 25,
    progress: (state) => getUnlockedCardCount(state),
    check: (state) => getUnlockedCardCount(state) >= 25,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "card_collector_50",
    title: "閃卡獵人 ✨",
    desc: "收集 50 張成語閃卡",
    target: 50,
    progress: (state) => getUnlockedCardCount(state),
    check: (state) => getUnlockedCardCount(state) >= 50,
    reward: { type: 'drawTickets', amount: 1 }
  },
  {
    id: "card_collector_100",
    title: "百卡藏書家 🃏",
    desc: "收集 100 張成語閃卡",
    target: 100,
    progress: (state) => getUnlockedCardCount(state),
    check: (state) => getUnlockedCardCount(state) >= 100,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "card_collector_150",
    title: "閃卡大師 💠",
    desc: "收集 150 張成語閃卡",
    target: 150,
    progress: (state) => getUnlockedCardCount(state),
    check: (state) => getUnlockedCardCount(state) >= 150,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: "card_collector_all",
    title: "全卡典藏王 👑",
    desc: "收集資料庫中的全部成語閃卡",
    target: () => getUniqueIdiomCount(),
    progress: (state) => getUnlockedCardCount(state),
    check: (state) => getUnlockedCardCount(state) >= getUniqueIdiomCount(),
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "card_set_3",
    title: "套卡新星 🧩",
    desc: "完成並領取 3 組主題套卡",
    target: 3,
    progress: (state) => getClaimedCardSetCount(state),
    check: (state) => getClaimedCardSetCount(state) >= 3,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "card_set_6",
    title: "主題收藏家 🗂️",
    desc: "完成並領取 6 組主題套卡",
    target: 6,
    progress: (state) => getClaimedCardSetCount(state),
    check: (state) => getClaimedCardSetCount(state) >= 6,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "card_set_10",
    title: "十全套卡王 🏅",
    desc: "完成並領取 10 組主題套卡",
    target: 10,
    progress: (state) => getClaimedCardSetCount(state),
    check: (state) => getClaimedCardSetCount(state) >= 10,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "pet_friend_8",
    title: "知心夥伴 🏡",
    desc: "小屋親密度達到 Lv.8",
    target: 8,
    progress: (state) => state.intimacyLevel || 1,
    check: (state) => (state.intimacyLevel || 1) >= 8,
    reward: { type: 'energy', amount: 50 }
  },
  {
    id: "dragon_bond",
    title: "神龍羈絆 🐉",
    desc: "小屋親密度達到 Lv.16",
    target: 16,
    progress: (state) => state.intimacyLevel || 1,
    check: (state) => (state.intimacyLevel || 1) >= 16,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: 'night_owl',
    title: '挑燈夜戰 🦉',
    desc: '???',
    hiddenDesc: '於深夜 (00:00 - 04:00) 完成一輪挑戰',
    isHidden: true,
    check: (state, roundSuccess) => {
      const h = new Date().getHours();
      return roundSuccess && (h >= 0 && h < 4);
    },
    reward: { type: 'drawTickets', amount: 1 }
  },
  {
    id: 'extreme_rescue',
    title: '極限救援 ⏱️',
    desc: '???',
    hiddenDesc: '在限時挑戰賽剩下不到 3 秒時成功答對題目',
    isHidden: true,
    check: (state, roundSuccess, accuracy, isExtremeRescue) => isExtremeRescue,
    reward: { type: 'drawTickets', amount: 2 }
  },
  {
    id: 'persistence_7',
    title: '持之以恆 📅',
    desc: '連續登入超過 7 天',
    target: 7,
    progress: (state) => state.checkInStreak || 0,
    check: (state) => (state.checkInStreak || 0) >= 7,
    reward: { type: 'energy', amount: 200 }
  },
  {
    id: 'idiom_fanatic',
    title: '成語狂熱者 🚀',
    desc: '累積答題數量超過 500 題',
    target: 500,
    progress: (state) => state.stats?.totalQuestions || 0,
    check: (state) => (state.stats?.totalQuestions || 0) >= 500,
    reward: { type: 'drawTickets', amount: 3 }
  },
  {
    id: 'combo_master_20',
    title: '連擊大師 ⚡',
    desc: '最高連擊數 (Combo) 達到 20 次',
    target: 20,
    progress: (state) => state.bestCombo || 0,
    check: (state) => (state.bestCombo || 0) >= 20,
    reward: { type: 'energy', amount: 300 }
  },
  {
    id: 'card_tycoon_20',
    title: '閃卡大亨 🃏',
    desc: '收集超過 20 張不同的閃卡',
    target: 20,
    progress: (state) => (state.unlockedCards || []).length,
    check: (state) => (state.unlockedCards || []).length >= 20,
    reward: { type: 'drawTickets', amount: 3 }
  }
];

export function getRankTitle(level) {
  if (level >= 16) return "文聖 🌟👑";
  if (level === 15) return "大學士 🏛️👑";
  if (level === 14) return "尚書 🛡️";
  if (level === 13) return "侍郎 💼";
  if (level === 12) return "翰林 🖋️";
  if (level === 11) return "狀元 👑";
  if (level === 10) return "榜眼 🥈";
  if (level === 9) return "探花 🥉";
  if (level === 8) return "進士 🥇";
  if (level === 7) return "會元 ⚖️";
  if (level === 6) return "舉人 🎓";
  if (level === 5) return "解元 🏹";
  if (level === 4) return "貢生 🏛️";
  if (level === 3) return "秀才 📜";
  if (level === 2) return "案首 📝";
  return "童生 🎒";
}

export function getNextLevelXP(level) {
  if (level <= 5) return level * 100;
  if (level <= 10) return 500 + (level - 5) * 150;
  return 1250 + (level - 10) * 200;
}

export const GACHA_SINGLE_TICKET_COST = 1;
export const GACHA_TEN_TICKET_COST = 9;
export const STARTER_DRAW_TICKETS = 3;

export function addDrawTickets(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  gameState.drawTickets = Math.max(0, (gameState.drawTickets || 0) + Math.floor(amount));
  return Math.floor(amount);
}

export function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ensureIntimacyPerks(state = gameState) {
  const today = getTodayKey();
  if (!state.intimacyPerks || typeof state.intimacyPerks !== "object" || state.intimacyPerks.date !== today) {
    state.intimacyPerks = {
      date: today,
      dailyGiftClaimed: false,
      interactionBonusCount: 0,
      hintShieldUsed: false
    };
  } else {
    state.intimacyPerks = {
      date: today,
      dailyGiftClaimed: Boolean(state.intimacyPerks.dailyGiftClaimed),
      interactionBonusCount: Number.isFinite(state.intimacyPerks.interactionBonusCount) ? state.intimacyPerks.interactionBonusCount : 0,
      hintShieldUsed: Boolean(state.intimacyPerks.hintShieldUsed)
    };
  }
  return state.intimacyPerks;
}

export function getIntimacyDailyGift(level = gameState.intimacyLevel) {
  if (level >= 16) return { energy: 60, tickets: 1 };
  if (level >= 12) return { energy: 45, tickets: 1 };
  if (level >= 8) return { energy: 35, tickets: 0 };
  if (level >= 5) return { energy: 25, tickets: 0 };
  if (level >= 3) return { energy: 15, tickets: 0 };
  return { energy: 0, tickets: 0 };
}

export function claimIntimacyDailyGift() {
  const perks = ensureIntimacyPerks();
  const gift = getIntimacyDailyGift();
  if (perks.dailyGiftClaimed || (gift.energy <= 0 && gift.tickets <= 0)) return null;
  perks.dailyGiftClaimed = true;
  gameState.energy += gift.energy;
  if (gift.tickets > 0) addDrawTickets(gift.tickets);
  return gift;
}

export function getIntimacyXpBonusRate(level = gameState.intimacyLevel) {
  if (level >= 16) return 0.12;
  if (level >= 12) return 0.08;
  if (level >= 8) return 0.05;
  if (level >= 5) return 0.03;
  return 0;
}

export function applyIntimacyXpBonus(baseXP) {
  const safeBase = Math.max(0, Math.floor(baseXP || 0));
  const rate = getIntimacyXpBonusRate();
  const bonusXP = Math.floor(safeBase * rate);
  return {
    baseXP: safeBase,
    bonusXP,
    totalXP: safeBase + bonusXP,
    rate
  };
}

export function canUseIntimacyHintShield() {
  const perks = ensureIntimacyPerks();
  return (gameState.intimacyLevel || 1) >= 5 && !perks.hintShieldUsed;
}

export function useIntimacyHintShield() {
  if (!canUseIntimacyHintShield()) return false;
  gameState.intimacyPerks.hintShieldUsed = true;
  return true;
}

export function maybeGrantIntimacyInteractionBonus(action = "touch") {
  const level = gameState.intimacyLevel || 1;
  if (level < 3) return null;
  const perks = ensureIntimacyPerks();
  const dailyLimit = level >= 16 ? 4 : level >= 8 ? 3 : 2;
  if (perks.interactionBonusCount >= dailyLimit) return null;

  const chance = action === "feed"
    ? (level >= 12 ? 0.34 : 0.26)
    : (level >= 12 ? 0.24 : 0.18);
  if (Math.random() >= chance) return null;

  perks.interactionBonusCount++;
  const energy = level >= 16 ? 14 : level >= 8 ? 9 : 5;
  const tickets = action === "feed" && level >= 12 && Math.random() < (level >= 16 ? 0.22 : 0.14) ? 1 : 0;
  gameState.energy += energy;
  if (tickets > 0) addDrawTickets(tickets);
  return { energy, tickets };
}

export function exportGameSave() {
  return {
    schemaVersion: 1,
    updatedAt: gameState.saveUpdatedAt || Date.now(),
    xp: gameState.xp,
    level: gameState.level,
    rank: gameState.rank,
    equippedTitle: gameState.equippedTitle,
    learnedIdioms: gameState.learnedIdioms,
    unlockedAchievements: gameState.unlockedAchievements,
    currentAdventureLevel: gameState.currentAdventureLevel,
    levelStars: gameState.levelStars,
    energy: gameState.energy,
    drawTickets: gameState.drawTickets,
    intimacyLevel: gameState.intimacyLevel,
    intimacyXP: gameState.intimacyXP,
    intimacyPerks: gameState.intimacyPerks,
    unlockedCards: gameState.unlockedCards,
    claimedSets: gameState.claimedSets,
    lastCheckInDate: gameState.lastCheckInDate,
    checkInStreak: gameState.checkInStreak,
    dailyMissions: gameState.dailyMissions,
    dailyAdDraws: gameState.dailyAdDraws,
    bestCombo: gameState.bestCombo,
    socialRewards: gameState.socialRewards,
    learningLog: gameState.learningLog,
    stats: gameState.stats
  };
}

function applyGameSave(save) {
  if (!save || typeof save !== "object") return;

  if (Number.isFinite(save.xp)) gameState.xp = save.xp;
  if (Number.isFinite(save.level)) {
    gameState.level = save.level;
    gameState.rank = getRankTitle(gameState.level);
  }
  if (typeof save.equippedTitle === "string") gameState.equippedTitle = save.equippedTitle;
  if (Array.isArray(save.learnedIdioms)) gameState.learnedIdioms = save.learnedIdioms;
  if (Array.isArray(save.unlockedAchievements)) gameState.unlockedAchievements = save.unlockedAchievements;
  if (Number.isFinite(save.currentAdventureLevel)) gameState.currentAdventureLevel = save.currentAdventureLevel;
  if (save.levelStars && typeof save.levelStars === "object") gameState.levelStars = save.levelStars;
  if (Number.isFinite(save.energy)) gameState.energy = save.energy;
  if (Number.isFinite(save.drawTickets)) gameState.drawTickets = save.drawTickets;
  if (Number.isFinite(save.intimacyLevel)) gameState.intimacyLevel = save.intimacyLevel;
  if (Number.isFinite(save.intimacyXP)) gameState.intimacyXP = save.intimacyXP;
  if (save.intimacyPerks && typeof save.intimacyPerks === "object") {
    gameState.intimacyPerks = {
      ...gameState.intimacyPerks,
      ...save.intimacyPerks
    };
    ensureIntimacyPerks(gameState);
  }
  if (Array.isArray(save.unlockedCards)) gameState.unlockedCards = save.unlockedCards;
  if (Array.isArray(save.claimedSets)) gameState.claimedSets = save.claimedSets;
  if (typeof save.lastCheckInDate === "string") gameState.lastCheckInDate = save.lastCheckInDate;
  if (Number.isFinite(save.checkInStreak)) gameState.checkInStreak = save.checkInStreak;
  if (save.dailyMissions && typeof save.dailyMissions === "object") gameState.dailyMissions = save.dailyMissions;
  if (Number.isFinite(save.bestCombo)) gameState.bestCombo = save.bestCombo;
  if (save.socialRewards && typeof save.socialRewards === "object") {
    gameState.socialRewards = {
      ...gameState.socialRewards,
      ...save.socialRewards
    };
  }
  if (save.dailyAdDraws && typeof save.dailyAdDraws === "object") {
    gameState.dailyAdDraws = {
      ...gameState.dailyAdDraws,
      ...save.dailyAdDraws
    };
  }
  if (save.learningLog && typeof save.learningLog === "object") {
    gameState.learningLog = {
      ...gameState.learningLog,
      ...save.learningLog
    };
    normalizeLearningLog(gameState);
  }
  if (save.stats && typeof save.stats === "object") gameState.stats = save.stats;
  if (Number.isFinite(save.updatedAt)) gameState.saveUpdatedAt = save.updatedAt;
  syncLearnedIdiomsFromCards();
}

function getSaveTimestamp(save) {
  if (!save || typeof save !== "object") return 0;
  return Number.isFinite(save.updatedAt) ? save.updatedAt : 0;
}

function getIntimacyProgressScore(save) {
  if (!save || typeof save !== "object") return 0;
  const level = Number.isFinite(save.intimacyLevel) ? Math.max(1, save.intimacyLevel) : 1;
  const xp = Number.isFinite(save.intimacyXP) ? Math.max(0, save.intimacyXP) : 0;
  return ((level - 1) * level * 20) + xp;
}

function maxFiniteNumber(leftValue, rightValue, fallback = 0) {
  const left = Number.isFinite(leftValue) ? leftValue : fallback;
  const right = Number.isFinite(rightValue) ? rightValue : fallback;
  return Math.max(left, right);
}

function getObjectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function mergeDatedCounterState(localState, cloudState) {
  const local = getObjectValue(localState);
  const cloud = getObjectValue(cloudState);
  const localDate = typeof local.date === "string" ? local.date : "";
  const cloudDate = typeof cloud.date === "string" ? cloud.date : "";

  if (localDate && cloudDate && localDate !== cloudDate) {
    return localDate > cloudDate ? localState : cloudState;
  }

  const date = localDate || cloudDate;
  return {
    ...local,
    ...cloud,
    date,
    count: maxFiniteNumber(local.count, cloud.count, 0)
  };
}

function mergeIntimacyPerks(localPerks, cloudPerks) {
  const local = getObjectValue(localPerks);
  const cloud = getObjectValue(cloudPerks);
  const localDate = typeof local.date === "string" ? local.date : "";
  const cloudDate = typeof cloud.date === "string" ? cloud.date : "";

  if (localDate && cloudDate && localDate !== cloudDate) {
    return localDate > cloudDate ? localPerks : cloudPerks;
  }

  return {
    ...local,
    ...cloud,
    date: localDate || cloudDate,
    dailyGiftClaimed: Boolean(local.dailyGiftClaimed || cloud.dailyGiftClaimed),
    interactionBonusCount: maxFiniteNumber(local.interactionBonusCount, cloud.interactionBonusCount, 0),
    hintShieldUsed: Boolean(local.hintShieldUsed || cloud.hintShieldUsed)
  };
}

function mergeDailyMissions(localMissions, cloudMissions) {
  const local = getObjectValue(localMissions);
  const cloud = getObjectValue(cloudMissions);
  const localDate = typeof local.date === "string" ? local.date : "";
  const cloudDate = typeof cloud.date === "string" ? cloud.date : "";

  if (localDate && cloudDate && localDate !== cloudDate) {
    return localDate > cloudDate ? localMissions : cloudMissions;
  }

  const localItems = getObjectValue(local.items);
  const cloudItems = getObjectValue(cloud.items);
  const mergedItems = {};
  const itemIds = new Set([...Object.keys(localItems), ...Object.keys(cloudItems)]);

  itemIds.forEach((id) => {
    const localItem = getObjectValue(localItems[id]);
    const cloudItem = getObjectValue(cloudItems[id]);
    mergedItems[id] = {
      ...localItem,
      ...cloudItem,
      progress: maxFiniteNumber(localItem.progress, cloudItem.progress, 0),
      claimed: Boolean(localItem.claimed || cloudItem.claimed)
    };
  });

  return {
    ...local,
    ...cloud,
    date: localDate || cloudDate,
    items: mergedItems
  };
}

function mergeProgressBooleans(localState, cloudState) {
  const local = getObjectValue(localState);
  const cloud = getObjectValue(cloudState);
  const merged = { ...local, ...cloud };
  const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);

  keys.forEach((key) => {
    if (typeof local[key] === "boolean" || typeof cloud[key] === "boolean") {
      merged[key] = Boolean(local[key] || cloud[key]);
    } else if (Number.isFinite(local[key]) || Number.isFinite(cloud[key])) {
      merged[key] = maxFiniteNumber(local[key], cloud[key], 0);
    }
  });

  return merged;
}

function normalizeCheckInStreakDay(streak, fallback = 0) {
  const numeric = Number.isFinite(streak) ? Math.floor(streak) : 0;
  if (numeric <= 0) return fallback;
  return ((numeric - 1) % CHECKIN_CYCLE_DAYS) + 1;
}

function getDaysBetweenDateStrings(fromDateStr, toDateStr) {
  if (!fromDateStr || !toDateStr) return null;
  const fromDate = new Date(fromDateStr);
  const toDate = new Date(toDateStr);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);
  return Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
}

function getCheckInSaveState(save) {
  return {
    date: typeof save?.lastCheckInDate === "string" ? save.lastCheckInDate : "",
    streak: normalizeCheckInStreakDay(save?.checkInStreak, 0)
  };
}

function mergeCheckInSaveState(localSave, cloudSave) {
  const local = getCheckInSaveState(localSave);
  const cloud = getCheckInSaveState(cloudSave);

  if (!local.date) return cloud;
  if (!cloud.date) return local;

  if (local.date === cloud.date) {
    return {
      date: local.date,
      streak: Math.max(local.streak, cloud.streak)
    };
  }

  const newer = cloud.date > local.date ? cloud : local;
  const older = newer === cloud ? local : cloud;
  if (newer.streak > 0) return newer;

  const daysDiff = getDaysBetweenDateStrings(older.date, newer.date);
  if (daysDiff === 1 && older.streak > 0) {
    return {
      date: newer.date,
      streak: (older.streak % CHECKIN_CYCLE_DAYS) + 1
    };
  }

  return older.streak > 0 ? older : newer;
}

function getSaveProgressScore(save) {
  if (!save || typeof save !== "object") return 0;
  const levelStars = save.levelStars && typeof save.levelStars === "object" ? save.levelStars : {};
  const stats = save.stats && typeof save.stats === "object" ? save.stats : {};

  return [
    Number.isFinite(save.xp) ? save.xp : 0,
    Number.isFinite(save.level) ? Math.max(0, save.level - 1) * 100 : 0,
    Array.isArray(save.learnedIdioms) ? save.learnedIdioms.length * 50 : 0,
    Array.isArray(save.unlockedAchievements) ? save.unlockedAchievements.length * 40 : 0,
    Number.isFinite(save.currentAdventureLevel) ? Math.max(0, save.currentAdventureLevel - 1) * 60 : 0,
    Object.values(levelStars).reduce((sum, stars) => sum + (Number.isFinite(stars) ? stars : 0), 0) * 30,
    Number.isFinite(save.energy) ? save.energy : 0,
    Number.isFinite(save.drawTickets) ? save.drawTickets * 120 : 0,
    getIntimacyProgressScore(save),
    save.intimacyPerks?.dailyGiftClaimed ? 10 : 0,
    Number.isFinite(save.intimacyPerks?.interactionBonusCount) ? save.intimacyPerks.interactionBonusCount * 5 : 0,
    Array.isArray(save.unlockedCards) ? save.unlockedCards.length * 35 : 0,
    Array.isArray(save.claimedSets) ? save.claimedSets.length * 35 : 0,
    save.socialRewards?.shareEnergyClaimed ? 20 : 0,
    save.socialRewards?.ratingEnergyClaimed ? 20 : 0,
    save.dailyAdDraws?.count ? save.dailyAdDraws.count * 10 : 0,
    Number.isFinite(save.checkInStreak) ? save.checkInStreak * 20 : 0,
    Number.isFinite(stats.totalQuestions) ? stats.totalQuestions * 5 : 0,
    Number.isFinite(stats.correctQuestions) ? stats.correctQuestions * 10 : 0
  ].reduce((sum, value) => sum + value, 0);
}

function mergeGameSaves(localSave, cloudSave) {
  if (!cloudSave) return localSave;
  if (!localSave) return cloudSave;

  const merged = { ...localSave };
  const localTime = getSaveTimestamp(localSave);
  const cloudTime = getSaveTimestamp(cloudSave);
  const localProgress = getSaveProgressScore(localSave);
  const cloudProgress = getSaveProgressScore(cloudSave);
  const preferredSave = cloudProgress > localProgress
    ? cloudSave
    : localProgress > cloudProgress
      ? localSave
      : (cloudTime > localTime ? cloudSave : localSave);

  // Arrays: Union
  const unionArrays = (arr1, arr2) => Array.from(new Set([...(arr1 || []), ...(arr2 || [])]));
  merged.learnedIdioms = unionArrays(localSave.learnedIdioms, cloudSave.learnedIdioms);
  merged.unlockedAchievements = unionArrays(localSave.unlockedAchievements, cloudSave.unlockedAchievements);
  merged.unlockedCards = unionArrays(localSave.unlockedCards, cloudSave.unlockedCards);
  merged.claimedSets = unionArrays(localSave.claimedSets, cloudSave.claimedSets);

  // Math.max for monotonic progress
  merged.xp = Math.max(localSave.xp || 0, cloudSave.xp || 0);
  merged.level = Math.max(localSave.level || 1, cloudSave.level || 1);
  merged.currentAdventureLevel = Math.max(localSave.currentAdventureLevel || 1, cloudSave.currentAdventureLevel || 1);
  merged.bestCombo = Math.max(localSave.bestCombo || 0, cloudSave.bestCombo || 0);
  merged.energy = maxFiniteNumber(localSave.energy, cloudSave.energy, 0);
  merged.drawTickets = maxFiniteNumber(localSave.drawTickets, cloudSave.drawTickets, 0);
  if (typeof preferredSave.equippedTitle === "string") {
    merged.equippedTitle = preferredSave.equippedTitle;
  }

  const intimacySave = getIntimacyProgressScore(cloudSave) > getIntimacyProgressScore(localSave)
    ? cloudSave
    : localSave;
  merged.intimacyLevel = Number.isFinite(intimacySave.intimacyLevel) ? intimacySave.intimacyLevel : (merged.intimacyLevel || 1);
  merged.intimacyXP = Number.isFinite(intimacySave.intimacyXP) ? intimacySave.intimacyXP : (merged.intimacyXP || 0);
  merged.intimacyPerks = mergeIntimacyPerks(localSave.intimacyPerks, cloudSave.intimacyPerks);
  const checkInState = mergeCheckInSaveState(localSave, cloudSave);
  merged.lastCheckInDate = checkInState.date;
  merged.checkInStreak = checkInState.streak;
  merged.dailyMissions = mergeDailyMissions(localSave.dailyMissions, cloudSave.dailyMissions);
  merged.dailyAdDraws = mergeDatedCounterState(localSave.dailyAdDraws, cloudSave.dailyAdDraws);

  // Stats maxing
  const lStats = localSave.stats || {};
  const cStats = cloudSave.stats || {};
  merged.stats = {
    totalQuestions: Math.max(lStats.totalQuestions || 0, cStats.totalQuestions || 0),
    correctQuestions: Math.max(lStats.correctQuestions || 0, cStats.correctQuestions || 0),
    shapeXP: Math.max(lStats.shapeXP || 0, cStats.shapeXP || 0),
    meaningXP: Math.max(lStats.meaningXP || 0, cStats.meaningXP || 0),
    assocXP: Math.max(lStats.assocXP || 0, cStats.assocXP || 0),
    reactionXP: Math.max(lStats.reactionXP || 0, cStats.reactionXP || 0),
    memoryXP: Math.max(lStats.memoryXP || 0, cStats.memoryXP || 0)
  };

  // Level Stars maxing
  const lStars = localSave.levelStars || {};
  const cStars = cloudSave.levelStars || {};
  const mergedStars = { ...lStars };
  for (const [lvl, stars] of Object.entries(cStars)) {
    mergedStars[lvl] = Math.max(mergedStars[lvl] || 0, stars || 0);
  }
  merged.levelStars = mergedStars;

  // Social rewards and prompts should not become unclaimed again after login.
  merged.socialRewards = mergeProgressBooleans(localSave.socialRewards, cloudSave.socialRewards);

  const mergeCountMap = (left = {}, right = {}) => {
    const mergedMap = { ...left };
    Object.entries(right || {}).forEach(([id, rightValue]) => {
      const leftValue = mergedMap[id];
      if (!leftValue) {
        mergedMap[id] = rightValue;
        return;
      }
      mergedMap[id] = {
        count: Math.max(leftValue.count || 0, rightValue.count || 0),
        lastAt: Math.max(leftValue.lastAt || 0, rightValue.lastAt || 0)
      };
    });
    return mergedMap;
  };
  const lLearning = localSave.learningLog || {};
  const cLearning = cloudSave.learningLog || {};
  merged.learningLog = {
    learnedAt: { ...(lLearning.learnedAt || {}) },
    wrongById: mergeCountMap(lLearning.wrongById, cLearning.wrongById),
    correctById: mergeCountMap(lLearning.correctById, cLearning.correctById)
  };
  Object.entries(cLearning.learnedAt || {}).forEach(([id, learnedAt]) => {
    const localLearnedAt = merged.learningLog.learnedAt[id];
    merged.learningLog.learnedAt[id] = localLearnedAt
      ? Math.min(localLearnedAt, learnedAt)
      : learnedAt;
  });

  // Recalculate Rank based on max level
  merged.rank = getRankTitle(merged.level);
  
  merged.updatedAt = Date.now();
  return merged;
}

function hasCloudGameSave(save) {
  if (!save || typeof save !== "object") return false;
  return [
    "xp",
    "level",
    "rank",
    "equippedTitle",
    "learnedIdioms",
    "unlockedAchievements",
    "currentAdventureLevel",
    "levelStars",
    "energy",
    "drawTickets",
    "intimacyLevel",
    "intimacyXP",
    "intimacyPerks",
    "unlockedCards",
    "claimedSets",
    "lastCheckInDate",
    "checkInStreak",
    "dailyMissions",
    "dailyAdDraws",
    "bestCombo",
    "socialRewards",
    "learningLog",
    "stats"
  ].some(key => Object.prototype.hasOwnProperty.call(save, key));
}

async function applyCloudSaveIfAvailable() {
  const cloudSave = await loadCloudSave();
  if (!hasCloudGameSave(cloudSave)) {
    return { restored: false, found: false, state: getCloudSaveState() };
  }

  const localSave = exportGameSave();
  const mergedSave = mergeGameSaves(localSave, cloudSave);
  
  applyGameSave(mergedSave);
  
  // 合併後儲存到本機，並自動同步到雲端
  await saveGameData({ sync: true, touch: true });
  
  return { restored: true, found: true, merged: true, state: getCloudSaveState() };
}

function parseSavedInt(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
}

function parseSavedJson(raw, fallback = null) {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[Save] JSON parse failed", error);
    return fallback;
  }
}

export async function loadGameData() {
  const getValWithMigration = async (key) => {
    try {
      const { value } = await Preferences.get({ key });
      if (value !== null) {
        return value;
      }
      // Migrate from localStorage if exists
      const localVal = localStorage.getItem(key);
      if (localVal !== null) {
        await Preferences.set({ key, value: localVal });
        return localVal;
      }
    } catch (error) {
      console.warn(`[Save] read failed: ${key}`, error);
    }
    return null;
  };

  let learnedSyncedFromCards = false;

  try {
    const savedXP = await getValWithMigration("idiom_adv_xp");
    const savedLevel = await getValWithMigration("idiom_adv_level");
    const savedLearned = await getValWithMigration("idiom_adv_learned");
    const savedAchievements = await getValWithMigration("idiom_adv_achievements");
    const savedTitle = await getValWithMigration("idiom_adv_title");

    const savedEnergy = await getValWithMigration("idiom_adv_energy");
    const savedDrawTickets = await getValWithMigration("idiom_adv_draw_tickets");
    const savedIntLevel = await getValWithMigration("idiom_adv_intimacy_level");
    const savedIntXP = await getValWithMigration("idiom_adv_intimacy_xp");
    const savedIntimacyPerks = await getValWithMigration("idiom_adv_intimacy_perks");
    const savedCards = await getValWithMigration("idiom_adv_unlocked_cards");
    const savedClaimed = await getValWithMigration("idiom_adv_claimed_sets");
    const savedStats = await getValWithMigration("idiom_adv_stats");
    const savedCheckInDate = await getValWithMigration("idiom_adv_checkin_date");
    const savedCheckInStreak = await getValWithMigration("idiom_adv_checkin_streak");
    const savedDailyMissions = await getValWithMigration("idiom_adv_daily_missions");
    const savedDailyAdDraws = await getValWithMigration("idiom_adv_daily_ad_draws");
    const savedBestCombo = await getValWithMigration("idiom_adv_best_combo");
    const savedSocialRewards = await getValWithMigration("idiom_adv_social_rewards");
    const savedLearningLog = await getValWithMigration("idiom_adv_learning_log");

    const savedAdvLevel = await getValWithMigration("idiom_adv_adventure_level");
    const savedLevelStars = await getValWithMigration("idiom_adv_level_stars");
    const savedUpdatedAt = await getValWithMigration(SAVE_UPDATED_AT_KEY);

    const xp = parseSavedInt(savedXP);
    if (xp !== null) gameState.xp = xp;

    const level = parseSavedInt(savedLevel);
    if (level !== null) {
      gameState.level = level;
      gameState.rank = getRankTitle(gameState.level);
    }

    const learned = parseSavedJson(savedLearned);
    if (Array.isArray(learned)) gameState.learnedIdioms = learned;

    const achievements = parseSavedJson(savedAchievements);
    if (Array.isArray(achievements)) gameState.unlockedAchievements = achievements;

    if (typeof savedTitle === "string") gameState.equippedTitle = savedTitle;

    const energy = parseSavedInt(savedEnergy);
    if (energy !== null) gameState.energy = energy;

    const drawTickets = parseSavedInt(savedDrawTickets);
    gameState.drawTickets = drawTickets !== null ? drawTickets : STARTER_DRAW_TICKETS;

    const intimacyLevel = parseSavedInt(savedIntLevel);
    if (intimacyLevel !== null) gameState.intimacyLevel = intimacyLevel;

    const intimacyXP = parseSavedInt(savedIntXP);
    if (intimacyXP !== null) gameState.intimacyXP = intimacyXP;

    const intimacyPerks = parseSavedJson(savedIntimacyPerks);
    if (intimacyPerks && typeof intimacyPerks === "object" && !Array.isArray(intimacyPerks)) {
      gameState.intimacyPerks = {
        ...gameState.intimacyPerks,
        ...intimacyPerks
      };
      ensureIntimacyPerks(gameState);
    }

    const cards = parseSavedJson(savedCards);
    if (Array.isArray(cards)) gameState.unlockedCards = cards;

    const claimed = parseSavedJson(savedClaimed);
    if (Array.isArray(claimed)) gameState.claimedSets = claimed;

    const stats = parseSavedJson(savedStats);
    if (stats && typeof stats === "object" && !Array.isArray(stats)) gameState.stats = stats;

    if (typeof savedCheckInDate === "string") gameState.lastCheckInDate = savedCheckInDate;

    const checkInStreak = parseSavedInt(savedCheckInStreak);
    if (checkInStreak !== null) gameState.checkInStreak = checkInStreak;

    const dailyMissions = parseSavedJson(savedDailyMissions);
    if (dailyMissions && typeof dailyMissions === "object" && !Array.isArray(dailyMissions)) {
      gameState.dailyMissions = dailyMissions;
    }

    const dailyAdDraws = parseSavedJson(savedDailyAdDraws);
    if (dailyAdDraws && typeof dailyAdDraws === "object" && !Array.isArray(dailyAdDraws)) {
      gameState.dailyAdDraws = dailyAdDraws;
    } else {
      gameState.dailyAdDraws = { date: "", count: 0 };
    }

    const bestCombo = parseSavedInt(savedBestCombo);
    if (bestCombo !== null) gameState.bestCombo = bestCombo;

    const socialRewards = parseSavedJson(savedSocialRewards);
    if (socialRewards && typeof socialRewards === "object" && !Array.isArray(socialRewards)) {
      gameState.socialRewards = {
        ...gameState.socialRewards,
        ...socialRewards
      };
    }

    const learningLog = parseSavedJson(savedLearningLog);
    if (learningLog && typeof learningLog === "object" && !Array.isArray(learningLog)) {
      gameState.learningLog = {
        ...gameState.learningLog,
        ...learningLog
      };
      normalizeLearningLog(gameState);
    }

    const adventureLevel = parseSavedInt(savedAdvLevel);
    if (adventureLevel !== null) gameState.currentAdventureLevel = adventureLevel;

    const levelStars = parseSavedJson(savedLevelStars);
    if (levelStars && typeof levelStars === "object" && !Array.isArray(levelStars)) {
      gameState.levelStars = levelStars;
    }

    gameState.saveUpdatedAt = parseSavedInt(savedUpdatedAt) ?? 0;
    learnedSyncedFromCards = syncLearnedIdiomsFromCards();
  } catch (loadError) {
    console.warn("[Save] loadGameData local restore failed", loadError);
  }

  try {
    await initCloudSave();
    await applyCloudSaveIfAvailable();
    if (learnedSyncedFromCards) {
      await saveGameData();
    }
  } catch (cloudError) {
    console.warn("[Save] loadGameData cloud restore failed", cloudError);
  }

  try {
    const { GameAnalytics } = await import('./analytics.js');
    GameAnalytics.noteAppOpen();
  } catch (analyticsError) {
    console.warn('[Analytics] noteAppOpen 失敗', analyticsError);
  }
}

export async function saveGameData(options = {}) {
  const shouldTouch = options.touch !== false;
  const shouldSync = options.sync !== false;

  if (shouldTouch) {
    gameState.saveUpdatedAt = Date.now();
  }

  const setVal = async (key, val) => {
    await Preferences.set({ key, value: val !== null && val !== undefined ? val.toString() : "" });
  };

  await Promise.all([
    setVal("idiom_adv_xp", gameState.xp),
    setVal("idiom_adv_level", gameState.level),
    setVal("idiom_adv_learned", JSON.stringify(gameState.learnedIdioms)),
    setVal("idiom_adv_achievements", JSON.stringify(gameState.unlockedAchievements)),
    setVal("idiom_adv_title", gameState.equippedTitle),
    setVal("idiom_adv_energy", gameState.energy),
    setVal("idiom_adv_draw_tickets", gameState.drawTickets),
    setVal("idiom_adv_intimacy_level", gameState.intimacyLevel),
    setVal("idiom_adv_intimacy_xp", gameState.intimacyXP),
    setVal("idiom_adv_intimacy_perks", JSON.stringify(gameState.intimacyPerks)),
    setVal("idiom_adv_unlocked_cards", JSON.stringify(gameState.unlockedCards)),
    setVal("idiom_adv_claimed_sets", JSON.stringify(gameState.claimedSets)),
    setVal("idiom_adv_stats", JSON.stringify(gameState.stats)),
    setVal("idiom_adv_checkin_date", gameState.lastCheckInDate || ""),
    setVal("idiom_adv_checkin_streak", gameState.checkInStreak),
    setVal("idiom_adv_daily_missions", JSON.stringify(gameState.dailyMissions)),
    setVal("idiom_adv_daily_ad_draws", JSON.stringify(gameState.dailyAdDraws)),
    setVal("idiom_adv_best_combo", gameState.bestCombo || 0),
    setVal("idiom_adv_social_rewards", JSON.stringify(gameState.socialRewards)),
    setVal("idiom_adv_learning_log", JSON.stringify(gameState.learningLog)),
    setVal("idiom_adv_adventure_level", gameState.currentAdventureLevel),
    setVal("idiom_adv_level_stars", JSON.stringify(gameState.levelStars)),
    setVal(SAVE_UPDATED_AT_KEY, gameState.saveUpdatedAt || Date.now())
  ]);

  if (shouldSync) {
    const saveData = exportGameSave();
    if (options.immediateSync) {
      const synced = await flushCloudSave(saveData);
      if (!synced) queueCloudSave(saveData);
    } else {
      queueCloudSave(saveData);
    }
  }
}

export async function signInCloudSave() {
  await signInWithGoogle();
  const signInState = getCloudSaveState();
  if (!signInState.signedIn) {
    return { restored: false, found: false, pending: true, state: signInState };
  }

  const restoreResult = await applyCloudSaveIfAvailable();
  if (restoreResult.restored) {
    return restoreResult;
  }
  if (restoreResult.state.lastError) {
    return restoreResult;
  }
  await flushCloudSave(exportGameSave());
  return { restored: false, state: getCloudSaveState() };
}

export async function restoreGameCloudSaveNow() {
  return applyCloudSaveIfAvailable();
}

export async function signOutGameCloudSave() {
  return signOutCloudSave();
}

export async function syncGameCloudSaveNow() {
  return flushCloudSave(exportGameSave());
}

export function getGameCloudSaveState() {
  return getCloudSaveState();
}

export function updateCapacityXP(mode) {
  if (!gameState.stats) {
    gameState.stats = { totalQuestions: 0, correctQuestions: 0, shapeXP: 0, meaningXP: 0, assocXP: 0, reactionXP: 0, memoryXP: 0 };
  }
  if (['radical', 'typo', 'simchar'].includes(mode)) {
    gameState.stats.shapeXP = (gameState.stats.shapeXP || 0) + ABILITY_CORRECT_GAIN;
  } else if (['story', 'antonym', 'synonym', 'fill'].includes(mode)) {
    gameState.stats.meaningXP = (gameState.stats.meaningXP || 0) + ABILITY_CORRECT_GAIN;
  } else if (['image', 'crossword'].includes(mode)) {
    gameState.stats.assocXP = (gameState.stats.assocXP || 0) + ABILITY_CORRECT_GAIN;
  } else if (['time', 'bubble', 'chain'].includes(mode)) {
    gameState.stats.reactionXP = (gameState.stats.reactionXP || 0) + ABILITY_CORRECT_GAIN;
  } else if (['match'].includes(mode)) {
    gameState.stats.memoryXP = (gameState.stats.memoryXP || 0) + ABILITY_CORRECT_GAIN;
  }
}
