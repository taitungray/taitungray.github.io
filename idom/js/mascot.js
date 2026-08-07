/**
 * 成語大冒險 - 書蟲小屋、寵物進化與閃卡收集模組
 */


import { gameState, getAbilityScore, getLearningReport, getUniqueIdiomCount, getUniqueIdiomItems, getUnlockedCardCount, saveGameData, unlockCardAndLearn, GACHA_SINGLE_TICKET_COST, GACHA_TEN_TICKET_COST, addDrawTickets, ensureIntimacyPerks, claimIntimacyDailyGift, getIntimacyDailyGift, getIntimacyXpBonusRate, maybeGrantIntimacyInteractionBonus } from './state.js';
import { sounds } from './audio.js';
import { confetti } from './confetti.js';
import { showToast, updateProfileBar, getRubyHTML, updateCurrencyDisplays, showDetailModal } from './ui.js';
import { DAILY_MISSIONS, ensureDailyMissions, claimDailyMission, recordDailyMissionProgress } from './daily-missions.js';
import { renderSocialRewardsPanel } from './social-rewards.js';
import { shareIdiomCardUnlock, shareMascotGrowth } from './share.js';

// A. 閃卡稀有度對照
export function getIdiomRarity(idiomId) {
  const ssr = ["wan_bi", "foolish_mountain", "one_cry", "sai_weng", "wo_xin"];
  const sr = ["paint_dragon", "iron_needle", "scared_bird", "qi_ren", "plum_thirst", "cup_snake", "po_fu", "he_li"];
  const r = ["frog_well", "lost_sheep", "snake_feet", "rabbit_tree", "play_cow", "pull_seedling", "fox_tiger", "self_contradict", "drink_source", "practice_perfect", "show_off_axe", "bird_clam", "finger_deer", "zhao_san"];
  if (ssr.includes(idiomId)) return "SSR";
  if (sr.includes(idiomId)) return "SR";
  if (r.includes(idiomId)) return "R";
  return "N";
}

// B. 親密度稱號清單
const INTIMACY_TITLES = [
  "陌生 🎒",
  "認識 🌱",
  "熟悉 🤝",
  "友善 🥰",
  "默契 ⚡",
  "信賴 ❤️",
  "摯友 🌟",
  "形影不離 ✨",
  "心靈相通 👑",
  "合而為一 🐉"
];
function getMascotIntimacyTitle(level) {
  return INTIMACY_TITLES[Math.min(9, level - 1)];
}

function formatTicketText(count) {
  return count > 0 ? `、🎫${count}` : "";
}

function formatIntimacyReward(reward) {
  return `+${reward.energy} 能量${formatTicketText(reward.tickets)}`;
}

function renderIntimacyPerksPanel() {
  const panel = document.getElementById("intimacy-perks-panel");
  if (!panel) return;

  const level = gameState.intimacyLevel || 1;
  const perks = ensureIntimacyPerks();
  const dailyGift = getIntimacyDailyGift(level);
  const xpBonusRate = getIntimacyXpBonusRate(level);
  const interactionLimit = level >= 16 ? 4 : level >= 8 ? 3 : level >= 3 ? 2 : 0;
  const cards = [
    {
      levelReq: 3,
      icon: "🎁",
      title: "互動驚喜",
      detail: level >= 3 ? `今日 ${perks.interactionBonusCount}/${interactionLimit}` : "Lv.3 解鎖"
    },
    {
      levelReq: 3,
      icon: "☀️",
      title: "每日摸摸禮",
      detail: level >= 3
        ? `${perks.dailyGiftClaimed ? "已領" : `⚡${dailyGift.energy}${formatTicketText(dailyGift.tickets)}`}`
        : "Lv.3 解鎖"
    },
    {
      levelReq: 5,
      icon: "💡",
      title: "守護提示",
      detail: level >= 5 ? (perks.hintShieldUsed ? "今日已用" : "答錯救援 1 次") : "Lv.5 解鎖"
    },
    {
      levelReq: 5,
      icon: "⭐",
      title: "通關加成",
      detail: level >= 5 ? `XP +${Math.round(xpBonusRate * 100)}%` : "Lv.5 解鎖"
    }
  ];

  panel.innerHTML = cards.map(card => `
    <div class="intimacy-perk ${level >= card.levelReq ? "" : "locked"}">
      <span class="intimacy-perk-icon" aria-hidden="true">${card.icon}</span>
      <span class="intimacy-perk-copy">
        <strong>${card.title}</strong>
        <span>${card.detail}</span>
      </span>
    </div>
  `).join("");
}

function getMascotEvolution(lv) {
  if (lv >= 16) return { emoji: "🐉", name: "九天化神龍 🐉", img: "assets/mascots/mascot_stage7.webp" };
  if (lv >= 13) return { emoji: "🦋👑", name: "金冠蝴蝶王 🦋👑", img: "assets/mascots/mascot_stage6.webp" };
  if (lv >= 11) return { emoji: "🦋", name: "七彩羽化蝶 🦋", img: "assets/mascots/mascot_stage5.webp" };
  if (lv >= 8) return { emoji: "🐛🎓", name: "狀元學者蟲 🎓", img: "assets/mascots/mascot_stage4.webp" };
  if (lv >= 5) return { emoji: "🐛👓", name: "秀才眼鏡蟲 👓", img: "assets/mascots/mascot_stage3.webp" };
  if (lv >= 3) return { emoji: "🐛✨", name: "發光小書蟲 ✨", img: "assets/mascots/mascot_stage2.webp" };
  return { emoji: "🐛", name: "寶寶小書蟲 🐛", img: "assets/mascots/mascot_stage1.webp" };
}

