/**
 * 成語大冒險 - UI 與視窗管理模組
 */

import { gameState, saveGameData, ACHIEVEMENTS_LIST, getRankTitle, getNextLevelXP, getUnlockedCardCount, recordLearnedIdiom } from './state.js';
import { sounds } from './audio.js';
import { CARD_SETS, getIdiomRarity, renderMascotScreen, stopMascotDialogueTimer, renderSubScreenCards } from './mascot.js';
import { checkAutoCheckIn } from './checkin.js';

const RARITY_ORDER = { SSR: 4, SR: 3, R: 2, N: 1 };

export const SCREENS = {
  splash: document.getElementById("splash-screen"),
  dashboard: document.getElementById("dashboard-screen"),
  library: document.getElementById("library-screen"),
  achievements: document.getElementById("achievements-screen"),
  game: document.getElementById("game-screen"),
  mascot: document.getElementById("mascot-screen")
};

// proceedNext 引用（由 minigames.js 註冊）
let proceedNextRef = null;
export function setProceedNext(fn) {
  proceedNextRef = fn;
}

function resetDetailModalScroll() {
  const body = document.getElementById("detail-modal-body");
  const modalCard = document.querySelector("#detail-modal .detail-modal-card");
  if (body) body.scrollTop = 0;
  if (modalCard) modalCard.scrollTop = 0;
}

// renderLibrary 引用（供搜尋框即時重繪）
let renderLibraryRef = null;
export function setRenderLibraryRef(fn) {
  renderLibraryRef = fn;
}

