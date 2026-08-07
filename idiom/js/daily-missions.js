/**
 * 成語大冒險 - 每日任務
 */

import { gameState, saveGameData, getNextLevelXP, getRankTitle, addDrawTickets } from './state.js';

export const DAILY_MISSIONS = [
  {
    id: "correct_3",
    title: "答對 3 題",
    desc: "完成任意挑戰中的正確作答",
    target: 3,
    event: "correct",
    guide: { type: "round", mode: "image" },
    guideLabel: "\u524d\u5f80\u6311\u6230",
    rewardEnergy: 80,
    rewardDrawTickets: 1,
    rewardXP: 20
  },
  {
    id: "match_1",
    title: "完成翻牌配對",
    desc: "通過 1 次釋義配對牌",
    target: 1,
    event: "matchWin",
    guide: { type: "round", mode: "match" },
    guideLabel: "\u524d\u5f80\u914d\u5c0d",
    rewardEnergy: 100,
    rewardDrawTickets: 1,
    rewardXP: 30
  },
  {
    id: "feed_1",
    title: "照顧小書蟲",
    desc: "餵食小書蟲 1 次",
    target: 1,
    event: "feed",
    guide: { type: "mascot", tabId: "sub-tab-home", screenId: "sub-screen-home", targetId: "pet-btn-feed" },
    guideLabel: "\u524d\u5f80\u990c\u98df",
    rewardEnergy: 60,
    rewardXP: 15
  },
  {
    id: "gain_500_xp",
    title: "刻苦銘心",
    desc: "單日累積獲得 500 經驗值",
    target: 500,
    event: "gainXP",
    guide: { type: "round", mode: "image" },
    guideLabel: "前往挑戰",
    rewardEnergy: 150,
    rewardDrawTickets: 2,
    rewardXP: 0
  },
  {
    id: "combo_10_time",
    title: "連擊大師",
    desc: "限時挑戰中達成 10 連擊",
    target: 1,
    event: "reach_combo_10",
    guide: { type: "round", mode: "time" },
    guideLabel: "前往挑戰",
    rewardEnergy: 200,
    rewardDrawTickets: 2,
    rewardXP: 50
  },
  {
    id: "interact_mascot_3",
    title: "陪伴小書蟲",
    desc: "與小書蟲互動 (摸摸) 3 次",
    target: 3,
    event: "interactMascot",
    guide: { type: "mascot", tabId: "sub-tab-home", screenId: "sub-screen-home", targetId: "pet-3d-container" },
    guideLabel: "前往互動",
    rewardEnergy: 60,
    rewardXP: 10
  }
];

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ensureDailyMissions() {
  const today = getTodayKey();
  if (!gameState.dailyMissions || gameState.dailyMissions.date !== today) {
    gameState.dailyMissions = {
      date: today,
      items: DAILY_MISSIONS.reduce((items, mission) => {
        items[mission.id] = { progress: 0, claimed: false };
        return items;
      }, {})
    };
  }

  DAILY_MISSIONS.forEach(mission => {
    if (!gameState.dailyMissions.items[mission.id]) {
      gameState.dailyMissions.items[mission.id] = { progress: 0, claimed: false };
    }
  });

  return gameState.dailyMissions;
}

export function recordDailyMissionProgress(eventName, amount = 1) {
  const missions = ensureDailyMissions();
  let changed = false;

  DAILY_MISSIONS.forEach(mission => {
    if (mission.event !== eventName) return;
    const item = missions.items[mission.id];
    const nextProgress = Math.min(mission.target, (item.progress || 0) + amount);
    if (nextProgress !== item.progress) {
      item.progress = nextProgress;
      changed = true;
    }
  });

  if (changed) {
    saveGameData();
  }

  return changed;
}

export function claimDailyMission(missionId) {
  const missions = ensureDailyMissions();
  const mission = DAILY_MISSIONS.find(item => item.id === missionId);
  const item = missions.items[missionId];
  if (!mission || !item || item.claimed || item.progress < mission.target) {
    return null;
  }

  item.claimed = true;
  gameState.energy += mission.rewardEnergy;
  if (mission.rewardDrawTickets) {
    addDrawTickets(mission.rewardDrawTickets);
  }
  gameState.xp += mission.rewardXP;
  if (mission.rewardXP > 0) {
    recordDailyMissionProgress("gainXP", mission.rewardXP);
  }
  let nextXP = getNextLevelXP(gameState.level);
  while (gameState.xp >= nextXP) {
    gameState.xp -= nextXP;
    gameState.level++;
    gameState.rank = getRankTitle(gameState.level);
    nextXP = getNextLevelXP(gameState.level);
  }
  saveGameData();
  return mission;
}