// C. 套卡清單定義
export const CARD_SETS = [
  {
    id: "set_animals",
    name: "動物大歷險 套卡",
    desc: "收集動物相關成語，從井底之蛙一路到龍飛鳳舞。",
    ids: ["frog_well", "lost_sheep", "snake_feet", "rabbit_tree", "play_cow", "fox_tiger", "scared_bird", "blind_elephant", "cup_snake", "bird_clam", "finger_deer", "he_li", "shun_shou", "da_cao", "jiu_niu", "ru_yu", "lao_ma", "han_ma", "ma_dao", "ma_bu", "dan_xiao", "long_fei"],
    rewardXP: 260,
    rewardTitle: "野生動物學家 🐾"
  },
  {
    id: "set_perseverance",
    name: "持之以恆 套卡",
    desc: "收集勤學、毅力、踏實努力相關成語。",
    ids: ["pull_seedling", "iron_needle", "halfway_stop", "practice_perfect", "foolish_mountain", "jing_wei", "kua_fu", "zi_zi", "ju_sha", "di_shui", "jian_ren", "bai_zhe", "jin_xin", "jiao_ta", "deng_feng", "gong_kui", "le_ci"],
    rewardXP: 230,
    rewardTitle: "鋼鐵意志 🛡️"
  },
  {
    id: "set_strategy",
    name: "奇策妙計 套卡",
    desc: "收集謀略、判斷、應變與歷史智慧成語。",
    ids: ["one_arrow_two", "cover_ears_steal", "chest_bamboo", "carve_boat", "buy_box", "plum_thirst", "zhi_shang", "jiao_tu", "yu_qin", "fu_di", "hun_shui", "jin_chan", "yuan_jiao", "dui_zheng", "po_fu", "sui_ji", "gu_zhu", "zu_zhi"],
    rewardXP: 240,
    rewardTitle: "臥龍軍師 🔮"
  },
  {
    id: "set_artists",
    name: "神筆妙手 套卡",
    desc: "收集藝術、創意、表現與巧思相關成語。",
    ids: ["paint_dragon", "show_off_axe", "ru_mu", "wu_yan", "tian_yi", "xu_xu", "hua_di", "miao_shou", "nong_qiao", "snake_feet", "gu_se", "bai_zhi", "tuo_tai"],
    rewardXP: 190,
    rewardTitle: "神筆畫仙 🖌️"
  },
  {
    id: "set_character",
    name: "品格修養 套卡",
    desc: "收集做人處事、誠信、正義與自我要求成語。",
    ids: ["drink_source", "da_gong", "xiao_xin", "san_si", "wei_yu", "bu_chi", "tong_gan", "he_ai", "shi_zhong", "shi_shi", "de_gao", "xi_shi", "ba_dao", "she_ji", "li_zhi", "shi_si", "yan_xing", "jian_yi", "xin_ping"],
    rewardXP: 250,
    rewardTitle: "君子之風 🌿"
  },
  {
    id: "set_emotions",
    name: "心情百景 套卡",
    desc: "收集喜怒哀樂、驚訝、安心與心境轉折成語。",
    ids: ["le_bu", "yi_yi", "xin_xin", "jin_jin", "xi_chu", "chui_tou", "da_jing", "xin_kuang", "nu_fa", "huang_ran", "ti_xin", "huan_tian", "xiao_rong", "po_ti", "qi_ji", "huan_ran"],
    rewardXP: 220,
    rewardTitle: "心境觀察家 💫"
  },
  {
    id: "set_speech",
    name: "口才表達 套卡",
    desc: "收集說話、聆聽、議論與文字表達成語。",
    ids: ["dui_da", "shou_kou", "kan_kan", "qian_yan", "ge_shu", "chui_mao", "zhang_kou", "tao_tao", "yi_zhen", "yi_kou", "mo_ming", "hua_yan", "you_kou"],
    rewardXP: 190,
    rewardTitle: "妙語書生 🗣️"
  },
  {
    id: "set_learning",
    name: "學問成長 套卡",
    desc: "收集學習、見識、記憶與成長突破成語。",
    ids: ["wen_gu", "gua_mu", "ming_luo", "ming_lie", "zhuan_xin", "lv_jian", "bu_lao", "ke_gu", "ke_bu", "li_suo", "yi_xiang", "ji_yi", "bo_gu"],
    rewardXP: 210,
    rewardTitle: "博學小博士 🎓"
  },
  {
    id: "set_world",
    name: "天地萬象 套卡",
    desc: "收集山水、城市、生活景象與自然萬物成語。",
    ids: ["hai_kuo", "po_jing", "xue_zhong", "jin_shang", "bu_mao", "men_ting", "man_zai", "man_mu", "jin_xiu", "an_ju", "ba_shan", "kai_men", "ju_shi", "feng_yi", "che_shui", "qi_xiang", "di_da", "di_lao", "di_dong", "ren_shan", "ren_jie", "shan_qing", "shan_meng", "shan_qiong", "hai_na", "shui_luo", "hua_hao"],
    rewardXP: 310,
    rewardTitle: "山海行者 🏞️"
  },
  {
    id: "set_numbers",
    name: "數字暗號 套卡",
    desc: "收集帶有數字、數量感或強烈程度的成語。",
    ids: ["one_cry", "zhao_san", "ba_xian", "qian_jun", "bai_fa", "si_mian", "wu_ti", "bu_ke", "bu_ji", "bu_yue", "qian_xin", "bu_mao", "bu_chi", "wu_wei", "bu_lao", "lv_jian"],
    rewardXP: 210,
    rewardTitle: "數字解謎家 🔢"
  },
  {
    id: "set_new_learning",
    name: "新知精進 套卡",
    desc: "收集閱讀、記憶、進步與眼界更新的新增成語。",
    ids: ["kai_juan_you_yi", "qing_chu_yu_lan", "jing_yi_qiu_jing", "dao_bei_ru_liu", "er_mu_yi_xin", "fen_bi_ji_shu", "gao_zhan_yuan_zhu"],
    rewardXP: 180,
    rewardTitle: "新知拓荒者 📚"
  },
  {
    id: "set_new_strategy",
    name: "決斷妙策 套卡",
    desc: "收集機智、速度、決心與重新出發的新增成語。",
    ids: ["yi_ju_liang_de", "yi_wang_wu_qian", "bing_gui_shen_su", "cao_chuan_jie_jian", "dong_shan_zai_qi", "bei_shui_yi_zhan", "luo_jing_xia_shi"],
    rewardXP: 180,
    rewardTitle: "決斷小軍師 🧭"
  },
  {
    id: "set_new_life",
    name: "人情風景 套卡",
    desc: "收集品格、人情、心境轉折與生活景象的新增成語。",
    ids: ["guang_ming_zheng_da", "xin_zhi_du_ming", "yu_yin_rao_liang", "le_ji_sheng_bei", "an_bu_dang_che", "cheng_men_li_xue", "hai_shi_shan_meng"],
    rewardXP: 180,
    rewardTitle: "人情觀察家 🌸"
  }
];

// G. 定時隨機可愛對話機制
let mascotDialogueTimer = null;
const MASCOT_DIALOGUES = [
  "小書蟲最喜歡跟主人在一起了！ ❤️",
  "主人，小書蟲最喜歡跟主人在一起了！ ❤️",
  "最喜歡跟主人在一起了！ ❤️ 小書蟲今天也很努力喔！",
  "只要能跟主人在一起，小書蟲就最開心了！ ❤️",
  "主人～ 小書蟲最喜歡跟主人在一起了！ ❤️",
  "小書蟲最喜歡跟主人在一起了！ ❤️ 啾～",
  "摸摸我，我就會更喜歡主人喔！ 🥰",
  "小書蟲最想每天都跟主人在一起！ ❤️",
  "今天也要跟主人一起學成語，好幸福喔！ ✨",
  "主人，你也是最喜歡小書蟲的嗎？ 🐛❤️",
  "嘻嘻，能跟主人在一起最幸福了！ ❤️",
  "主人摸摸我，我就會充滿力量喔！ 🥰",
  "今天也要跟主人一起學成語，好開心！ 📚✨",
  "看到主人，小書蟲心裡暖洋洋的～ 💖",
  "小書蟲會一直陪著主人喔！ 🐛❤️",
  "主人加油！你是最棒的！ 🌟",
  "有主人的陪伴，學習成語一點都不難！ 🎓",
  "主人，今天我們要學什麼成語呢？ 📖",
  "摸摸我的頭，考試得第一！ 🎓"
];

function getUnlockedIntimacyDialogs(type = "idle") {
  const level = gameState.intimacyLevel || 1;
  const lines = [];
  if (level >= 3) {
    lines.push(type === "feed" ? "這是你特地留給我的嗎？我會乖乖長大！" : "我開始記得你的腳步聲了！");
  }
  if (level >= 5) {
    lines.push(type === "touch" ? "被你摸摸就安心，今天我也會守護你！" : "遇到難題別怕，我會在旁邊提醒你。");
  }
  if (level >= 8) {
    lines.push(type === "feed" ? "吃飽後靈感滿滿，等等陪你衝一關！" : "我們越來越有默契了，挑戰也會更順。");
  }
  if (level >= 12) {
    lines.push(type === "touch" ? "嘿嘿，我偷偷準備了小回禮給你。" : "你的努力我都有看見，今天也一起拿滿星！");
  }
  if (level >= 16) {
    lines.push("最高親密啟動！小書蟲全力支援你！");
  }
  return lines;
}

function pickMascotDialog(baseDialogs, type = "idle") {
  const dialogs = [...baseDialogs, ...getUnlockedIntimacyDialogs(type)];
  return dialogs[Math.floor(Math.random() * dialogs.length)];
}

function changeMascotSpeechRandomly() {
  const speechBubble = document.getElementById("pet-bubble-speech");
  if (speechBubble) {
    speechBubble.innerText = pickMascotDialog(MASCOT_DIALOGUES, "idle");
  }
}

