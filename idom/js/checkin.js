/**
 * 成語大冒險 - 每日簽到模組
 */

import { gameState, saveGameData, addDrawTickets } from './state.js';
import { sounds } from './audio.js';
import { confetti } from './confetti.js';
import { showToast, updateProfileBar } from './ui.js';
import { drawRandomCardForCheckIn } from './mascot.js';

const CHECKIN_REWARDS = [
  { day: 1, energy: 50 },
  { day: 2, energy: 100 },
  { day: 3, energy: 150, tickets: 1 },
  { day: 4, energy: 200 },
  { day: 5, energy: 250 },
  { day: 6, energy: 300 },
  { day: 7, energy: 500, tickets: 2, special: true }
];

let isCheckingIn = false;

export function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysDiff(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  d1.setHours(0,0,0,0);
  d2.setHours(0,0,0,0);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function normalizeCheckInRewardDay(streak, fallback = 1) {
  const numeric = Number.isFinite(streak) ? Math.floor(streak) : 0;
  if (numeric <= 0) return fallback;
  return ((numeric - 1) % CHECKIN_REWARDS.length) + 1;
}

function getNextCheckInRewardDay(streak) {
  return (normalizeCheckInRewardDay(streak) % CHECKIN_REWARDS.length) + 1;
}

export function initDailyCheckIn() {
  const btn = document.getElementById("daily-checkin-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      sounds.playClick();
      showCheckInModal();
    });
  }
  
  const closeBtn = document.getElementById("checkin-modal-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      sounds.playClick();
      document.getElementById("checkin-modal").classList.remove("active");
    });
  }
  
  const submitBtn = document.getElementById("checkin-submit-btn");
  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      if (submitBtn.disabled || isCheckingIn) return;
      performCheckIn();
    });
  }
}

export function checkAutoCheckIn() {
  const todayStr = getTodayDateString();
  let diff = 999;
  if (gameState.lastCheckInDate) {
    diff = getDaysDiff(gameState.lastCheckInDate, todayStr);
  }
  
  if (diff > 0) {
    setTimeout(() => {
      showCheckInModal();
    }, 1000);
  }
}

export function showCheckInModal() {
  const todayStr = getTodayDateString();
  let diff = 999;
  if (gameState.lastCheckInDate) {
    diff = getDaysDiff(gameState.lastCheckInDate, todayStr);
  }
  
  const alreadyCheckedInToday = (diff === 0);
  let currentClaimDay = 1;
  
  if (gameState.lastCheckInDate) {
    if (diff === 0) {
      currentClaimDay = normalizeCheckInRewardDay(gameState.checkInStreak);
    } else if (diff === 1) {
      currentClaimDay = getNextCheckInRewardDay(gameState.checkInStreak);
    } else {
      currentClaimDay = 1;
    }
  }
  
  const grid = document.getElementById("checkin-grid");
  if (grid) {
    grid.innerHTML = "";
    CHECKIN_REWARDS.forEach(reward => {
      const dayCard = document.createElement("div");
      dayCard.className = `checkin-day-card day-${reward.day}`;
      
      let statusText = "鎖定中";
      let isChecked = false;
      let isActive = false;
      
      if (reward.day < currentClaimDay) {
        statusText = "已簽到";
        isChecked = true;
      } else if (reward.day === currentClaimDay) {
        if (alreadyCheckedInToday) {
          statusText = "已簽到";
          isChecked = true;
        } else {
          statusText = "可簽到";
          isActive = true;
        }
      } else {
        statusText = "未簽到";
      }
      
      if (isChecked) dayCard.classList.add("checked");
      if (alreadyCheckedInToday && reward.day === currentClaimDay) dayCard.classList.add("active");
      if (isActive) dayCard.classList.add("active");
      
      const rewardParts = [`+${reward.energy} ⚡`];
      if (reward.tickets) rewardParts.push(`+${reward.tickets} 🎫`);
      const rewardIcon = reward.special ? "🎁" : (reward.tickets ? "🎫" : "⚡");
      const rewardVal = rewardParts.join(" · ");

      dayCard.innerHTML = `
        <span class="day-label">第 ${reward.day} 天</span>
        <span class="reward-icon">${rewardIcon}</span>
        <span class="reward-val">${rewardVal}</span>
        <div class="checkin-status-badge">${statusText}</div>
      `;
      grid.appendChild(dayCard);
    });
  }
  
  const submitBtn = document.getElementById("checkin-submit-btn");
  if (submitBtn) {
    if (alreadyCheckedInToday) {
      submitBtn.disabled = true;
      submitBtn.querySelector("span").innerText = "今日已完成簽到";
      submitBtn.style.opacity = "0.6";
      submitBtn.style.pointerEvents = "none";
    } else {
      submitBtn.disabled = false;
      submitBtn.querySelector("span").innerText = `領取第 ${currentClaimDay} 天獎勵`;
      submitBtn.style.opacity = "1";
      submitBtn.style.pointerEvents = "auto";
    }
  }
  
  document.getElementById("checkin-modal").classList.add("active");
}

export function performCheckIn() {
  if (isCheckingIn) return;

  const todayStr = getTodayDateString();
  let diff = 999;
  if (gameState.lastCheckInDate) {
    diff = getDaysDiff(gameState.lastCheckInDate, todayStr);
  }
  
  if (diff === 0) {
    showCheckInModal();
    return;
  }

  isCheckingIn = true;
  const submitBtn = document.getElementById("checkin-submit-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.6";
    submitBtn.style.pointerEvents = "none";
  }
  
  let nextStreak = 1;
  if (gameState.lastCheckInDate && diff === 1) {
    nextStreak = getNextCheckInRewardDay(gameState.checkInStreak);
  }
  
  const reward = CHECKIN_REWARDS[nextStreak - 1];
  gameState.energy += reward.energy;
  if (reward.tickets) {
    addDrawTickets(reward.tickets);
  }
  gameState.checkInStreak = nextStreak;
  gameState.lastCheckInDate = todayStr;
  saveGameData();
  
  sounds.playTone(800, 'sine', 0.15);
  setTimeout(() => sounds.playTone(1000, 'sine', 0.2), 150);
  
  confetti.spawn(60);
  const ticketText = reward.tickets ? `、🎫${reward.tickets} 閃卡券` : "";
  showToast(`🎉 簽到成功！獲得第 ${nextStreak} 天獎勵：+${reward.energy} 能量${ticketText}！`);
  updateProfileBar();
  
  if (reward.special) {
    setTimeout(() => {
      drawRandomCardForCheckIn();
    }, 1200);
  }
  
  document.getElementById("checkin-modal").classList.remove("active");
  isCheckingIn = false;
}