export function formatEnergyAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  if (Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(amount) >= 10000) {
    return `${(amount / 1000).toFixed(amount >= 100000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }
  return Math.round(amount).toLocaleString("en-US");
}

export function updateEnergyDisplay() {
  const energyAmtEls = document.querySelectorAll("[data-energy-amount], #energy-amount");
  if (!energyAmtEls.length) return;
  const displayText = formatEnergyAmount(gameState.energy);
  const titleText = `${Math.round(Number(gameState.energy) || 0).toLocaleString("en-US")} 能量`;
  energyAmtEls.forEach((energyAmtEl) => {
    energyAmtEl.innerText = displayText;
    energyAmtEl.title = titleText;
  });
}

export function updateDrawTicketDisplay() {
  const ticketAmtEls = document.querySelectorAll("[data-draw-ticket-amount]");
  if (!ticketAmtEls.length) return;
  const amount = Math.max(0, Math.floor(Number(gameState.drawTickets) || 0));
  const displayText = amount.toLocaleString("en-US");
  const titleText = `${displayText} 閃卡券`;
  ticketAmtEls.forEach((ticketAmtEl) => {
    ticketAmtEl.innerText = displayText;
    ticketAmtEl.title = titleText;
  });
}

export function updateCurrencyDisplays() {
  updateEnergyDisplay();
  updateDrawTicketDisplay();
}

const SCREEN_ORDER = {
  mascot: 0,
  dashboard: 1,
  library: 2,
  achievements: 3
};
let currentScreenIndex = 0;

export function switchScreen(screenKey) {
  let directionClass = 'slide-in-right';
  if (SCREEN_ORDER[screenKey] !== undefined) {
    const newIndex = SCREEN_ORDER[screenKey];
    if (newIndex < currentScreenIndex) {
      directionClass = 'slide-in-left';
    } else if (newIndex > currentScreenIndex) {
      directionClass = 'slide-in-right';
    }
    currentScreenIndex = newIndex;
  }

  Object.values(SCREENS).forEach(screen => {
    screen.classList.remove("active", "slide-in-left", "slide-in-right");
  });
  
  if (stopMascotDialogueTimer) {
    stopMascotDialogueTimer();
  }
  
  SCREENS[screenKey].classList.add("active", directionClass);
  
  const botNav = document.getElementById("bottom-nav");
  if (screenKey === 'splash' || screenKey === 'game') {
    botNav.style.display = 'none';
  } else {
    botNav.style.display = 'flex';
  }
  
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
  if (screenKey === 'dashboard') {
    document.getElementById("nav-adventure").classList.add("active");
  }
  if (screenKey === 'library') {
    document.getElementById("nav-library").classList.add("active");
    renderLibrary();
    renderSubScreenCards();
    updateCurrencyDisplays();
  }
  if (screenKey === 'achievements') {
    document.getElementById("nav-achievements").classList.add("active");
    renderAchievements();
  }
  if (screenKey === 'mascot') {
    document.getElementById("nav-mascot").classList.add("active");
    renderMascotScreen();
    checkAutoCheckIn();
  }
}

export function showToast(message) {
  const toast = document.getElementById("toast-message");
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

export function updateProfileBar() {
  document.getElementById("user-rank").innerText = `Lv.${gameState.level} · ${gameState.rank}`;
  const nextXP = getNextLevelXP(gameState.level);
  document.getElementById("xp-text").innerText = `${gameState.xp} / ${nextXP}`;
  const percent = Math.min(100, (gameState.xp / nextXP) * 100);
  document.getElementById("xp-bar-inner").style.width = `${percent}%`;
  
  const nameEl = document.getElementById("user-name");
  if (nameEl) {
    nameEl.innerText = gameState.equippedTitle || "成語小達人";
  }
  
  const evo = getMascotEvolution(gameState.level);
  const promoMascotImg = document.getElementById("promo-mascot-img");
  const mascotStatus = document.getElementById("mascot-status");
  if (promoMascotImg) promoMascotImg.src = evo.img;
  if (mascotStatus) mascotStatus.innerText = `吉祥物形態：${evo.name}`;

  const currentLevelStat = document.getElementById("current-level-stat");
  if (currentLevelStat) {
    currentLevelStat.innerText = gameState.currentAdventureLevel || 1;
  }

  const cardsStat = document.getElementById("cards-stat");
  if (cardsStat) {
    cardsStat.innerText = getUnlockedCardCount(gameState);
  }
  
  const userAvatarImg = document.getElementById("user-avatar-img");
  if (userAvatarImg) {
    userAvatarImg.src = evo.img;
  }

  updateCurrencyDisplays();

  if (SCREENS.mascot && SCREENS.mascot.classList.contains("active")) {
    renderMascotScreen();
  }
}

// 取得小屋進化形態資料的輔助函數
function getMascotEvolution(level) {
  if (level >= 16) return { emoji: "🐉", name: "九天化神龍 🐉", img: "assets/mascots/mascot_stage7.webp" };
  if (level >= 13) return { emoji: "🦋👑", name: "金冠蝴蝶王 🦋👑", img: "assets/mascots/mascot_stage6.webp" };
  if (level >= 11) return { emoji: "🦋", name: "七彩羽化蝶 🦋", img: "assets/mascots/mascot_stage5.webp" };
  if (level >= 8) return { emoji: "🐛🎓", name: "狀元學者蟲 🎓", img: "assets/mascots/mascot_stage4.webp" };
  if (level >= 5) return { emoji: "🐛👓", name: "秀才眼鏡蟲 👓", img: "assets/mascots/mascot_stage3.webp" };
  if (level >= 3) return { emoji: "🐛✨", name: "發光小書蟲 ✨", img: "assets/mascots/mascot_stage2.webp" };
  return { emoji: "🐛", name: "寶寶小書蟲 🐛", img: "assets/mascots/mascot_stage1.webp" };
}

export function checkAchievements(roundSuccess = false, accuracy = 0, silent = false) {
  let newlyUnlocked = [];
  
  ACHIEVEMENTS_LIST.forEach(ach => {
    if (!gameState.unlockedAchievements.includes(ach.id)) {
      if (ach.check(gameState, roundSuccess, accuracy, window.isExtremeRescue)) {
        gameState.unlockedAchievements.push(ach.id);
        newlyUnlocked.push(ach);
      }
    }
  });
  
  if (newlyUnlocked.length > 0) {
    let earnedEnergy = 0;
    let earnedTickets = 0;
    
    newlyUnlocked.forEach(ach => {
      if (ach.reward) {
        if (ach.reward.type === 'energy') {
          earnedEnergy += ach.reward.amount;
        } else if (ach.reward.type === 'drawTickets') {
          earnedTickets += ach.reward.amount;
        }
      }
    });

    if (earnedEnergy > 0) gameState.energy += earnedEnergy;
    if (earnedTickets > 0) gameState.drawTickets += earnedTickets;
    
    saveGameData();
    if (!silent) {
      newlyUnlocked.forEach((ach, i) => {
        setTimeout(() => {
          sounds.playLevelUp();
          let rewardMsg = "";
          if (ach.reward) {
            if (ach.reward.type === 'energy') rewardMsg = `\n🎁 獲得獎勵：${ach.reward.amount} ⚡`;
            else if (ach.reward.type === 'drawTickets') rewardMsg = `\n🎁 獲得獎勵：${ach.reward.amount} 🎫`;
          }
          showToast(`🏆 解鎖成就：${ach.title}！${rewardMsg}`);
          updateCurrencyDisplays();
        }, i * 1500); // Stagger toasts if multiple
      });
    }
  }
}

export function unlockIdiom(idiomId) {
  if (idiomId) {
    let changed = false;
    if (!gameState.learnedIdioms.includes(idiomId)) {
      gameState.learnedIdioms.push(idiomId);
      changed = true;
    }
    if (!Array.isArray(gameState.unlockedCards)) gameState.unlockedCards = [];
    if (!gameState.unlockedCards.includes(idiomId)) {
      gameState.unlockedCards.push(idiomId);
      changed = true;
    }
    if (recordLearnedIdiom(idiomId)) {
      changed = true;
    }
    if (changed) {
      saveGameData();
      checkAchievements();
    }
  }
}

export function getRubyHTML(idiomText, bopomofoText, extraClass = '') {
  const chars = idiomText.split("");
  const bopomofos = bopomofoText.split(" ");
  
  let html = `<div class="ruby-idiom-container ${extraClass}">`;
  
  chars.forEach((char, ci) => {
    const toneMarks = ['ˊ', 'ˇ', 'ˋ', '˙'];
    let syllable = bopomofos[ci] || "";
    let tone = "";
    for (const t of toneMarks) {
      if (syllable.includes(t)) {
        tone = t;
        syllable = syllable.replace(t, "");
        break;
      }
    }
    
    html += `
      <div class="ruby-char-group">
        <span class="ruby-main-char">${char}</span>
        <span class="ruby-annotation">
          <span class="ruby-phonetics">${syllable}</span>
          ${tone ? `<span class="ruby-tone">${tone}</span>` : ''}
        </span>
      </div>
    `;
  });
  
  html += `</div>`;
  return html;
}

function shouldShowIdiomStory(story) {
  if (typeof story !== "string" || !story.trim()) return false;
  return !story.trim().startsWith("成語由來：古人常用");
}

function markImageMissing(img, containerSelector) {
  const container = img.closest(containerSelector);
  if (container) {
    container.classList.add("image-missing");
  }
  img.remove();
}

export function renderLibrary() {
  const grid = document.getElementById("library-grid");
  if (!grid) return;
  grid.innerHTML = "";
  
  const searchInput = document.getElementById("library-search-input");
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const cardFilter = document.getElementById("library-card-filter")?.value || "all";
  const setFilter = document.getElementById("library-set-filter")?.value || "all";
  const sortMode = document.getElementById("library-sort-filter")?.value || "default";
  const summary = document.getElementById("library-filter-summary");
  const setSelect = document.getElementById("library-set-filter");

  if (setSelect && setSelect.options.length <= 1) {
    CARD_SETS.forEach(set => {
      const option = document.createElement("option");
      option.value = set.id;
      option.textContent = set.name;
      setSelect.appendChild(option);
    });
  }
  const selectedSet = CARD_SETS.find(set => set.id === setFilter);
  
  const filteredIdioms = IDIOMS_DATA.filter(item => {
    const isCollected = gameState.unlockedCards?.includes(item.id);
    if (searchQuery && !item.idiom.includes(searchQuery) && !item.pinyin.toLowerCase().includes(searchQuery) && !item.bopomofo.includes(searchQuery)) {
      return false;
    }
    if (cardFilter === "collected" && !isCollected) {
      return false;
    }
    if (cardFilter === "uncollected" && isCollected) {
      return false;
    }
    if (selectedSet && !selectedSet.ids.includes(item.id)) {
      return false;
    }
    return true;
  });

  if (summary) {
    const total = IDIOMS_DATA.length;
    const collectedCount = new Set(gameState.unlockedCards || []).size;
    summary.textContent = `顯示 ${filteredIdioms.length} / ${total} 筆 · 已收藏 ${collectedCount}`;
  }

  filteredIdioms.sort((a, b) => {
    const aCollected = gameState.unlockedCards?.includes(a.id);
    const bCollected = gameState.unlockedCards?.includes(b.id);
    if (sortMode === "rarity") {
      const rarityDiff = RARITY_ORDER[getIdiomRarity(b.id)] - RARITY_ORDER[getIdiomRarity(a.id)];
      if (rarityDiff !== 0) return rarityDiff;
    }
    if (sortMode === "name") {
      return a.idiom.localeCompare(b.idiom, "zh-Hant");
    }
    if (aCollected && !bCollected) return -1;
    if (!aCollected && bCollected) return 1;
    return 0;
  });

  filteredIdioms.forEach(item => {
    const isCollected = gameState.unlockedCards?.includes(item.id);
    const hasDisplayStory = shouldShowIdiomStory(item.story);
    const card = document.createElement("div");
    card.className = `idiom-card ${isCollected ? '' : 'locked'} ${hasDisplayStory ? 'has-story' : ''}`;
    const rarity = getIdiomRarity(item.id);
    const cardSetViews = CARD_SETS
      .filter(set => set.ids.includes(item.id))
      .map(set => {
        const ownedCount = set.ids.filter(id => gameState.unlockedCards?.includes(id)).length;
        const progressPct = Math.round((ownedCount / set.ids.length) * 100);
        return { name: set.name, ownedCount, totalCount: set.ids.length, progressPct };
      });
    const primarySet = cardSetViews[0];
    const setInfoHTML = primarySet
      ? `
        <div class="library-card-set-info">
          <div class="library-card-set-row">
            <span>${primarySet.name}${cardSetViews.length > 1 ? ` +${cardSetViews.length - 1}` : ""}</span>
            <strong>${primarySet.progressPct}%</strong>
          </div>
          <span class="library-card-set-bar"><i style="width:${primarySet.progressPct}%"></i></span>
          <div class="library-card-set-count">${primarySet.ownedCount} / ${primarySet.totalCount} 張</div>
        </div>
      `
      : `<div class="library-card-set-info empty">未加入套卡</div>`;
    
    const storyBadgeHTML = hasDisplayStory
      ? `<span class="library-story-badge" title="\u6709\u6210\u8a9e\u5178\u6545" aria-label="\u6709\u6210\u8a9e\u5178\u6545">\u5178\u6545</span>`
      : "";

    if (isCollected) {
      card.innerHTML = `
        <div class="library-card-topline">
          <span class="library-rarity-badge rarity-${rarity}">${rarity}</span>
          <span class="library-card-state-row">${storyBadgeHTML}</span>
        </div>
        <div class="library-card-img-container">
          <button class="tts-play-btn library-tts-btn" title="朗讀成語與解釋"><svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" style="pointer-events: none;"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg></button>
          ${item.image ? `<img class="library-card-img" src="${item.image}" alt="${item.idiom}">` : ''}
        </div>
        ${getRubyHTML(item.idiom, item.bopomofo, 'library-version')}
        ${setInfoHTML}
      `;
      const ttsBtn = card.querySelector(".library-tts-btn");
      if (ttsBtn) {
        ttsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          sounds.playClick();
          sounds.speakIdiom(item.idiom, item.explanation);
        });
      }
      card.addEventListener("click", () => {
        sounds.playClick();
        showDetailModal(item, false);
      });
    } else {
      card.innerHTML = `
        <div class="library-card-topline">
          <span class="library-rarity-badge rarity-${rarity}">${rarity}</span>
          <span class="library-card-state-row">${storyBadgeHTML}</span>
        </div>
        <div class="library-card-img-container locked-placeholder">
          <span class="library-locked-lock">🔒</span>
        </div>
        <div class="ruby-idiom-container library-version locked-text">
          <div class="ruby-char-group"><span class="ruby-main-char">？</span></div>
          <div class="ruby-char-group"><span class="ruby-main-char">？</span></div>
          <div class="ruby-char-group"><span class="ruby-main-char">？</span></div>
          <div class="ruby-char-group"><span class="ruby-main-char">？</span></div>
        </div>
        ${setInfoHTML}
      `;
      card.addEventListener("click", () => {
        sounds.playError();
        showToast("尚未收藏這張成語卡，快去挑戰或抽卡吧！");
      });
    }
    card.querySelectorAll(".library-card-img").forEach(img => {
      img.addEventListener("error", () => markImageMissing(img, ".library-card-img-container"));
    });
    grid.appendChild(card);
  });
}

export function renderAchievements() {
  const grid = document.getElementById("achievements-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const getAchievementIcon = (title) => {
    const matches = String(title || "").match(/\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*|\p{Emoji_Presentation}/gu);
    return matches && matches.length ? matches[matches.length - 1] : "🏅";
  };
  
  ACHIEVEMENTS_LIST.forEach(ach => {
    const isUnlocked = gameState.unlockedAchievements.includes(ach.id);
    const achIcon = getAchievementIcon(ach.title);
    const card = document.createElement("div");
    card.className = `badge-card ${isUnlocked ? 'unlocked' : 'locked'}`;
    
    let progressHTML = "";
    if (ach.target && !ach.isHidden) {
      const current = ach.progress ? ach.progress(gameState) : gameState.learnedIdioms.length;
      const target = typeof ach.target === "function" ? ach.target(gameState) : ach.target;
      const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
      progressHTML = `
        <div class="badge-progress-container">
          <span class="badge-progress-text">${current} / ${target}</span>
          <div class="badge-progress-bar-outer">
            <div class="badge-progress-bar-inner" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }

    let titleExtra = "";
    if (ach.reward) {
      if (!isUnlocked) {
        const rewardIcon = ach.reward.type === 'energy' ? '⚡' : '🎫';
        titleExtra = `<span style="font-size: var(--text-xs2); color: #4A5568; margin-left: 8px; font-weight: bold; background: #EDF2F7; padding: 3px 6px; border-radius: 6px; vertical-align: middle;">🎁 ${ach.reward.amount} ${rewardIcon}</span>`;
      }
    }
    
    let equipBtnHTML = "";
    if (isUnlocked) {
      const isEquipped = gameState.equippedTitle === ach.title;
      const btnBg = isEquipped ? 'var(--action-primary)' : '#EDF2F7';
      const btnColor = isEquipped ? '#ffffff' : '#4A5568';
      const btnShadow = isEquipped ? '0 2px 4px rgba(227, 62, 80, 0.2)' : 'none';
      equipBtnHTML = `
        <button class="equip-title-btn" 
          style="margin-top: 0; font-size: 11.2px; padding: 6px 12px; width: auto; font-weight:bold; border-radius:12px; border:none; background:${btnBg}; color:${btnColor}; box-shadow:${btnShadow}; cursor:pointer;"
          data-title="${ach.title}">
          ${isEquipped ? '✨ 使用中' : '配戴稱號'}
        </button>
      `;
    }
    
    let displayTitle = ach.title;
    let displayDesc = ach.desc;
    if (ach.isHidden && !isUnlocked) {
      displayTitle = "??? 🔒";
      displayDesc = ach.desc === "???" ? "達成神秘條件解鎖" : ach.desc;
    } else if (ach.isHidden && isUnlocked) {
      displayDesc = ach.hiddenDesc || ach.desc;
    }

    card.innerHTML = `
      <div class="badge-medal-art">
        <span class="badge-main-icon">${achIcon}</span>
        ${isUnlocked ? '' : '<span class="badge-lock-mini">🔒</span>'}
      </div>
      <div class="badge-details" style="align-items: flex-start; gap: 4px; padding: 4px 0;">
        <h3 class="badge-title" style="display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
          ${displayTitle}
          ${titleExtra}
        </h3>
        <p class="badge-desc" style="margin: 0; line-height: 1.3;">${displayDesc}</p>
        ${progressHTML}
      </div>
      <div style="flex-shrink: 0; margin-left: auto; min-width: 78px; display: flex; justify-content: flex-end;">
        ${equipBtnHTML}
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  grid.querySelectorAll(".equip-title-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const title = btn.getAttribute("data-title");
      gameState.equippedTitle = title;
      saveGameData();
      sounds.playClick();
      showToast(`✨ 已配戴稱號：${title}！`);
      renderAchievements();
      updateProfileBar();
    });
  });
}

export function showDetailModal(idiomItemOrArray, isInteractiveQuiz = false) {
  const modal = document.getElementById("detail-modal");
  const modalCard = modal.querySelector(".detail-modal-card");
  const body = document.getElementById("detail-modal-body");
  const actions = document.getElementById("detail-modal-actions");
  body.innerHTML = "";
  actions.innerHTML = "";
  resetDetailModalScroll();
  modalCard.classList.remove("has-actions");
  
  const idiomItems = Array.isArray(idiomItemOrArray) ? idiomItemOrArray : [idiomItemOrArray];
  
  idiomItems.forEach((idiomItem, index) => {
    if (index > 0) {
      const divider = document.createElement("hr");
      divider.style.cssText = "border: none; border-top: 2px dashed #E1E6EB; margin: 18px 0;";
      body.appendChild(divider);
    }
    
    if (idiomItems.length > 1) {
      const dirLabel = document.createElement("div");
      dirLabel.style.cssText = "font-size: 12.8px; font-weight: 900; padding: 3px 10px; border-radius: 8px; display: inline-block; margin-bottom: 6px;";
      if (index === 0) {
        dirLabel.style.background = "#E0F2FE";
        dirLabel.style.color = "#0284C7";
        dirLabel.innerText = "➡️ 橫向成語";
      } else {
        dirLabel.style.background = "#F0FDF4";
        dirLabel.style.color = "#16A34A";
        dirLabel.innerText = "⬇️ 縱向成語";
      }
      body.appendChild(dirLabel);
    }
    
    const rubyWrapper = document.createElement("div");
    rubyWrapper.innerHTML = getRubyHTML(idiomItem.idiom, idiomItem.bopomofo);
    const rubyContainer = rubyWrapper.firstElementChild;
    
    const titleRow = document.createElement("div");
    titleRow.className = "modal-detail-title-row";
    titleRow.appendChild(rubyContainer);
    
    const ttsBtn = document.createElement("button");
    ttsBtn.className = "tts-play-btn";
    ttsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" style="pointer-events: none;"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
    ttsBtn.title = "朗讀成語與解釋";
    ttsBtn.onclick = () => {
      sounds.playClick();
      sounds.speakIdiom(idiomItem.idiom, idiomItem.explanation);
    };
    titleRow.appendChild(ttsBtn);
    
    body.appendChild(titleRow);
    
    if (idiomItem.image && idiomItems.length === 1) {
      const imgContainer = document.createElement("div");
      imgContainer.className = "modal-detail-img-container";
      const img = document.createElement("img");
      img.src = idiomItem.image;
      img.className = "modal-detail-img";
      img.addEventListener("error", () => markImageMissing(img, ".modal-detail-img-container"));
      imgContainer.appendChild(img);
      imgContainer.appendChild(ttsBtn); // 移到圖片右上方
      body.appendChild(imgContainer);
    }
    
    const defSec = document.createElement("div");
    defSec.className = "modal-detail-section";
    defSec.innerHTML = `
      <div class="modal-detail-title">💡 成語解釋</div>
      <div class="modal-detail-text">${idiomItem.explanation}</div>
    `;
    body.appendChild(defSec);
    
    if (shouldShowIdiomStory(idiomItem.story)) {
      const storySec = document.createElement("div");
      storySec.className = "modal-detail-section";
      storySec.innerHTML = `
        <div class="modal-detail-title">📖 成語典故</div>
        <div class="modal-detail-text">${idiomItem.story}</div>
      `;
      body.appendChild(storySec);
    }
    
    const exSec = document.createElement("div");
    exSec.className = "modal-detail-section";
    exSec.innerHTML = `
      <div class="modal-detail-title">✍️ 句子練習</div>
      <div class="modal-detail-text">${idiomItem.example}</div>
    `;
    body.appendChild(exSec);
  });
  
  if (isInteractiveQuiz) {
    document.getElementById("detail-modal-close").style.display = "none";
    
    const nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-primary btn-large btn-pop";
    nextBtn.innerHTML = "<span>下一題</span>";
    nextBtn.addEventListener("click", () => {
      sounds.playClick();
      sounds.stopSpeech();
      modal.classList.remove("active");
      if (proceedNextRef) {
        proceedNextRef();
      }
    });
    actions.appendChild(nextBtn);
    modalCard.classList.add("has-actions");
  } else {
    document.getElementById("detail-modal-close").style.display = "flex";
  }
  
  modal.classList.add("active");
  resetDetailModalScroll();
  requestAnimationFrame(resetDetailModalScroll);
  setTimeout(resetDetailModalScroll, 10);
  setTimeout(resetDetailModalScroll, 150);
}