export function startMascotDialogueTimer() {
  stopMascotDialogueTimer();
  changeMascotSpeechRandomly();
  mascotDialogueTimer = setInterval(changeMascotSpeechRandomly, 5000);
}

export function stopMascotDialogueTimer() {
  if (mascotDialogueTimer) {
    clearInterval(mascotDialogueTimer);
    mascotDialogueTimer = null;
  }
}

// D. 餵食與撫摸互動變數與方法
let petTouchCooldown = false;
let petTouchCooldownRemaining = 0;
let activeTenDrawResults = null;
let isViewingTenDrawCard = false;
let activeCardSetId = "";

function getCompletedSetIdsForCards(cardIds) {
  const owned = new Set(cardIds);
  return CARD_SETS
    .filter(set => set.ids.every(id => owned.has(id)))
    .map(set => set.id);
}

function getNewCompletedSets(beforeCardIds, afterCardIds) {
  const before = new Set(getCompletedSetIdsForCards(beforeCardIds));
  return CARD_SETS.filter(set =>
    !before.has(set.id) && set.ids.every(id => afterCardIds.includes(id))
  );
}

function showCardSetCompleteCelebration(completedSets) {
  if (!completedSets.length) return;
  const set = completedSets[0];
  const extraCount = completedSets.length - 1;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay active card-set-complete-overlay";
  overlay.innerHTML = `
    <div class="modal-card card-set-complete-card">
      <div class="card-set-complete-icon">🎉</div>
      <span class="card-set-complete-kicker">套卡完成</span>
      <h2>${set.name}</h2>
      <p>${set.rewardTitle} · 獎勵 ${set.rewardXP} XP</p>
      ${extraCount > 0 ? `<strong>另外還完成 ${extraCount} 組套卡</strong>` : ""}
      <button class="btn btn-primary btn-large btn-pop" type="button">太棒了</button>
    </div>
  `;
  const close = () => overlay.remove();
  overlay.querySelector("button").addEventListener("click", close);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });
  document.body.appendChild(overlay);
  confetti.spawn(120);
  sounds.playLevelUp();
}

export function petTouchAction() {
  if (petTouchCooldown) {
    sounds.playError();
    showToast(`摸摸還要等 ${petTouchCooldownRemaining} 秒`);
    return;
  }
  sounds.playClick();
  
  gameState.intimacyXP += 3;
  checkIntimacyLevelUp();
  const dailyGift = claimIntimacyDailyGift();
  const interactionBonus = maybeGrantIntimacyInteractionBonus("touch");
  recordDailyMissionProgress("interactMascot", 1);
  
  petTouchCooldown = true;
  const touchBtn = document.getElementById("pet-btn-touch");
  const touchCooldownSpan = document.getElementById("touch-cooldown");
  
  petTouchCooldownRemaining = 5;
  touchCooldownSpan.innerText = `(${petTouchCooldownRemaining}s)`;
  const timer = setInterval(() => {
    petTouchCooldownRemaining--;
    if (petTouchCooldownRemaining <= 0) {
      clearInterval(timer);
      petTouchCooldown = false;
      petTouchCooldownRemaining = 0;
      touchCooldownSpan.innerText = "";
    } else {
      touchCooldownSpan.innerText = `(${petTouchCooldownRemaining}s)`;
    }
  }, 1000);
  
  const petDisplay = document.getElementById("pet-display-container");
  petDisplay.classList.add("spin-pet");
  setTimeout(() => petDisplay.classList.remove("spin-pet"), 600);
  
  const dialogs = [
    "嘻嘻，好癢喔！ 🐛✨",
    "主人最棒了！我們今天學了好多成語！ 🥰",
    "摸摸我的頭，考試得第一！ 🎓",
    "小書蟲最喜歡跟主人在一起了！ ❤️",
    "咕嚕咕嚕...真舒服～ 💤"
  ];
  document.getElementById("pet-bubble-speech").innerText = pickMascotDialog(dialogs, "touch");
  const rewardMessages = ["親密度 +3"];
  if (dailyGift) rewardMessages.push(`每日禮 ${formatIntimacyReward(dailyGift)}`);
  if (interactionBonus) rewardMessages.push(`回禮 ${formatIntimacyReward(interactionBonus)}`);
  showToast(`🎁 ${rewardMessages.join("，")}！`);
  
  saveGameData({ immediateSync: true });
  renderSubScreenHome();
  if (typeof renderDailyMissionsPanel === 'function') renderDailyMissionsPanel();
}

function showFeedEnergyToast(requiredEnergy = 30) {
  const currentEnergy = gameState.energy || 0;
  const missingEnergy = Math.max(0, requiredEnergy - currentEnergy);

  const energyBadge = document.querySelector(".energy-badge");
  if (energyBadge) {
    energyBadge.classList.remove("shake");
    void energyBadge.offsetWidth;
    energyBadge.classList.add("shake");
  }

  const speechBubble = document.getElementById("pet-bubble-speech");
  if (speechBubble) {
    speechBubble.innerText = "能量不夠囉！先去挑戰、簽到或完成每日任務，再回來餵我吧。";
  }

  showToast(`餵食需要 ${requiredEnergy} ⚡，目前 ${currentEnergy}，還差 ${missingEnergy}`);
}

export function petFeedAction() {
  const feedCost = 30;
  if (gameState.energy < feedCost) {
    sounds.playError();
    showFeedEnergyToast(feedCost);
    return;
  }
  sounds.playClick();
  gameState.energy -= feedCost;
  gameState.intimacyXP += 15;
  recordDailyMissionProgress("feed");
  checkIntimacyLevelUp();
  const interactionBonus = maybeGrantIntimacyInteractionBonus("feed");
  recordDailyMissionProgress("interactMascot", 1);
  
  const petDisplay = document.getElementById("pet-display-container");
  petDisplay.classList.add("bounce-pet");
  setTimeout(() => petDisplay.classList.remove("bounce-pet"), 500);
  
  const dialogs = [
    "嚼嚼嚼...知識糖果真好吃！ 🍬",
    "唔！好好吃！知識就是力量！ ⚡",
    "謝謝主人！我又長大了一點！ 🐛✨",
    "這是字形的味道嗎？真香！ 📚",
    "好吃！肚子飽飽，精神好好！ 💪"
  ];
  document.getElementById("pet-bubble-speech").innerText = pickMascotDialog(dialogs, "feed");
  const rewardMessages = ["親密度 +15"];
  if (interactionBonus) {
    rewardMessages.push(`餵食回禮 ${formatIntimacyReward(interactionBonus)}`);
  }
  showToast(`🎁 ${rewardMessages.join("，")}！`);
  
  saveGameData({ immediateSync: true });
  renderMascotScreen();
  if (typeof renderDailyMissionsPanel === 'function') renderDailyMissionsPanel();
}

export function checkIntimacyLevelUp() {
  let nextXP = gameState.intimacyLevel * 40;
  let leveledUp = false;
  
  while (gameState.intimacyXP >= nextXP) {
    gameState.intimacyXP -= nextXP;
    gameState.intimacyLevel++;
    leveledUp = true;
    nextXP = gameState.intimacyLevel * 40;
  }
  
  if (leveledUp) {
    const newLevel = gameState.intimacyLevel;
    setTimeout(() => {
      sounds.playLevelUp();
      confetti.spawn(80);
      showToast(`🎉 恭喜！小書蟲與你的親密度提升至等級 ${newLevel}！`);
      updateProfileBar();
      showMascotGrowthSharePrompt(newLevel);
    }, 400);
  }
}

// E. 抽閃卡動作
export function gachaDrawAction() {
  const currentTickets = gameState.drawTickets || 0;
  if (currentTickets < GACHA_SINGLE_TICKET_COST) {
    const missingTickets = GACHA_SINGLE_TICKET_COST - currentTickets;
    const requiredEnergy = missingTickets * 200;
    
    if (gameState.energy < requiredEnergy) {
      sounds.playError();
      showToast(`閃卡券與能量不足！需要 ${requiredEnergy} 能量來補充缺少的閃卡券 ⚡`);
      return;
    }
    
    gameState.energy -= requiredEnergy;
    gameState.drawTickets = currentTickets + missingTickets;
    showToast(`消耗 ${requiredEnergy} 能量補充了不足的閃卡券 ⚡`);
  }
  
  gameState.drawTickets -= GACHA_SINGLE_TICKET_COST;
  updateCurrencyDisplays();
  saveGameData();
  
  const roll = Math.random();
  let selectedRarity = "N";
  if (roll < 0.50) selectedRarity = "N";
  else if (roll < 0.80) selectedRarity = "R";
  else if (roll < 0.95) selectedRarity = "SR";
  else selectedRarity = "SSR";
  
  let pool = getUniqueIdiomItems().filter(item => getIdiomRarity(item.id) === selectedRarity);
  if (pool.length === 0) {
    pool = getUniqueIdiomItems();
  }
  
  const chosenIdiom = pool[Math.floor(Math.random() * pool.length)];
  unlockCardAndLearn(chosenIdiom.id);
  saveGameData();
  window.dispatchEvent(new CustomEvent("card-collection-updated"));
  openCardModal(chosenIdiom, true);
}

function rollGachaCard(isGuaranteed = false) {
  const roll = Math.random();
  let selectedRarity = "N";

  if (isGuaranteed) {
    selectedRarity = roll < 0.85 ? "SR" : "SSR";
  } else if (roll < 0.50) {
    selectedRarity = "N";
  } else if (roll < 0.80) {
    selectedRarity = "R";
  } else if (roll < 0.95) {
    selectedRarity = "SR";
  } else {
    selectedRarity = "SSR";
  }

  let pool = getUniqueIdiomItems().filter(item => getIdiomRarity(item.id) === selectedRarity);
  if (pool.length === 0) pool = getUniqueIdiomItems();

  return pool[Math.floor(Math.random() * pool.length)];
}

export function gachaTenDrawAction() {
  const currentTickets = gameState.drawTickets || 0;
  if (currentTickets < GACHA_TEN_TICKET_COST) {
    const missingTickets = GACHA_TEN_TICKET_COST - currentTickets;
    const requiredEnergy = missingTickets * 200;
    
    if (gameState.energy < requiredEnergy) {
      sounds.playError();
      showToast(`閃卡券與能量不足！需要 ${requiredEnergy} 能量來補充缺少的閃卡券 ⚡`);
      return;
    }
    
    gameState.energy -= requiredEnergy;
    gameState.drawTickets = currentTickets + missingTickets;
    showToast(`消耗 ${requiredEnergy} 能量補充了不足的閃卡券 ⚡`);
  }
  
  gameState.drawTickets -= GACHA_TEN_TICKET_COST;
  const results = Array.from({ length: 10 }, () => rollGachaCard(false));
  results.push(rollGachaCard(true));

  const beforeCards = [...gameState.unlockedCards];
  const seenCards = new Set(beforeCards);
  let newCount = 0;
  const resultViews = results.map((item, index) => {
    const alreadyUnlocked = seenCards.has(item.id);
    unlockCardAndLearn(item.id);
    if (!alreadyUnlocked) {
      newCount++;
      seenCards.add(item.id);
    }
    return {
      item,
      isNew: !alreadyUnlocked,
      isDuplicate: alreadyUnlocked,
      isGuaranteed: index === results.length - 1
    };
  });
  const completedSets = getNewCompletedSets(beforeCards, gameState.unlockedCards);

  updateCurrencyDisplays();
  saveGameData();
  window.dispatchEvent(new CustomEvent("card-collection-updated"));
  sounds.playLevelUp();
  confetti.spawn(80);
  showToast(`🌈 十連完成！新增 ${newCount} 張卡片，含 1 張保底！`);
  openGachaResultsModal(resultViews);
  if (completedSets.length) {
    setTimeout(() => showCardSetCompleteCelebration(completedSets), 800);
  }
}

function openGachaResultsModal(results) {
  activeTenDrawResults = results;
  isViewingTenDrawCard = false;

  const modal = document.getElementById("card-modal");
  const modalContainer = modal.querySelector(".card-modal-container");
  const revealBox = modal.querySelector(".card-reveal-box");
  const cardElement = document.getElementById("flash-card-element");
  const frontContent = document.getElementById("card-front-content");
  const closeBtn = document.getElementById("card-modal-close-btn");

  modalContainer.classList.add("ten-draw-results-container");
  revealBox.classList.add("ten-draw-results-box");
  cardElement.className = "flash-card-3d ten-draw-mode";
  frontContent.className = "card-side card-front-side ten-draw-results-side";
  setCardShareButton(null, { visible: false });

  const resultCards = results.map((result, index) => {
    const item = result.item || result;
    const rarity = getIdiomRarity(item.id);
    const isGuaranteed = result.isGuaranteed ?? index === results.length - 1;
    const statusClass = result.isNew ? "new" : "duplicate";
    const statusText = result.isNew ? "NEW" : "已擁有";
    return `
      <button class="ten-result-card rarity-${rarity}" data-card-id="${item.id}">
        <span class="ten-result-rarity">${rarity}</span>
        ${isGuaranteed ? '<span class="ten-result-guarantee">保底</span>' : ''}
        ${result.isNew ? `<span class="ten-result-status new">NEW</span>` : ''}
        ${item.image ? `<img src="${item.image}" alt="${item.idiom}">` : '<span class="ten-result-no-img">📜</span>'}
        <strong>${item.idiom}</strong>
      </button>
    `;
  }).join("");

  frontContent.innerHTML = `
    <div class="ten-draw-header">
      <span>🌈</span>
      <div>
        <h3>十連抽結果</h3>
        <p>10 抽 + 1 張 SR 以上保底</p>
      </div>
    </div>
    <div class="ten-draw-grid">${resultCards}</div>
    <div class="ten-draw-hint">點卡片可查看完整解釋</div>
  `;

  frontContent.querySelectorAll(".ten-result-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = IDIOMS_DATA.find(card => card.id === btn.dataset.cardId);
      if (item) {
        isViewingTenDrawCard = true;
        openCardModal(item, false);
      }
    });
  });

  closeBtn.style.display = "block";
  const firstNewCard = results.find(result => result.isNew)?.item;
  if (firstNewCard) {
    setCardShareButton(firstNewCard, {
      visible: true,
      label: "分享新卡"
    });
  }
  modal.classList.add("active");
}

export function closeCardModalAction() {
  const modal = document.getElementById("card-modal");
  if (isViewingTenDrawCard && activeTenDrawResults) {
    openGachaResultsModal(activeTenDrawResults);
    return;
  }

  activeTenDrawResults = null;
  isViewingTenDrawCard = false;
  modal.classList.remove("active");
  setCardShareButton(null, { visible: false });
  renderSubScreenCards();
  window.dispatchEvent(new CustomEvent("card-collection-updated"));
}

function getCardSetViewsForId(idiomId) {
  return CARD_SETS
    .filter(set => set.ids.includes(idiomId))
    .map(set => {
      const ownedCount = set.ids.filter(id => gameState.unlockedCards.includes(id)).length;
      const progressPct = Math.round((ownedCount / set.ids.length) * 100);
      return {
        name: set.name,
        ownedCount,
        totalCount: set.ids.length,
        progressPct
      };
    });
}

function getPrimarySetName(cardSetViews) {
  if (!cardSetViews.length) return "典藏閃卡";
  const firstSet = cardSetViews[0];
  return `${firstSet.name} · ${firstSet.ownedCount}/${firstSet.totalCount}`;
}

function getCardBackVisual(rarity) {
  const visuals = {
    N: {
      img: "assets/card_backs/card_back_n.webp",
      title: "成語新芽",
      sub: "典藏閃卡",
      ribbon: "基礎收藏"
    },
    R: {
      img: "assets/card_backs/card_back_r.webp",
      title: "靈光閃卡",
      sub: "典藏閃卡",
      ribbon: "稀有發現"
    },
    SR: {
      img: "assets/card_backs/card_back_sr.webp",
      title: "華彩祕卷",
      sub: "典藏閃卡",
      ribbon: "超稀有"
    },
    SSR: {
      img: "assets/card_backs/card_back_ssr.webp",
      title: "神龍金卡",
      sub: "典藏閃卡",
      ribbon: "傳說降臨"
    }
  };
  return visuals[rarity] || visuals.N;
}

function renderCardBack(cardElement, rarity) {
  const backContent = cardElement.querySelector(".card-back-side");
  if (!backContent) return;
  const visual = getCardBackVisual(rarity);
  backContent.className = `card-side card-back-side card-back-rarity-${rarity}`;
  backContent.innerHTML = `
    <div class="card-back-rarity-ribbon">${visual.ribbon}</div>
    <div class="card-back-orbit">
      <img class="card-back-art" src="${visual.img}" alt="${visual.title}">
    </div>
    <div class="card-back-title">${visual.title}</div>
    <div class="card-back-sub">${visual.sub}</div>
    <div class="card-back-hint">點一下翻開</div>
  `;
}

function setCardShareButton(item, { visible = false, label = "分享新卡" } = {}) {
  const shareBtn = document.getElementById("card-modal-share-btn");
  const actions = shareBtn?.closest(".card-modal-actions");
  if (!shareBtn) return;

  shareBtn.hidden = !visible || !item;
  shareBtn.querySelector("span").innerText = label;
  if (actions) {
    actions.classList.toggle("share-hidden", shareBtn.hidden);
  }
  shareBtn.onclick = null;

  if (!visible || !item) return;

  shareBtn.onclick = async () => {
    sounds.playClick();
    shareBtn.disabled = true;
    try {
      const cardSetViews = getCardSetViewsForId(item.id);
      const result = await shareIdiomCardUnlock({
        item,
        rarity: getIdiomRarity(item.id),
        setName: getPrimarySetName(cardSetViews),
        collectedText: `已收集 ${getUnlockedCardCount(gameState)} / ${getUniqueIdiomCount()} 張`
      });
      showToast(result === "image" ? "已開啟分享圖卡！" : "已開啟分享內容！");
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Card share failed", error);
        showToast("分享沒有完成，請再試一次");
      }
    } finally {
      shareBtn.disabled = false;
    }
  };
}

function showMascotGrowthSharePrompt(newLevel) {
  const existing = document.getElementById("mascot-growth-share-modal");
  if (existing) existing.remove();

  const title = getMascotIntimacyTitle(newLevel);
  const evo = getMascotEvolution(gameState.level);
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay active";
  overlay.id = "mascot-growth-share-modal";
  overlay.innerHTML = `
    <div class="modal-card mascot-growth-card">
      <div class="mascot-growth-img-wrap">
        <img src="${evo.img}" alt="${evo.name}">
      </div>
      <span class="mascot-growth-badge">親密 Lv.${newLevel}</span>
      <h2>小書蟲更喜歡你了！</h2>
      <p>${title} · ${evo.name}<br>分享這次成長，讓朋友看看你的小屋進度。</p>
      <div class="mascot-growth-actions">
        <button class="btn btn-secondary btn-large btn-pop" type="button" data-action="close">稍後</button>
        <button class="btn btn-primary btn-large btn-pop" type="button" data-action="share">分享成長</button>
      </div>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });
  overlay.querySelector('[data-action="close"]').addEventListener("click", () => {
    sounds.playClick();
    close();
  });
  overlay.querySelector('[data-action="share"]').addEventListener("click", async event => {
    sounds.playClick();
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await shareMascotGrowth({
        level: newLevel,
        title,
        evolutionName: evo.name,
        imageSrc: evo.img
      });
      showToast(result === "image" ? "已開啟成長圖卡！" : "已開啟分享內容！");
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Mascot growth share failed", error);
        showToast("分享沒有完成，請再試一次");
      }
    } finally {
      button.disabled = false;
    }
  });

  document.body.appendChild(overlay);
}

// F. 閃卡展示詳情
export function openCardModal(item, isNewDraw = false) {
  const modal = document.getElementById("card-modal");
  const modalContainer = modal.querySelector(".card-modal-container");
  const revealBox = modal.querySelector(".card-reveal-box");
  const cardElement = document.getElementById("flash-card-element");
  const frontContent = document.getElementById("card-front-content");
  const closeBtn = document.getElementById("card-modal-close-btn");
  setCardShareButton(null, { visible: false });

  modalContainer.classList.remove("ten-draw-results-container");
  revealBox.classList.remove("ten-draw-results-box");
  if (!isViewingTenDrawCard) {
    activeTenDrawResults = null;
  }
  
  frontContent.className = "card-side card-front-side";
  cardElement.className = "flash-card-3d";
  
  const rarity = getIdiomRarity(item.id);
  cardElement.classList.add(`card-back-theme-${rarity}`);
  renderCardBack(cardElement, rarity);
  frontContent.classList.add(`rarity-border-${rarity}`);
  
  const shortExp = item.explanation.split("。")[0] + "。";
  const cardSetViews = getCardSetViewsForId(item.id);
  const isAlreadyOwned = gameState.unlockedCards.includes(item.id);
  const newDrawBadge = isNewDraw ? `<div class="card-new-label">${isAlreadyOwned ? "已收藏卡片" : "NEW 新卡入手"}</div>` : "";
  const cardSetHTML = cardSetViews.length > 0
    ? cardSetViews.map(set => `
        <div class="card-set-summary-card">
          <div class="card-set-summary-main">
            <strong>${set.name}</strong>
            <span>${set.ownedCount} / ${set.totalCount} 張 · 完成 ${set.progressPct}%</span>
          </div>
          <span class="card-set-summary-bar"><i style="width:${set.progressPct}%"></i></span>
        </div>
      `).join("")
    : `<div class="card-set-summary-card empty">未加入套卡</div>`;
  
  frontContent.innerHTML = `
    <div class="card-header">
      <span class="card-rarity-badge">${rarity}</span>
      <span class="card-number">No. ${IDIOMS_DATA.indexOf(item) + 1}</span>
    </div>
    ${newDrawBadge}
    <div class="card-idiom-title-row" style="display:flex; justify-content:center; align-items:center; gap:10px; position:relative;">
      <div class="card-idiom-ruby">
        ${getRubyHTML(item.idiom, item.bopomofo, 'card-version')}
      </div>
    </div>
    <div class="card-img-container">
      <button class="tts-play-btn" id="card-tts-btn" title="朗讀成語與解釋"><svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" style="pointer-events: none;"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></button>
      ${item.image ? `<img class="card-img" src="${item.image}" alt="${item.idiom}">` : `<span class="card-no-img">📜</span>`}
    </div>
    <div class="card-set-membership">
      <span class="card-desc-label">🧩 所屬套卡</span>
      <div class="card-set-summary-list">${cardSetHTML}</div>
    </div>
    <div class="card-desc-box">
      <div class="card-desc-item">
        <span class="card-desc-label">💡 解釋</span>
        <span>${shortExp}</span>
      </div>
      <div class="card-desc-item">
        <span class="card-desc-label">✍️ 例句</span>
        <span>${item.example}</span>
      </div>
    </div>
  `;
  
  const clone = cardElement.cloneNode(true);
  cardElement.parentNode.replaceChild(clone, cardElement);
  const activeCardElement = document.getElementById("flash-card-element");
  
  const ttsBtn = document.getElementById("card-tts-btn");
  if (ttsBtn) {
    ttsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sounds.playClick();
      sounds.speakIdiom(item.idiom, item.explanation);
    });
  }
  
  if (isNewDraw) {
    closeBtn.style.display = "none";
    modal.classList.add("active");
    
    const handleFlip = () => {
      activeCardElement.classList.add("flipped");
      sounds.playMatch();
      closeBtn.style.display = "block";
      const beforeCards = [...gameState.unlockedCards];
      
      if (rarity === "SSR") {
        setTimeout(() => {
          confetti.spawn(120);
          sounds.playLevelUp();
        }, 300);
      }
      
      if (unlockCardAndLearn(item.id)) {
        const completedSets = getNewCompletedSets(beforeCards, gameState.unlockedCards);
        saveGameData();
        setCardShareButton(item, { visible: true, label: "分享新卡" });
        if (completedSets.length) {
          setTimeout(() => showCardSetCompleteCelebration(completedSets), 650);
        }
      } else {
        setCardShareButton(item, { visible: true, label: "分享卡片" });
      }
      
      activeCardElement.removeEventListener("click", handleFlip);
    };
    activeCardElement.addEventListener("click", handleFlip);
  } else {
    activeCardElement.classList.add("instant-flipped");
    activeCardElement.classList.add("flipped");
    closeBtn.style.display = "block";
    modal.classList.add("active");
  }
}

// G. 領取套卡成就獎勵
export function claimCardSet(setId) {
  sounds.playClick();
  const set = CARD_SETS.find(s => s.id === setId);
  if (!set) return;
  
  const ownedCount = set.ids.filter(id => gameState.unlockedCards.includes(id)).length;
  const isCompleted = ownedCount === set.ids.length;
  const isAlreadyClaimed = gameState.claimedSets.includes(setId);
  
  if (isCompleted && !isAlreadyClaimed) {
    gameState.claimedSets.push(setId);
    addDrawTickets(1);
    
    // 手動執行經驗值與等級升級 (因為不呼叫 ui.js.earnXP，避免循環依賴)
    gameState.xp += set.rewardXP;
    if (set.rewardXP > 0) recordDailyMissionProgress("gainXP", set.rewardXP);
    // 匯入 getNextLevelXP, getRankTitle 計算升級
    import('./state.js').then(module => {
      let nextXP = module.getNextLevelXP(gameState.level);
      let leveledUp = false;
      while (gameState.xp >= nextXP) {
        gameState.xp -= nextXP;
        gameState.level++;
        gameState.rank = module.getRankTitle(gameState.level);
        leveledUp = true;
        nextXP = module.getNextLevelXP(gameState.level);
      }
      saveGameData();
      
      sounds.playLevelUp();
      confetti.spawn(100);
      showToast(`🎉 恭喜！收集齊【${set.name}】！獲得稱號：${set.rewardTitle}、+${set.rewardXP} XP 及 🎫1 閃卡券！`);
      
      gameState.equippedTitle = set.rewardTitle;
      updateProfileBar();
      renderSubScreenCards();
      window.dispatchEvent(new CustomEvent("card-collection-updated"));
    });
  }
}
window.claimCardSet = claimCardSet; // 提供 HTML inline 點擊綁定

// I. 書蟲小屋主渲染函數
export function renderMascotScreen() {
  updateCurrencyDisplays();
  renderDailyMissionsPanel();
  renderSocialRewardsPanel({ showToast, updateProfileBar, sounds, confetti });
  renderDailyMissionsSummary();
  
  const activeSubTab = document.querySelector(".sub-tab.active");
  const activeId = activeSubTab ? activeSubTab.id : "sub-tab-home";
  
  if (activeId === "sub-tab-home") {
    renderSubScreenHome();
    startMascotDialogueTimer();
  } else {
    stopMascotDialogueTimer();
    if (activeId === "sub-tab-stats") {
      renderSubScreenStats();
    } else if (activeId === "sub-tab-report") {
      renderSubScreenReport();
    }
  }
}

function getDailyMissionCounts() {
  const missions = ensureDailyMissions();
  const completedCount = DAILY_MISSIONS.filter(mission => {
    const item = missions.items[mission.id];
    return item && item.progress >= mission.target;
  }).length;
  const readyCount = DAILY_MISSIONS.filter(mission => {
    const item = missions.items[mission.id];
    return item && item.progress >= mission.target && !item.claimed;
  }).length;
  return { completedCount, readyCount, total: DAILY_MISSIONS.length, missions };
}

function renderDailyMissionsSummary() {
  const summary = document.getElementById("daily-missions-summary");
  const summaryText = document.getElementById("daily-missions-summary-text");
  const readyCountEl = document.getElementById("daily-missions-ready-count");
  if (!summary || !summaryText || !readyCountEl) return;

  const { completedCount, readyCount, total } = getDailyMissionCounts();
  summaryText.innerText = `${completedCount} / ${total} 已完成`;
  readyCountEl.innerText = readyCount > 0 ? `${readyCount} 可領` : "查看";
  summary.classList.toggle("has-ready", readyCount > 0);
}

function requestDailyMissionGuide(missionId) {
  window.dispatchEvent(new CustomEvent("daily-mission-guide", {
    detail: { missionId }
  }));
}

function renderDailyMissionsPanel() {
  const panel = document.getElementById("daily-missions-panel");
  if (!panel) return;
  const { missions, completedCount } = getDailyMissionCounts();

  panel.innerHTML = `
    <div class="daily-missions-header">
      <div class="daily-missions-title-row">
        <h3>今日任務</h3>
        <p>${completedCount} / ${DAILY_MISSIONS.length} 已完成</p>
      </div>
    </div>
    <div class="daily-missions-list">
      ${DAILY_MISSIONS.map(mission => {
        const item = missions.items[mission.id] || { progress: 0, claimed: false };
        const progress = Math.min(mission.target, item.progress || 0);
        const percent = Math.round((progress / mission.target) * 100);
        const isReady = progress >= mission.target;
        const canGuide = !isReady && !item.claimed && mission.guide;
        const statusText = item.claimed ? "已領取" : (isReady ? "領取" : `${progress}/${mission.target}`);
        return `
          <button class="daily-mission-item ${isReady ? 'ready' : ''} ${canGuide ? 'guidable' : ''} ${item.claimed ? 'claimed' : ''}" data-mission-id="${mission.id}" ${item.claimed ? 'disabled' : ''}>
            <div class="daily-mission-copy">
              <strong>${mission.title}</strong>
              <span>${mission.desc}</span>
              <div class="daily-mission-progress"><i style="width: ${percent}%"></i></div>
            </div>
            <div class="daily-mission-reward">
              <div class="daily-mission-reward-items">
                <span><span aria-hidden="true">⚡</span>${mission.rewardEnergy}</span>
                ${mission.rewardDrawTickets ? `<span><span aria-hidden="true">🎫</span>${mission.rewardDrawTickets}</span>` : ""}
              </div>
              <small>+${mission.rewardXP} 經驗值</small>
              <b>${canGuide ? (mission.guideLabel || "\u524d\u5f80") : statusText}</b>
            </div>
          </button>
        `;
      }).join("")}
    </div>
  `;

  panel.querySelectorAll(".daily-mission-item:not(.claimed)").forEach(button => {
    button.addEventListener("click", () => {
      if (!button.classList.contains("ready")) {
        sounds.playClick();
        requestDailyMissionGuide(button.dataset.missionId);
        return;
      }

      const mission = claimDailyMission(button.dataset.missionId);
      if (!mission) return;
      sounds.playLevelUp();
      const ticketText = mission.rewardDrawTickets ? `、🎫${mission.rewardDrawTickets} 閃卡券` : "";
      showToast(`🎁 今日任務完成：+${mission.rewardEnergy} 能量${ticketText}、+${mission.rewardXP} XP！`);
      updateProfileBar();
      renderMascotScreen();
    });
  });
}

export function renderSubScreenHome() {
  const level = gameState.level;
  // 獲取進化形態資料的輔助函數
  const getMascotEvolution = (lv) => {
    if (lv >= 16) return { emoji: "🐉", name: "九天化神龍 🐉", img: "assets/mascots/mascot_stage7.webp" };
    if (lv >= 13) return { emoji: "🦋👑", name: "金冠蝴蝶王 🦋👑", img: "assets/mascots/mascot_stage6.webp" };
    if (lv >= 11) return { emoji: "🦋", name: "七彩羽化蝶 🦋", img: "assets/mascots/mascot_stage5.webp" };
    if (lv >= 8) return { emoji: "🐛🎓", name: "狀元學者蟲 🎓", img: "assets/mascots/mascot_stage4.webp" };
    if (lv >= 5) return { emoji: "🐛👓", name: "秀才眼鏡蟲 👓", img: "assets/mascots/mascot_stage3.webp" };
    if (lv >= 3) return { emoji: "🐛✨", name: "發光小書蟲 ✨", img: "assets/mascots/mascot_stage2.webp" };
    return { emoji: "🐛", name: "寶寶小書蟲 🐛", img: "assets/mascots/mascot_stage1.webp" };
  };

  const evo = getMascotEvolution(level);
  const nextXP = gameState.intimacyLevel * 40;
  const pct = Math.min(100, (gameState.intimacyXP / nextXP) * 100);
  const intimacyTitle = getMascotIntimacyTitle(gameState.intimacyLevel);
  
  const imgEl = document.getElementById("pet-display-img");
  if (imgEl) imgEl.src = evo.img;
  
  document.getElementById("pet-display-name").innerText = evo.name.split(" ")[0];
  document.getElementById("pet-intimacy-badge").innerText = `親密等級 Lv.${gameState.intimacyLevel}`;
  document.getElementById("pet-intimacy-text").innerText = `${gameState.intimacyXP} / ${nextXP}`;
  document.getElementById("pet-intimacy-title").innerText = intimacyTitle;
  document.getElementById("pet-intimacy-bar").style.width = `${pct}%`;
  renderIntimacyPerksPanel();
  
  let activeIndex = 1;
  if (gameState.level >= 16) activeIndex = 7;
  else if (gameState.level >= 13) activeIndex = 6;
  else if (gameState.level >= 11) activeIndex = 5;
  else if (gameState.level >= 8) activeIndex = 4;
  else if (gameState.level >= 5) activeIndex = 3;
  else if (gameState.level >= 3) activeIndex = 2;
  
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById(`evo-step-${i}`);
    if (el) {
      if (i === activeIndex) {
        el.className = "evo-step active";
      } else if (i < activeIndex) {
        el.className = "evo-step";
      } else {
        el.className = "evo-step locked";
      }
    }
  }
}

export function renderSubScreenCards() {
  const collectedCountEl = document.getElementById("cards-collected-count");
  const setsContainer = document.getElementById("card-sets-container");
  if (!collectedCountEl || !setsContainer) return;

  collectedCountEl.innerText = `${getUnlockedCardCount(gameState)} / ${getUniqueIdiomCount()}`;
  updateCurrencyDisplays();
  
  setsContainer.innerHTML = "";

  const setSummary = document.getElementById("card-set-summary");
  const sortMode = document.getElementById("card-set-sort-select")?.value || "claimable";
  const idiomsById = new Map(getUniqueIdiomItems().map(item => [item.id, item]));
  const setViews = CARD_SETS.map(set => {
    const ownedCount = set.ids.filter(id => gameState.unlockedCards.includes(id)).length;
    const isCompleted = ownedCount === set.ids.length;
    const isClaimed = gameState.claimedSets.includes(set.id);
    return {
      set,
      ownedCount,
      missingIds: set.ids.filter(id => !gameState.unlockedCards.includes(id)),
      progressPct: Math.round((ownedCount / set.ids.length) * 100),
      isCompleted,
      isClaimed,
      canClaim: isCompleted && !isClaimed
    };
  });

  setViews.sort((a, b) => {
    if (sortMode === "name") return a.set.name.localeCompare(b.set.name, "zh-Hant");
    if (sortMode === "progress") return b.progressPct - a.progressPct || a.set.name.localeCompare(b.set.name, "zh-Hant");
    if (sortMode === "incomplete") {
      if (!a.isCompleted && b.isCompleted) return -1;
      if (a.isCompleted && !b.isCompleted) return 1;
      return b.progressPct - a.progressPct;
    }
    if (a.canClaim !== b.canClaim) return a.canClaim ? -1 : 1;
    if (a.isClaimed !== b.isClaimed) return a.isClaimed ? 1 : -1;
    return b.progressPct - a.progressPct;
  });

  if (setSummary) {
    const claimableCount = setViews.filter(view => view.canClaim).length;
    const completedCount = setViews.filter(view => view.isCompleted).length;
    setSummary.textContent = `${completedCount}/${CARD_SETS.length} 組完成 · ${claimableCount} 組可領取`;
  }
  
  setViews.forEach(view => {
    const { set, ownedCount, missingIds, progressPct, isCompleted, isClaimed, canClaim } = view;
    const isExpanded = activeCardSetId === set.id;
    
    const panel = document.createElement("div");
    panel.className = `card-set-panel ${isCompleted ? 'completed' : ''} ${canClaim ? 'claimable' : ''} ${isExpanded ? 'expanded' : ''}`;
    panel.tabIndex = 0;
    panel.setAttribute("role", "button");
    panel.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    
    let btnHTML = "";
    if (isCompleted) {
      if (isClaimed) {
        btnHTML = `<span class="badge badge-success"><span aria-hidden="true">✨</span> 已領取獎勵</span>`;
      } else {
        btnHTML = `<button class="btn btn-primary btn-small card-set-claim-btn" data-set-id="${set.id}"><span aria-hidden="true">🎁</span> 領取</button>`;
      }
    } else {
      btnHTML = `<span class="card-set-progress" style="font-weight:900;">${ownedCount} / ${set.ids.length}</span>`;
    }

    const chipListHTML = set.ids.map(id => {
      const item = idiomsById.get(id);
      const isOwned = gameState.unlockedCards.includes(id);
      if (isOwned && item) {
        return `<button class="card-set-chip owned card-set-open-card" type="button" data-card-id="${id}">${item.idiom}</button>`;
      }
      return `<span class="card-set-chip missing">${item ? item.idiom : id}</span>`;
    }).join("");

    const previewCards = set.ids.slice(0, 4).map(id => {
      const item = idiomsById.get(id);
      const isOwned = gameState.unlockedCards.includes(id);
      if (isOwned && item && !item.image) {
        return `<button class="card-set-preview-card owned card-set-open-card" type="button" data-card-id="${id}">${item.idiom.slice(0, 1)}</button>`;
      }
      if (isOwned && item?.image) {
        return `<button class="card-set-preview-card owned card-set-open-card" type="button" data-card-id="${id}" aria-label="查看${item.idiom}說明"><img src="${item.image}" alt="${item.idiom}"></button>`;
      }
      return `<span class="card-set-preview-card ${isOwned ? 'owned' : 'locked'}">${isOwned && item ? item.idiom.slice(0, 1) : '？'}</span>`;
    }).join("");
    
    panel.innerHTML = `
      <div class="card-set-header">
        <div class="card-set-title-wrap">
          <span class="card-set-name">${set.name}</span>
          <span class="card-set-progress-line"><i style="width:${progressPct}%"></i></span>
        </div>
        <div class="card-set-right">
          <div class="card-set-preview">${previewCards}</div>
          <div class="card-set-status">${btnHTML}</div>
        </div>
      </div>
      <div class="card-set-detail">
        <span class="card-set-desc">${set.desc}</span>
        <div class="card-set-detail-title">收集進度 ${ownedCount} / ${set.ids.length}</div>
        <div class="card-set-chip-list">${chipListHTML}</div>
      </div>
    `;
    panel.addEventListener("click", (event) => {
      if (event.target.closest(".card-set-claim-btn, .card-set-open-card, .card-set-chip")) return;
      activeCardSetId = activeCardSetId === set.id ? "" : set.id;
      renderSubScreenCards();
    });
    panel.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest(".card-set-claim-btn, .card-set-open-card")) return;
      event.preventDefault();
      activeCardSetId = activeCardSetId === set.id ? "" : set.id;
      renderSubScreenCards();
    });
    panel.querySelectorAll(".card-set-open-card").forEach(cardButton => {
      cardButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const item = idiomsById.get(cardButton.dataset.cardId);
        if (!item) return;
        sounds.playClick();
        showDetailModal(item, false);
      });
    });
    const claimBtn = panel.querySelector(".card-set-claim-btn");
    if (claimBtn) {
      claimBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        claimCardSet(claimBtn.dataset.setId);
      });
    }
    setsContainer.appendChild(panel);
  });
  
  const grid = document.getElementById("cards-collection-grid");
  if (!grid) return;
  grid.innerHTML = "";
  
  const sortedIdioms = getUniqueIdiomItems().sort((a, b) => {
    const aUnlocked = gameState.unlockedCards.includes(a.id);
    const bUnlocked = gameState.unlockedCards.includes(b.id);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    return 0;
  });

  sortedIdioms.forEach(item => {
    const isUnlocked = gameState.unlockedCards.includes(item.id);
    const cardEl = document.createElement("div");
    cardEl.className = `flash-card-thumbnail ${isUnlocked ? '' : 'locked'}`;
    
    const rarity = getIdiomRarity(item.id);
    cardEl.classList.add(`rarity-${rarity}`);
    const cardSetViews = getCardSetViewsForId(item.id);
    const setLabel = cardSetViews.length > 0
      ? `${cardSetViews[0].name}${cardSetViews.length > 1 ? ` +${cardSetViews.length - 1}` : ""}`
      : "未加入套卡";
    if (isUnlocked) {
      cardEl.innerHTML = `
        ${item.image ? `<img class="thumbnail-bg-img" src="${item.image}" alt="${item.idiom}">` : ''}
        <span class="thumbnail-rarity-badge">${rarity}</span>
        <span class="thumbnail-idiom">${item.idiom}</span>
      `;
      cardEl.addEventListener("click", () => {
        sounds.playClick();
        openCardModal(item, false);
      });
    } else {
      cardEl.innerHTML = `
        <span class="thumbnail-rarity-badge locked-rarity">${rarity}</span>
        <span class="thumbnail-locked-lock">🔒</span>
        <span class="thumbnail-locked-title">未收藏</span>
        <span class="thumbnail-locked-set">${setLabel}</span>
      `;
      cardEl.addEventListener("click", () => {
        sounds.playError();
        showToast(`尚未收集此閃卡｜${rarity}｜${setLabel}`);
      });
    }
    grid.appendChild(cardEl);
  });
}

export function renderSubScreenStats() {
  const total = gameState.stats.totalQuestions || 0;
  const correct = gameState.stats.correctQuestions || 0;
  const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
  
  document.getElementById("stats-total-questions").innerText = total;
  document.getElementById("stats-correct-questions").innerText = correct;
  document.getElementById("stats-correct-rate").innerText = `${rate}%`;
  
  const container = document.getElementById("ability-bars-container");
  container.innerHTML = "";
  
  const abilities = [
    { name: "字形辨析", val: getAbilityScore(gameState.stats.shapeXP), icon: "🧩", class: "shape" },
    { name: "詞意理解", val: getAbilityScore(gameState.stats.meaningXP), icon: "📖", class: "meaning" },
    { name: "圖文聯想", val: getAbilityScore(gameState.stats.assocXP), icon: "🖼️", class: "assoc" },
    { name: "反應力", val: getAbilityScore(gameState.stats.reactionXP), icon: "⏱️", class: "reaction" },
    { name: "記憶聯結", val: getAbilityScore(gameState.stats.memoryXP), icon: "🃏", class: "memory" }
  ];
  
  abilities.forEach(ability => {
    const item = document.createElement("div");
    item.className = "ability-item";
    item.innerHTML = `
      <div class="ability-header">
        <span class="ability-icon-name">${ability.icon} ${ability.name}</span>
        <span class="ability-val">${ability.val} / 100</span>
      </div>
      <div class="ability-bar-outer">
        <div class="ability-bar-inner ability-bar-color-${ability.class}" style="width: ${ability.val}%;"></div>
      </div>
    `;
    container.appendChild(item);
  });
}

function getReportItemHTML(entry, type = "learned") {
  const item = entry.item;
  const rarity = getIdiomRarity(item.id);
  const imageHTML = item.image
    ? `<img src="${item.image}" alt="${item.idiom}">`
    : `<span class="report-item-fallback">📜</span>`;
  const meta = type === "learned"
    ? `新學會 · ${rarity}`
    : `答錯 ${entry.wrongCount} 次 · 答對 ${entry.correctCount || 0} 次`;
  return `
    <button class="report-item" type="button" data-report-card="${item.id}">
      <span class="report-item-thumb">${imageHTML}</span>
      <span class="report-item-copy">
        <strong>${item.idiom}</strong>
        <small>${meta}</small>
      </span>
      <span class="report-item-action">查看</span>
    </button>
  `;
}

function renderReportList(containerId, entries, emptyText, type = "learned") {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!entries.length) {
    container.innerHTML = `<div class="report-empty">${emptyText}</div>`;
    return;
  }

  container.innerHTML = entries.map(entry => getReportItemHTML(entry, type)).join("");
  container.querySelectorAll("[data-report-card]").forEach(button => {
    button.addEventListener("click", () => {
      const item = getUniqueIdiomItems().find(candidate => candidate.id === button.dataset.reportCard);
      if (!item) return;
      sounds.playClick();
      openCardModal(item, false);
    });
  });
}

export function renderSubScreenReport() {
  const report = getLearningReport(gameState);
  const weekLearnedEl = document.getElementById("report-week-learned");
  const accuracyEl = document.getElementById("report-accuracy");
  const reviewCountEl = document.getElementById("report-review-count");
  const weekNoteEl = document.getElementById("report-week-note");

  if (weekLearnedEl) weekLearnedEl.innerText = report.learnedThisWeek.length;
  if (accuracyEl) accuracyEl.innerText = `${report.accuracy}%`;
  if (reviewCountEl) reviewCountEl.innerText = report.reviewCandidates.length;
  if (weekNoteEl) weekNoteEl.innerText = `累積作答 ${report.total} 題`;

  renderReportList(
    "report-week-list",
    report.learnedThisWeek.slice(0, 5),
    "開始挑戰或抽卡後，這裡會顯示近 7 天新學會的成語。",
    "learned"
  );
  renderReportList(
    "report-mistake-list",
    report.mistakes,
    "目前還沒有常錯紀錄，先玩幾題讓系統觀察。",
    "mistake"
  );
  renderReportList(
    "report-review-list",
    report.reviewCandidates,
    "暫時沒有需要特別複習的成語，保持這個節奏。",
    "review"
  );
}

export function drawRandomCardForCheckIn() {
  const lockedPool = getUniqueIdiomItems().filter(item => !gameState.unlockedCards.includes(item.id));
  let chosenIdiom;
  if (lockedPool.length > 0) {
    chosenIdiom = lockedPool[Math.floor(Math.random() * lockedPool.length)];
  } else {
    const cardPool = getUniqueIdiomItems();
    chosenIdiom = cardPool[Math.floor(Math.random() * cardPool.length)];
  }
  
  sounds.playLevelUp();
  confetti.spawn(100);
  showToast("🌟 恭喜獲得簽到第 7 天大獎：免費解鎖一張成語卡！");
  openCardModal(chosenIdiom, true);
}
