/**
 * 成語大冒險 - 遊戲關卡與小遊戲引擎模組
 */

import { gameState, LEVELS_DATA, recordCorrectIdiom, recordIncorrectIdiom, saveGameData, updateCapacityXP, addDrawTickets, applyIntimacyXpBonus, useIntimacyHintShield } from './state.js';
import { sounds } from './audio.js';
import { confetti } from './confetti.js';
import { switchScreen, showToast, updateProfileBar, showDetailModal, unlockIdiom, setProceedNext } from './ui.js';
import { recordDailyMissionProgress } from './daily-missions.js';
import { shareRankUp } from './share.js';
import { GameAnalytics } from './analytics.js';

import { shuffleArray } from './minigames/helpers.js';
import { CHAR_COMPONENTS, renderTypoQuestion, renderSimCharQuestion, renderRadicalQuestion } from './minigames/shape_sound.js';
import { IDIOM_RELATIONS, renderImageGuess, renderFillQuestion, renderStoryQuestion, renderAntonymQuestion } from './minigames/meaning_assoc.js';
import { renderMatchGame, renderChainQuestion, renderCrosswordQuestion, renderBubbleQuestion } from './minigames/reaction_memory.js';

export { shuffleArray };

function buildCrosswordPairs(sourceIdioms, requiredIds = []) {
  const requiredIdSet = new Set(requiredIds);
  const pairs = [];

  for (let i = 0; i < sourceIdioms.length; i++) {
    for (let j = i + 1; j < sourceIdioms.length; j++) {
      const idiomA = sourceIdioms[i];
      const idiomB = sourceIdioms[j];

      if (requiredIdSet.size > 0 && !requiredIdSet.has(idiomA.id) && !requiredIdSet.has(idiomB.id)) {
        continue;
      }

      for (let idxA = 0; idxA < 4; idxA++) {
        for (let idxB = 0; idxB < 4; idxB++) {
          if (idiomA.idiom[idxA] === idiomB.idiom[idxB]) {
            pairs.push({
              idiomA,
              idiomB,
              char: idiomA.idiom[idxA],
              idxA,
              idxB
            });
          }
        }
      }
    }
  }

  const coveredIds = new Set();
  pairs.forEach(pair => {
    coveredIds.add(pair.idiomA.id);
    coveredIds.add(pair.idiomB.id);
  });
  const fallbackIdioms = requiredIdSet.size > 0
    ? sourceIdioms.filter(item => requiredIdSet.has(item.id))
    : sourceIdioms;
  fallbackIdioms.forEach(item => {
    if (!coveredIds.has(item.id)) {
      pairs.push({
        idiomA: item,
        idiomB: item,
        char: item.idiom[0],
        idxA: 0,
        idxB: 0,
        fallback: true
      });
    }
  });

  return pairs;
}

export function updateChallengeLobbyLocks() {
  const level = gameState.currentAdventureLevel;
  
  const rules = {
    "mode-time":      { levelReq: 3, tier: "bronze", emoji: "🔥", tease: "刺激的限時挑戰在等你！" },
    "mode-typo":      { levelReq: 3, tier: "bronze", emoji: "🔍", tease: "練就火眼金睛！" },
    "mode-story":     { levelReq: 3, tier: "bronze", emoji: "🎭", tease: "有趣的情境故事！" },
    
    "mode-chain":     { levelReq: 6, tier: "silver", emoji: "🔗", tease: "成語首尾接龍！" },
    "mode-crossword": { levelReq: 6, tier: "silver", emoji: "🧩", tease: "挑戰空間思維！" },
    "mode-radical":   { levelReq: 6, tier: "silver", emoji: "🧱", tease: "拆字組裝挑戰！" },
    "mode-bubble":    { levelReq: 6, tier: "silver", emoji: "🎈", tease: "快手泡泡射擊！" },
    
    "mode-simchar":   { levelReq: 10, tier: "gold", emoji: "👥", tease: "終極字形辨識！" },
    "mode-antonym":   { levelReq: 10, tier: "gold", emoji: "🔀", tease: "反義對決大挑戰！" },
    "mode-synonym":   { levelReq: 10, tier: "gold", emoji: "🤝", tease: "找出語意好夥伴！" }
  };

  // 階級名稱映射
  const tierNames = {
    "bronze": "秀才",
    "silver": "舉人",
    "gold": "進士"
  };
  
  Object.keys(rules).forEach(id => {
    const card = document.getElementById(id);
    if (!card) return;
    const req = rules[id];
    
    let rankUnlocked = false;
    if (req.tier === "bronze") {
      rankUnlocked = gameState.level >= 3;
    } else if (req.tier === "silver") {
      rankUnlocked = gameState.level >= 6;
    } else {
      rankUnlocked = gameState.level >= 8;
    }

    const isUnlocked = (level >= req.levelReq) || rankUnlocked;
    
    // 清理舊狀態
    card.classList.remove("locked", "tier-bronze", "tier-silver", "tier-gold");
    const oldOverlay = card.querySelector(".lock-overlay");
    if (oldOverlay) oldOverlay.remove();
    const oldStamp = card.querySelector(".lock-stamp");
    if (oldStamp) oldStamp.remove();
    
    if (isUnlocked) {
      card.style.pointerEvents = "auto";
      const badge = card.querySelector(".badge");
      if (badge) {
        if (id.includes("time")) badge.innerText = "刺激挑戰";
        else if (id.includes("typo")) badge.innerText = "字形辨析";
        else if (id.includes("story")) badge.innerText = "情境應用";
        else if (id.includes("chain")) badge.innerText = "字尾接龍";
        else if (id.includes("crossword")) badge.innerText = "空間聯想";
        else if (id.includes("radical")) badge.innerText = "字形結構";
        else if (id.includes("bubble")) badge.innerText = "動態速讀";
        else if (id.includes("simchar")) badge.innerText = "字形辨析";
        else if (id.includes("antonym") || id.includes("synonym")) badge.innerText = "語意連結";
        badge.style.background = ""; 
      }
    } else {
      card.classList.add("locked", `tier-${req.tier}`);
      card.style.pointerEvents = "auto";
      
      // 更新徽章為期待文案
      const badge = card.querySelector(".badge");
      if (badge) {
        badge.innerText = `${req.emoji} ${req.tease}`;
        badge.style.background = req.tier === "bronze" ? "#E6A44C"
                               : req.tier === "silver" ? "#7B9FD4"
                               : "#D4A54C";
        badge.style.color = "white";
      }

      // 計算進度
      const progress = Math.min(Math.round((level / req.levelReq) * 100), 99);
      const remaining = req.levelReq - level;

      // 添加鎖頭圖章
      const stamp = document.createElement("div");
      stamp.className = "lock-stamp";
      stamp.textContent = "🔒";
      card.appendChild(stamp);

      // 添加進度覆蓋層
      const overlay = document.createElement("div");
      overlay.className = "lock-overlay";
      overlay.innerHTML = `
        <div class="lock-label">
          <span>🗺️ 再闖 ${remaining} 關</span>
          <span style="margin-left:auto; opacity:0.85;">或升到 ${tierNames[req.tier]}</span>
        </div>
        <div class="lock-progress-bar">
          <div class="lock-progress-fill" style="width: ${progress}%"></div>
        </div>
      `;
      card.appendChild(overlay);
    }
  });
}

function getIdiomNames(idiomIds) {
  if (!idiomIds || idiomIds.length === 0) return "";
  return IDIOMS_DATA
    .filter(item => idiomIds.includes(item.id))
    .map(item => item.idiom)
    .join("、");
}

function scrollAdventureMapToCurrent() {
  const adventureView = document.getElementById("adventure-view");
  if (!adventureView || !adventureView.classList.contains("active")) return;

  const scrollContainer = document.querySelector("#dashboard-screen .dashboard-panel-scroll");
  const target = document.querySelector("[data-current-adventure-target='true']");
  if (!scrollContainer || !target) return;

  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const offset = targetRect.top - containerRect.top - 88;

  scrollContainer.scrollTop = scrollContainer.scrollTop + offset;
}

function getLevelPreviewImage(level) {
  if (level.isBoss) return "assets/icons/boss_level_icon.jpg";
  const idiomId = level.idiomIds && level.idiomIds[0];
  const item = Array.isArray(IDIOMS_DATA) ? IDIOMS_DATA.find(candidate => candidate.id === idiomId) : null;
  return item?.image || "assets/app_icon.png";
}

function getLevelModeShortLabel(mode, isBoss = false) {
  if (isBoss) return "魔王";
  const labels = {
    image: "看圖",
    fill: "填空",
    match: "配對",
    typo: "糾錯",
    story: "故事",
    radical: "部首",
    bubble: "泡泡",
    simchar: "辨字",
    crossword: "填字",
    time: "限時",
    chain: "接龍"
  };
  return labels[mode] || "挑戰";
}

function getAdventureZones() {
  const zones = [];
  const seenTitles = new Set();
  LEVELS_DATA.forEach(level => {
    if (!level.zoneTitle || seenTitles.has(level.zoneTitle)) return;
    seenTitles.add(level.zoneTitle);
    zones.push({
      title: level.zoneTitle,
      theme: level.zoneTheme || "",
      firstLevelId: level.id
    });
  });
  return zones;
}

function getZoneShortTitle(title, index) {
  return String(index + 1);
}

function scrollAdventureMapToZone(zoneIndex) {
  const adventureView = document.getElementById("adventure-view");
  const scrollContainer = document.querySelector("#dashboard-screen .dashboard-panel-scroll");
  const target = document.querySelector(`[data-adventure-zone-index="${zoneIndex}"]`);
  if (!adventureView || !scrollContainer || !target) return;

  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const offset = targetRect.top - containerRect.top - 8;
  scrollContainer.scrollTop = scrollContainer.scrollTop + offset;

  document.querySelectorAll(".zone-jump-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.zoneIndex === String(zoneIndex));
  });
}

function trySpawnMapEvent() {
  if (gameState.mapEvent && gameState.mapEvent.expiresAt > Date.now()) {
    return;
  }
  
  if (gameState.mapEvent) {
    gameState.mapEvent = null;
  }
  
  // 10% chance to spawn an event
  if (Math.random() > 0.1) return;
  
  const eligibleLevels = LEVELS_DATA.filter(l => !l.isBoss && (gameState.levelStars[`level_${l.id}`] === 3));
  if (eligibleLevels.length === 0) return;
  
  const targetLevel = eligibleLevels[Math.floor(Math.random() * eligibleLevels.length)];
  
  gameState.mapEvent = {
    levelId: targetLevel.id,
    type: "chest",
    icon: "🎁",
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  };
}

export function renderAdventureMap() {
  trySpawnMapEvent();
  const container = document.getElementById("adventure-map-container");
  if (!container) return;
  
  container.innerHTML = "";
  const zoneJumpHost = document.getElementById("adventure-zone-jump-container");
  if (zoneJumpHost) {
    zoneJumpHost.innerHTML = "";
  }

  const currentTargetLevel = LEVELS_DATA.find(level => (gameState.levelStars[`level_${level.id}`] || 0) === 0);
  const allLevelsCompleted = !currentTargetLevel;
  const currentTargetZoneTitle = currentTargetLevel?.zoneTitle || LEVELS_DATA[LEVELS_DATA.length - 1]?.zoneTitle || "";
  const zones = getAdventureZones();
  const zoneJump = document.createElement("div");
  zoneJump.className = "adventure-zone-jump";
  zoneJump.setAttribute("aria-label", "地區快速前往");
  zones.forEach((zone, index) => {
    const isActiveZone = zone.title === currentTargetZoneTitle;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `zone-jump-btn ${isActiveZone ? "active" : ""}`;
    button.dataset.zoneIndex = String(index);
    button.setAttribute("aria-label", `前往${zone.title}`);
    button.innerHTML = `
      <span class="zone-jump-index">${getZoneShortTitle(zone.title, index)}</span>
    `;
    button.addEventListener("click", () => {
      sounds.playClick();
      scrollAdventureMapToZone(index);
    });
    zoneJump.appendChild(button);
  });
  if (zoneJumpHost) {
    zoneJumpHost.appendChild(zoneJump);
  } else {
    container.appendChild(zoneJump);
  }
  
  let currentZoneTitle = "";
  let currentZoneContainer = null;
  let currentPathContainer = null;
  let zoneIndex = -1;
  let currentZoneSceneryCount = 0;
  
  LEVELS_DATA.forEach(level => {
    // Check for Zone change
    if (level.zoneTitle && level.zoneTitle !== currentZoneTitle) {
      currentZoneTitle = level.zoneTitle;
      zoneIndex++;
      currentZoneSceneryCount = 0;
      
      currentZoneContainer = document.createElement("div");
      currentZoneContainer.className = `zone-container theme-zone-${zoneIndex % 10}`;
      currentZoneContainer.dataset.adventureZoneIndex = String(zoneIndex);
      
      const zoneHeader = document.createElement("div");
      zoneHeader.className = `zone-header ${level.zoneTheme || ''}`;
      zoneHeader.innerText = currentZoneTitle;
      currentZoneContainer.appendChild(zoneHeader);
      
      currentPathContainer = document.createElement("div");
      currentPathContainer.className = "path-container";
      currentZoneContainer.appendChild(currentPathContainer);
      
      container.appendChild(currentZoneContainer);
    }

    const isUnlocked = level.id <= gameState.currentAdventureLevel;
    const stars = gameState.levelStars[`level_${level.id}`] || 0;
    const isCompleted = stars > 0;
    const isCurrentTarget = currentTargetLevel && level.id === currentTargetLevel.id;
    
    // Assign S-curve position (0-9)
    const indexInZone = (level.id - 1) % 10;
    const node = document.createElement("div");
    const previewImage = getLevelPreviewImage(level);

    if (currentZoneContainer && !level.isBoss && [0, 3, 6].includes(indexInZone)) {
      const scenery = document.createElement("div");
      scenery.className = `zone-scenery scenery-pos-${currentZoneSceneryCount % 3}`;
      scenery.innerHTML = `<img src="${previewImage}" alt="">`;
      currentZoneContainer.insertBefore(scenery, currentPathContainer);
      currentZoneSceneryCount++;
    }
    let baseClass = `path-node path-pos-${indexInZone} ${isUnlocked ? (isCompleted ? 'completed' : 'play') : 'locked'}`;
    
    if (level.isBoss) {
      baseClass += ' boss-node';
    }
    if (isCurrentTarget) {
      baseClass += ' current-node';
    }
    node.className = baseClass;
    
    if (isCurrentTarget) {
      node.dataset.currentAdventureTarget = "true";
    }

    node.setAttribute("role", "button");
    node.setAttribute("aria-label", `${level.title}，${isUnlocked ? (isCompleted ? `已完成 ${stars} 顆星` : "可挑戰") : "尚未解鎖"}`);
    if (isUnlocked) {
      node.tabIndex = 0;
    }
    
    const modeLabel = getLevelModeShortLabel(level.mode, level.isBoss);
    let nodeContent = level.isBoss ? "👑" : level.id;
    if (level.isBoss && !isUnlocked) {
      nodeContent = "🔒";
    } else if (!isUnlocked) {
      nodeContent = "🔒";
    }
    
    let starStr = "";
    if (isCompleted && !level.isBoss) {
      for (let i = 1; i <= 3; i++) {
        starStr += i <= stars ? "⭐" : "☆";
      }
    } else if (isCompleted && level.isBoss) {
      starStr = "🏆";
    }
    
    let starsHtml = starStr ? `<div class="node-stars">${starStr}</div>` : "";
    
    let eventBadgeHtml = "";
    const hasEvent = gameState.mapEvent && gameState.mapEvent.levelId === level.id;
    if (hasEvent) {
      eventBadgeHtml = `<div class="map-event-badge">${gameState.mapEvent.icon || "🎁"}</div>`;
    }
    
    node.innerHTML = `
      <div class="node-image-wrap">
        <img class="node-image" src="${previewImage}" alt="">
      </div>
      <span class="node-level-chip">${nodeContent}</span>
      <span class="node-mode-chip">${modeLabel}</span>
      ${starsHtml}
      ${eventBadgeHtml}
    `;
    
    if (isUnlocked) {
      const startLevel = () => {
        if (hasEvent) {
          const introModal = document.getElementById("map-event-intro-modal");
          if (introModal) {
            introModal.classList.add("active");
            introModal.dataset.eventLevelId = String(level.id);
            sounds.playClick();
          }
        } else {
          startAdventureLevel(level.id);
        }
      };
      node.addEventListener("click", startLevel);
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          startLevel();
        }
      });
    }
    
    currentPathContainer.appendChild(node);
  });
  
  // Ultimate Claim logic at the end
  const ultimateClaimId = "ultimate_dragon";
  const isUltimateReady = LEVELS_DATA.every(level => (gameState.levelStars[`level_${level.id}`] || 0) > 0);
  const isUltimateClaimed = gameState.claimedSets.includes(ultimateClaimId);
  const ultimateStatusClass = isUltimateClaimed ? "completed" : (isUltimateReady ? "play" : "locked");
  const ultimateStatusText = isUltimateClaimed ? "已完成 🐉" : (isUltimateReady ? "領取 ✨" : "期待中");

  const ultimateNode = document.createElement("div");
  ultimateNode.className = `path-node boss-node path-pos-0 ${ultimateStatusClass}`;
  if (allLevelsCompleted) {
    ultimateNode.dataset.currentAdventureTarget = "true";
  }
  
  ultimateNode.innerHTML = `
    <div class="node-image-wrap">
      <img class="node-image" src="assets/app_icon.png" alt="">
    </div>
    <span class="node-level-chip">🐉</span>
    <span class="node-mode-chip">終章</span>
    <div class="node-stars">${ultimateStatusText}</div>
  `;
  
  if (isUltimateReady && !isUltimateClaimed) {
    ultimateNode.addEventListener("click", () => {
      sounds.playLevelUp();
      confetti.spawn(160);
      if (gameState.intimacyLevel < 16) {
        gameState.intimacyLevel = 16;
        gameState.intimacyXP = 0;
      }
      gameState.claimedSets.push(ultimateClaimId);
      saveGameData();
      import('./ui.js').then(module => module.updateProfileBar());
      showToast("🐉 九天化神龍覺醒！最終形態已解鎖！");
      renderAdventureMap();
    });
  } else if (!isUltimateReady) {
    ultimateNode.addEventListener("click", () => {
      sounds.playClick();
      showToast(`先通關全部 ${LEVELS_DATA.length} 關，就能喚醒九天化神龍！`);
    });
  }
  
  if (currentPathContainer) {
    currentPathContainer.appendChild(ultimateNode);
  } else {
    container.appendChild(ultimateNode);
  }

  // Use requestAnimationFrame to ensure nodes are laid out before drawing SVG paths
  requestAnimationFrame(() => {
    drawAllPaths();
  });

  setTimeout(scrollAdventureMapToCurrent, 80);
  setTimeout(scrollAdventureMapToCurrent, 260);
}

function drawAllPaths() {
  const containers = document.querySelectorAll('.path-container');
  containers.forEach(container => {
    const oldSvg = container.querySelector('.svg-road-overlay');
    if (oldSvg) oldSvg.remove();
    
    const nodes = Array.from(container.querySelectorAll('.path-node'));
    if (nodes.length < 2) return;
    
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "svg-road-overlay");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    
    let pathData = "";
    
    nodes.forEach((node, index) => {
      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      
      const x = (nodeRect.left - containerRect.left) + nodeRect.width / 2;
      const y = (nodeRect.top - containerRect.top) + nodeRect.height / 2;
      
      if (index === 0) {
        pathData += `M ${x} ${y} `;
      } else {
        const prevNode = nodes[index - 1];
        const prevNodeRect = prevNode.getBoundingClientRect();
        const prevX = (prevNodeRect.left - containerRect.left) + prevNodeRect.width / 2;
        const prevY = (prevNodeRect.top - containerRect.top) + prevNodeRect.height / 2;
        
        const wiggle = index % 2 === 0 ? 42 : -42;
        const cp1x = prevX + wiggle;
        const cp1y = prevY + (y - prevY) / 2;
        const cp2x = x - wiggle;
        const cp2y = prevY + (y - prevY) / 2;
        
        pathData += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x} ${y} `;
      }
    });
    
    const pathInner = document.createElementNS(svgNs, "path");
    pathInner.setAttribute("class", "svg-road-path");
    pathInner.setAttribute("d", pathData);
    
    const pathStroke = document.createElementNS(svgNs, "path");
    pathStroke.setAttribute("class", "svg-road-inner");
    pathStroke.setAttribute("d", pathData);
    
    svg.appendChild(pathInner);
    svg.appendChild(pathStroke);
    container.appendChild(svg);
  });
}

// Add global resize listener to redraw paths
if (!window._mapResizeListenerAttached) {
  window.addEventListener('resize', () => {
    const container = document.getElementById("adventure-map-container");
    if (container && container.innerHTML !== "") {
       requestAnimationFrame(drawAllPaths);
    }
  });
  window._mapResizeListenerAttached = true;
}

export function startMapEventChallenge(levelId) {
  if (!gameState.mapEvent || String(gameState.mapEvent.levelId) !== String(levelId)) return;
  sounds.playClick();
  
  gameState.isAdventureMode = false;
  gameState.isMapEvent = true;
  
  // Pick one random idiom
  const pool = shuffleArray([...IDIOMS_DATA]);
  gameState.currentRoundQuestions = [pool[0]];
  gameState.currentQuestionIndex = 0;
  gameState.roundAccuracy = true;
  gameState.roundTotalQuestions = 1;
  gameState.roundCorrectAnswers = 0;
  gameState.comboStreak = 0;
  
  // Choose a random simple mode for the quick quiz (e.g., 'fill' or 'typo')
  const modes = ['fill', 'typo', 'image'];
  gameState.currentMode = modes[Math.floor(Math.random() * modes.length)];
  
  document.getElementById("game-mode-name").innerText = `隨機事件 - 快問快答`;
  document.getElementById("boss-fight-ui").style.display = "none";
  gameState.isBossFight = false;
  
  document.getElementById("game-progress-line").style.width = "0%";
  import('./ui.js').then(ui => ui.switchScreen("game"));
  loadQuestion();
}

export function startAdventureLevel(levelId) {
  const level = LEVELS_DATA.find(l => l.id === levelId);
  if (!level) return;
  
  sounds.playClick();
  gameState.isAdventureMode = true;
  gameState.currentPlayingLevel = levelId;
  gameState.currentMode = level.mode;
  gameState.currentQuestionIndex = 0;
  gameState.roundAccuracy = true;
  gameState.roundCorrectAnswers = 0;
  gameState.comboStreak = 0;

  GameAnalytics.log('level_start', {
    level_id: levelId,
    mode: level.mode,
    is_boss: !!level.isBoss
  });
  
  gameState.isBossFight = false;
  document.getElementById("boss-fight-ui").style.display = "none";
  document.getElementById("game-timer").style.display = "none";
  document.getElementById("game-hint-btn").style.display = "inline-flex";
  
  let pool = [];
  
  if (level.mode === 'time') {
    gameState.roundTotalQuestions = IDIOMS_DATA.length;
    pool = shuffleArray([...IDIOMS_DATA]);
    gameState.currentRoundQuestions = pool;
    if (level.isBoss) {
      document.getElementById("game-mode-name").innerText = `魔王戰 (關卡 ${levelId})`;
      gameState.isBossFight = true;
      gameState.bossMaxHp = 5;
      gameState.bossHp = 5;
      document.getElementById("boss-fight-ui").style.display = "flex";
      document.getElementById("boss-hp-bar-inner").style.width = "100%";
      const bossEmojis = ["🐉", "👾", "👺", "🦖", "🦅", "🦂", "🕸️", "🌋", "👁️", "👹"];
      document.getElementById("boss-sprite").innerText = bossEmojis[Math.max(0, Math.floor(levelId/10) - 1) % 10];
    } else {
      document.getElementById("game-mode-name").innerText = `計時挑戰賽 (關卡 ${levelId})`;
    }
    document.getElementById("game-timer").style.display = "inline-flex";
    document.getElementById("game-hint-btn").style.display = "none";
    switchScreen("game");
    startTimeChallenge();
    loadQuestion();
  } else {
    const targetIdioms = IDIOMS_DATA.filter(item => level.idiomIds.includes(item.id));
    
    if (level.mode === 'match') {
      pool = [...targetIdioms];
      if (pool.length < 4) {
        const distractors = shuffleArray(IDIOMS_DATA.filter(item => !level.idiomIds.includes(item.id))).slice(0, 4 - pool.length);
        pool = [...pool, ...distractors];
      }
      pool = shuffleArray(pool).slice(0, 4);
      gameState.roundTotalQuestions = 1;
    } else if (level.mode === 'crossword') {
      const pairs = buildCrosswordPairs(IDIOMS_DATA, level.idiomIds);
      pool = shuffleArray(pairs.length > 0 ? pairs : buildCrosswordPairs(IDIOMS_DATA)).slice(0, 1);
      gameState.roundTotalQuestions = pool.length;
    } else {
      pool = [...targetIdioms];
      pool = shuffleArray(pool);
      gameState.roundTotalQuestions = pool.length;
    }
    
    gameState.currentRoundQuestions = pool;
    
    let modeName = "關卡挑戰";
    if (level.mode === 'image') modeName = "看圖猜成語";
    else if (level.mode === 'fill') modeName = "成語填空賽";
    else if (level.mode === 'match') modeName = "釋義配對牌";
    else if (level.mode === 'typo') modeName = "成語錯字糾察隊";
    else if (level.mode === 'story') modeName = "故事劇場";
    else if (level.mode === 'radical') modeName = "成語部首大裝配";
    else if (level.mode === 'bubble') modeName = "成語泡泡射手";
    else if (level.mode === 'simchar') modeName = "形近字大作戰";
    
    document.getElementById("game-mode-name").innerText = `${modeName} (關卡 ${levelId})`;
    
    switchScreen("game");
    loadQuestion();
  }
}

export function initAdventureTabEvents() {
  const tabAdventure = document.getElementById("dash-tab-adventure");
  const tabChallenge = document.getElementById("dash-tab-challenge");
  const viewAdventure = document.getElementById("adventure-view");
  const viewChallenge = document.getElementById("challenge-view");
  const zoneJumpHost = document.getElementById("adventure-zone-jump-container");
  
  if (!tabAdventure || !tabChallenge) return;

  // 確保初始狀態正確：清掉所有 inline display
  viewAdventure.style.display = "";
  viewChallenge.style.display = "";
  const applyDashboardTabStyles = (activeTab) => {
    const isAdventureActive = activeTab === "adventure";
    tabAdventure.classList.toggle("active", isAdventureActive);
    tabChallenge.classList.toggle("active", !isAdventureActive);
    tabAdventure.style.background = isAdventureActive ? "var(--primary)" : "white";
    tabAdventure.style.color = isAdventureActive ? "white" : "var(--text-dark)";
    tabAdventure.style.boxShadow = isAdventureActive ? "0 4px 12px rgba(213, 111, 99, 0.3)" : "none";
    tabChallenge.style.background = isAdventureActive ? "white" : "var(--primary)";
    tabChallenge.style.color = isAdventureActive ? "var(--text-dark)" : "white";
    tabChallenge.style.boxShadow = isAdventureActive ? "none" : "0 4px 12px rgba(213, 111, 99, 0.3)";
    if (zoneJumpHost) {
      zoneJumpHost.style.display = isAdventureActive ? "" : "none";
    }
  };
  applyDashboardTabStyles(viewChallenge.classList.contains("active") ? "challenge" : "adventure");
  
  tabAdventure.addEventListener("click", () => {
    sounds.playClick();
    applyDashboardTabStyles("adventure");
    viewAdventure.classList.add("active");
    viewAdventure.style.display = "block";
    viewChallenge.classList.remove("active");
    viewChallenge.style.display = "none";
    renderAdventureMap();
    setTimeout(scrollAdventureMapToCurrent, 120);
  });
  
  tabChallenge.addEventListener("click", () => {
    sounds.playClick();
    applyDashboardTabStyles("challenge");
    viewChallenge.classList.add("active");
    viewChallenge.style.display = "block";
    viewAdventure.classList.remove("active");
    viewAdventure.style.display = "none";
    updateChallengeLobbyLocks();
  });
}

export function startNewRound(mode) {
  const card = document.getElementById(`mode-${mode}`);
  if (card && card.classList.contains("locked")) {
    sounds.playTone(440, 'sine', 0.08);
    // 抖動反饋
    card.classList.add("shake-hint");
    setTimeout(() => card.classList.remove("shake-hint"), 500);
    // 顯示鼓勵提示
    const lockLabel = card.querySelector(".lock-label span");
    const hint = lockLabel ? lockLabel.textContent : "繼續闖關就能解鎖！";
    showToast(`✨ ${hint} 加油！`);
    return;
  }

  sounds.playClick();
  gameState.isAdventureMode = false;
  gameState.currentPlayingLevel = null;
  gameState.currentMode = mode;
  gameState.currentQuestionIndex = 0;
  gameState.roundAccuracy = true;
  gameState.roundCorrectAnswers = 0;
  gameState.comboStreak = 0;
  
  let modeName = "";
  let pool = [];
  
  if (mode === 'image') {
    modeName = "看圖猜成語";
    pool = IDIOMS_DATA.filter(item => item.image && item.letters && item.letters.length > 0);
    pool = shuffleArray(pool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'fill') {
    modeName = "成語填空賽";
    pool = [...IDIOMS_DATA];
    pool = shuffleArray(pool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'match') {
    modeName = "釋義配對牌";
    pool = [...IDIOMS_DATA];
    pool = shuffleArray(pool).slice(0, 4);
    gameState.roundTotalQuestions = 1;
  } else if (mode === 'time') {
    modeName = "計時挑戰賽";
    pool = shuffleArray([...IDIOMS_DATA]);
    gameState.roundTotalQuestions = pool.length;
    startTimeChallenge();
  } else if (mode === 'typo') {
    modeName = "成語錯字糾察隊";
    pool = [...IDIOMS_DATA];
    pool = shuffleArray(pool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'story') {
    modeName = "故事劇場";
    pool = [...IDIOMS_DATA];
    pool = shuffleArray(pool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'chain') {
    modeName = "成語接龍大挑戰";
    const chainPairs = [];
    IDIOMS_DATA.forEach(a => {
      IDIOMS_DATA.forEach(b => {
        if (a.id !== b.id && a.idiom[3] === b.idiom[0]) {
          chainPairs.push({ from: a, to: b });
        }
      });
    });
    pool = shuffleArray(chainPairs).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'crossword') {
    modeName = "填字交叉拼圖";
    const pairs = buildCrosswordPairs(IDIOMS_DATA);
    pool = shuffleArray(pairs).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'radical') {
    modeName = "成語部首大裝配";
    pool = IDIOMS_DATA.filter(item => {
      return item.idiom.split("").some(char => CHAR_COMPONENTS[char]);
    });
    pool = shuffleArray(pool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'bubble') {
    modeName = "成語泡泡射手";
    pool = [...IDIOMS_DATA];
    pool = shuffleArray(pool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'simchar') {
    modeName = "形近字大作戰";
    pool = [...IDIOMS_DATA];
    pool = shuffleArray(pool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'antonym') {
    modeName = "反義詞連連看";
    const antonymPool = IDIOM_RELATIONS.filter(r => r.relation === "反義詞");
    pool = shuffleArray(antonymPool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  } else if (mode === 'synonym') {
    modeName = "近義詞連連看";
    const synonymPool = IDIOM_RELATIONS.filter(r => r.relation === "近義詞");
    pool = shuffleArray(synonymPool).slice(0, 5);
    gameState.roundTotalQuestions = pool.length;
  }
  
  gameState.currentRoundQuestions = pool;
  document.getElementById("game-mode-name").innerText = modeName;
  
  const timerUI = document.getElementById("game-timer");
  if (mode === 'time') {
    timerUI.style.display = "inline-flex";
  } else {
    timerUI.style.display = "none";
  }

  const hintBtn = document.getElementById("game-hint-btn");
  if (mode === 'time') {
    hintBtn.style.display = "none";
  } else {
    hintBtn.style.display = "inline-flex";
  }
  
  switchScreen("game");
  loadQuestion();
}

export function canRenderImageGuess(item) {
  return Boolean(item && item.image && item.letters && String(item.letters).length > 0);
}

let imageSkipTimer = null;

/** 缺圖題：短暫提示後跳下一題，不扣分、不傷魔王。 */
export function skipIncompleteImageQuestion(message = "這題圖片資料不完整，正在換下一題。") {
  const playArea = document.getElementById("game-play-area");
  if (playArea) {
    playArea.innerHTML = "";
    const fallback = document.createElement("div");
    fallback.className = "typo-options-title";
    fallback.innerText = message;
    playArea.appendChild(fallback);
  }
  if (imageSkipTimer) clearTimeout(imageSkipTimer);
  imageSkipTimer = setTimeout(() => {
    imageSkipTimer = null;
    proceedNext();
  }, 350);
}

export function loadQuestion() {
  const currentQuestion = gameState.currentRoundQuestions[gameState.currentQuestionIndex];
  
  const progText = document.getElementById("game-progress-text");
  const progBar = document.getElementById("game-progress-line");
  
  if (gameState.currentMode === 'match') {
    progText.innerText = "配對賽";
    progBar.style.width = "100%";
  } else if (gameState.currentMode === 'time') {
    progText.innerText = `分數: ${gameState.timeTotalScore}`;
    progBar.style.width = "100%";
  } else {
    const qNum = gameState.currentQuestionIndex + 1;
    progText.innerText = `${qNum} / ${gameState.roundTotalQuestions}`;
    progBar.style.width = `${(qNum / gameState.roundTotalQuestions) * 100}%`;
  }
  
  const playArea = document.getElementById("game-play-area");
  playArea.innerHTML = "";

  if (!currentQuestion) {
    skipIncompleteImageQuestion("這題資料不完整，正在換下一題。");
    return;
  }
  
  let modeToRender = gameState.currentMode;
  if (gameState.isBossFight) {
    const mixedModes = ["image", "fill", "simchar", "typo"];
    // 無圖成語不要抽看圖，改走填空／形近／錯字，避免魔王戰卡空白
    const usableModes = canRenderImageGuess(currentQuestion)
      ? mixedModes
      : mixedModes.filter((mode) => mode !== "image");
    modeToRender = usableModes[Math.floor(Math.random() * usableModes.length)];
  }

  if (modeToRender === "image" && !canRenderImageGuess(currentQuestion)) {
    skipIncompleteImageQuestion();
    return;
  }

  if (modeToRender === 'image') {
    renderImageGuess(playArea, currentQuestion);
  } else if (modeToRender === 'fill' || modeToRender === 'time') {
    renderFillQuestion(playArea, currentQuestion);
  } else if (modeToRender === 'match') {
    renderMatchGame(playArea, gameState.currentRoundQuestions);
  } else if (modeToRender === 'typo') {
    renderTypoQuestion(playArea, currentQuestion);
  } else if (modeToRender === 'story') {
    renderStoryQuestion(playArea, currentQuestion);
  } else if (modeToRender === 'chain') {
    renderChainQuestion(playArea, currentQuestion);
  } else if (modeToRender === 'crossword') {
    renderCrosswordQuestion(playArea, currentQuestion);
  } else if (modeToRender === 'radical') {
    renderRadicalQuestion(playArea, currentQuestion);
  } else if (modeToRender === 'bubble') {
    renderBubbleQuestion(playArea, currentQuestion);
  } else if (modeToRender === 'simchar') {
    renderSimCharQuestion(playArea, currentQuestion);
  } else if (modeToRender === 'antonym' || modeToRender === 'synonym') {
    renderAntonymQuestion(playArea, currentQuestion);
  }
}

function getQuestionIdiomIds(question = null) {
  const target = question || gameState.currentRoundQuestions?.[gameState.currentQuestionIndex];
  if (!target) return [];
  if (target.id) return [target.id];
  if (target.idiomA || target.idiomB) {
    return [target.idiomA?.id, target.idiomB?.id].filter(Boolean);
  }
  if (target.from || target.to) {
    return [target.from?.id, target.to?.id].filter(Boolean);
  }
  if (target.a) {
    const item = IDIOMS_DATA.find(candidate => candidate.idiom === target.a);
    return item ? [item.id] : [];
  }
  return [];
}

export function logIncorrectAttempt(idiomItem = null) {
  if (gameState.currentMode !== 'time' && useIntimacyHintShield()) {
    gameState.roundAccuracy = true;
    showToast("💡 小書蟲守護你：這次答錯不扣完美，今天還幫你留住一次機會！");
    showLearningFeedback();
    saveGameData();
    return;
  }

  if (gameState.isBossFight) {
    addTime(-3);
    const playArea = document.getElementById("game-play-area");
    if (playArea) {
      playArea.classList.remove("shake-screen");
      void playArea.offsetWidth;
      playArea.classList.add("shake-screen");
      setTimeout(() => playArea.classList.remove("shake-screen"), 500);
    }
  }

  if (!gameState.stats) {
    gameState.stats = { totalQuestions: 0, correctQuestions: 0, shapeXP: 0, meaningXP: 0, assocXP: 0, reactionXP: 0, memoryXP: 0 };
  }
  gameState.stats.totalQuestions++;
  getQuestionIdiomIds(idiomItem).forEach(id => recordIncorrectIdiom(id));
  gameState.comboStreak = 0;
  showLearningFeedback();
  saveGameData();
}

export function handleCorrectAnswer(idiomItem, secondIdiomItem) {
  if (!gameState.stats) {
    gameState.stats = { totalQuestions: 0, correctQuestions: 0, shapeXP: 0, meaningXP: 0, assocXP: 0, reactionXP: 0, memoryXP: 0 };
  }
  if (idiomItem) {
    sounds.playSuccess();
    unlockIdiom(idiomItem.id);
    recordCorrectIdiom(idiomItem.id);
    gameState.roundCorrectAnswers++;
    updateComboStreak();
    recordDailyMissionProgress("correct");
    
    gameState.stats.totalQuestions++;
    gameState.stats.correctQuestions++;
    gameState.energy += 10;
    updateCapacityXP(gameState.currentMode);
  }
  if (secondIdiomItem) {
    unlockIdiom(secondIdiomItem.id);
    recordCorrectIdiom(secondIdiomItem.id);
    gameState.stats.totalQuestions++;
    gameState.stats.correctQuestions++;
    gameState.energy += 10;
    updateCapacityXP(gameState.currentMode);
  }

  if (gameState.currentMode === 'match') {
    if (!idiomItem && !secondIdiomItem) {
      gameState.stats.totalQuestions++;
      gameState.stats.correctQuestions++;
      updateCapacityXP(gameState.currentMode);
    }
    updateComboStreak();
    recordDailyMissionProgress("correct");
    recordDailyMissionProgress("matchWin");
  }

  if (gameState.currentMode === 'time') {
    if (gameState.timeRemaining <= 3 && gameState.timeRemaining > 0) {
      window.isExtremeRescue = true;
    }
    gameState.timeCorrectCount++;
    gameState.timeTotalScore += 10;
    
    if (gameState.isBossFight) {
      gameState.bossHp = Math.max(0, gameState.bossHp - 1);
      const hpPercent = (gameState.bossHp / gameState.bossMaxHp) * 100;
      document.getElementById("boss-hp-bar-inner").style.width = `${hpPercent}%`;
      
      const bossSprite = document.getElementById("boss-sprite");
      bossSprite.classList.remove("boss-hit-anim");
      void bossSprite.offsetWidth;
      bossSprite.classList.add("boss-hit-anim");
      
      if (gameState.bossHp <= 0) {
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
        setTimeout(() => showRoundComplete(), 600);
        return;
      }
    } else {
      addTime(2);
    }

    document.getElementById("game-progress-text").innerText = `分數: ${gameState.timeTotalScore}`;
    proceedNext();
    return;
  }
  
  const showModalModes = ['image', 'fill', 'typo', 'story', 'chain', 'crossword', 'radical', 'bubble', 'simchar', 'antonym', 'synonym'];
  if (idiomItem && showModalModes.includes(gameState.currentMode)) {
    setTimeout(() => {
      const questionIndexBeforeModal = gameState.currentQuestionIndex;

      if (secondIdiomItem) {
        showDetailModal([idiomItem, secondIdiomItem], true);
      } else {
        showDetailModal(idiomItem, true);
      }

      setTimeout(() => {
        const modal = document.getElementById("detail-modal");
        const didAdvance = gameState.currentQuestionIndex !== questionIndexBeforeModal;
        const modalVisible = modal && modal.classList.contains("active");

        if (!didAdvance && !modalVisible) {
          proceedNext();
        }
      }, 700);
    }, 400);
  } else {
    proceedNext();
  }
}

function updateComboStreak() {
  gameState.comboStreak = (gameState.comboStreak || 0) + 1;
  gameState.bestCombo = Math.max(gameState.bestCombo || 0, gameState.comboStreak);
  
  if (gameState.comboStreak === 10) {
    recordDailyMissionProgress("reach_combo_10", 1);
  }

  let announcerText = "";
  switch (gameState.comboStreak) {
    case 3: announcerText = "小試牛刀"; break;
    case 5: announcerText = "小有成就"; break;
    case 10: announcerText = "無懈可擊"; break;
    case 15: announcerText = "勢不可擋"; break;
    case 20: announcerText = "登峰造極"; break;
  }
  
  if (announcerText) {
    sounds.playAnnouncerVoice(announcerText);
  }

  if (gameState.comboStreak > 0 && gameState.comboStreak % 3 === 0) {
    const bonus = Math.min(30, gameState.comboStreak * 2);
    gameState.energy += bonus;
    showToast(`🔥 ${gameState.comboStreak} 連答對！獎勵 +${bonus} 能量`);
  }
}

function showLearningFeedback() {
  const currentQuestion = gameState.currentRoundQuestions[gameState.currentQuestionIndex];
  const idiomItem = getFeedbackIdiomItem(currentQuestion);
  if (!idiomItem) {
    showToast("再想想，答案其實藏在題目的線索裡！");
    return;
  }

  const explanation = idiomItem.explanation ? idiomItem.explanation.replace(/。.*$/, "。") : "再讀一次題目線索。";
  showToast(`學習一下：「${idiomItem.idiom}」${explanation}`);
}

function getFeedbackIdiomItem(question) {
  if (!question) return null;
  if (question.idiom && question.explanation) return question;
  if (question.from && question.from.idiom) return question.from;
  if (question.idiomA && question.idiomA.idiom) return question.idiomA;
  if (question.a) {
    return IDIOMS_DATA.find(item => item.idiom === question.a) || null;
  }
  return null;
}

export function proceedNext() {
  gameState.currentQuestionIndex++;
  
  if (gameState.currentQuestionIndex < gameState.roundTotalQuestions) {
    loadQuestion();
  } else {
    showRoundComplete();
  }
}

// 註冊至 ui.js 的關閉彈窗 callback
setProceedNext(proceedNext);

function handleMapEventComplete() {
  const isWin = gameState.roundAccuracy;
  const modal = document.getElementById("map-event-complete-modal");
  const title = document.getElementById("map-event-complete-title");
  const desc = document.getElementById("map-event-complete-desc");
  const rewardBox = document.getElementById("map-event-reward-box");
  const emoji = document.getElementById("map-event-complete-emoji");
  
  if (isWin) {
    sounds.playLevelUp();
    confetti.spawn(80);
    title.innerText = "挑戰成功！";
    desc.innerText = "恭喜獲得神祕獎勵！";
    emoji.innerText = "🎉";
    
    const tickets = Math.floor(Math.random() * 2) + 1;
    const energy = 50;
    
    gameState.drawTickets = (gameState.drawTickets || 0) + tickets;
    gameState.energy = (gameState.energy || 0) + energy;
    
    rewardBox.innerHTML = `
      <div style="font-size:24px; display:flex; gap:20px; justify-content:center; align-items:center;">
        <span style="font-weight:900;">🎫 +${tickets}</span>
        <span style="font-weight:900;">⚡ +${energy}</span>
      </div>
    `;
    rewardBox.style.display = "block";
  } else {
    sounds.playError();
    title.innerText = "挑戰失敗！";
    desc.innerText = "太可惜了，下次再加油！";
    emoji.innerText = "💨";
    rewardBox.style.display = "none";
  }
  
  gameState.mapEvent = null;
  gameState.isMapEvent = false;
  
  import('./state.js').then(module => {
    module.saveGameData();
    modal.classList.add("active");
  });
}

export function showRoundComplete() {
  if (gameState.isMapEvent) {
    handleMapEventComplete();
    return;
  }
  let baseXP = gameState.currentMode === 'match' ? 40 : gameState.roundTotalQuestions * 10;
  let bonusXP = 0;
  
  let accuracy = 100;
  if (!gameState.roundAccuracy) {
    accuracy = Math.round((gameState.roundCorrectAnswers / gameState.roundTotalQuestions) * 100);
  } else {
    bonusXP = 20;
  }
  
  const xpReward = applyIntimacyXpBonus(baseXP + bonusXP);
  const totalEarnedXP = xpReward.totalXP;
  const intimacyBonusXP = xpReward.bonusXP;
  let isLeveledUp = false;
  
  if (gameState.isAdventureMode) {
    let stars = 0;
    if (gameState.isBossFight && gameState.bossHp <= 0) {
      stars = 3;
    } else {
      if (accuracy === 100) stars = 3;
      else if (accuracy >= 80) stars = 2;
      else if (accuracy >= 50) stars = 1;
    }
    
    const starsDiv = document.getElementById("complete-stars");
    starsDiv.style.display = "flex";
    const starSpans = starsDiv.children;
    for (let i = 0; i < 3; i++) {
      starSpans[i].innerText = i < stars ? "⭐" : "☆";
    }
    
    const continueBtn = document.getElementById("complete-continue-btn");
    
    GameAnalytics.log('level_complete', {
      level_id: gameState.currentPlayingLevel,
      mode: gameState.currentMode,
      stars,
      is_boss: !!gameState.isBossFight
    });

    if (stars >= 1) {
      // 模擬手動計算 XP 增加以呼叫更新 (解耦循環引用)
      gameState.xp += totalEarnedXP;
      if (totalEarnedXP > 0) recordDailyMissionProgress("gainXP", totalEarnedXP);
      import('./state.js').then(module => {
        let nextXP = module.getNextLevelXP(gameState.level);
        while (gameState.xp >= nextXP) {
          gameState.xp -= nextXP;
          gameState.level++;
          gameState.rank = module.getRankTitle(gameState.level);
          isLeveledUp = true;
          nextXP = module.getNextLevelXP(gameState.level);
        }
        
        const levelKey = `level_${gameState.currentPlayingLevel}`;
        const oldStars = gameState.levelStars[levelKey] || 0;
        
        let bonusTickets = 0;
        if (gameState.isBossFight && gameState.bossHp <= 0 && gameState.currentPlayingLevel === gameState.currentAdventureLevel) {
          bonusTickets = 1;
        } else if (stars === 3 && oldStars < 3) {
          bonusTickets = 1;
        }
        gameState._tempFirstClearRewardTickets = bonusTickets;
        
        if (stars > oldStars) {
          gameState.levelStars[levelKey] = stars;
        }
        
        if (gameState.currentPlayingLevel === gameState.currentAdventureLevel && gameState.currentAdventureLevel < LEVELS_DATA.length) {
          gameState.currentAdventureLevel++;
        }
        
        saveGameData();
        
        confetti.spawn(120);
        sounds.playLevelUp();
        
        if (gameState.isBossFight && gameState.bossHp <= 0) {
          document.getElementById("complete-title").innerText = "魔王擊破！";
          if (gameState._tempFirstClearRewardTickets > 0) {
            document.getElementById("complete-subtitle").innerText = "太厲害了！首次通關獲得掉落獎勵：1 張閃卡券！";
          } else {
            document.getElementById("complete-subtitle").innerText = "太厲害了！你再次成功擊退了魔王！";
          }
        } else {
          document.getElementById("complete-title").innerText = "關卡挑戰成功！";
          if (gameState._tempFirstClearRewardTickets > 0) {
            document.getElementById("complete-subtitle").innerText = `完美首次通關！獲得 1 張閃卡券與 ${stars} 顆星！`;
          } else {
            document.getElementById("complete-subtitle").innerText = `恭喜獲得 ${stars} 顆星！你做得太棒了！`;
          }
        }
        
        const leaveBtn = document.getElementById("complete-leave-btn");
        if (leaveBtn) leaveBtn.innerHTML = "<span>回到選關</span>";
        
        continueBtn.innerHTML = gameState.currentPlayingLevel < LEVELS_DATA.length
          ? "<span>下一關</span>"
          : "<span>回到地圖</span>";
        renderAdventureMap();
        finishRoundCompleteRender(totalEarnedXP, accuracy, isLeveledUp, intimacyBonusXP);
      });
      return;
    } else {
      sounds.playError();
      document.getElementById("complete-title").innerText = "挑戰失敗，再試一次！";
      document.getElementById("complete-subtitle").innerText = "正確率未達 50%，多練習幾次就能過關喔！";
      
      const leaveBtn = document.getElementById("complete-leave-btn");
      if (leaveBtn) leaveBtn.innerHTML = "<span>回到選關</span>";
      
      continueBtn.innerHTML = "<span>重新挑戰</span>";
      renderAdventureMap();
    }
    
  } else {
    gameState.xp += totalEarnedXP;
    if (totalEarnedXP > 0) recordDailyMissionProgress("gainXP", totalEarnedXP);
    import('./state.js').then(module => {
      let nextXP = module.getNextLevelXP(gameState.level);
      while (gameState.xp >= nextXP) {
        gameState.xp -= nextXP;
        gameState.level++;
        gameState.rank = module.getRankTitle(gameState.level);
        isLeveledUp = true;
        nextXP = module.getNextLevelXP(gameState.level);
      }
      
      document.getElementById("complete-stars").style.display = "none";
      
      const leaveBtn = document.getElementById("complete-leave-btn");
      if (leaveBtn) leaveBtn.innerHTML = "<span>回首頁</span>";
      
      document.getElementById("complete-continue-btn").innerHTML = "<span>再玩一次</span>";
      confetti.spawn(120);
      sounds.playLevelUp();
      
      if (gameState.roundAccuracy) {
        document.getElementById("complete-title").innerText = "太厲害了！完美通關！";
        document.getElementById("complete-subtitle").innerText = "恭喜獲得完美加成 +20 XP！";
      } else {
        document.getElementById("complete-title").innerText = "挑戰完成！繼續加油！";
        document.getElementById("complete-subtitle").innerText = "多挑戰幾次就能越來越熟練喔！";
      }
      
      saveGameData();
      finishRoundCompleteRender(totalEarnedXP, accuracy, isLeveledUp, intimacyBonusXP);
    });
    return;
  }

  finishRoundCompleteRender(totalEarnedXP, accuracy, false, intimacyBonusXP);
}

function finishRoundCompleteRender(totalEarnedXP, accuracy, isLeveledUp, intimacyBonusXP = 0) {
  // We no longer blindly override complete-continue-btn here since endRound handles it.
  // 額外發放能量獎勵
  let isPassed = !gameState.isAdventureMode || (gameState.isAdventureMode && (Math.round((gameState.roundCorrectAnswers / gameState.roundTotalQuestions) * 100) >= 50));
  if (gameState.isBossFight) {
    isPassed = gameState.bossHp <= 0;
  }
  let roundEnergy = 0;
  let roundTickets = 0;
  if (isPassed) {
    roundEnergy = gameState.roundAccuracy ? 60 : 40;
    if (gameState._tempFirstClearRewardTickets > 0) {
      roundTickets = gameState._tempFirstClearRewardTickets;
      addDrawTickets(roundTickets);
    }
    delete gameState._tempFirstClearRewardTickets;
    gameState.energy += roundEnergy;
  }
  
  saveGameData();
  
  document.getElementById("reward-xp").innerHTML = `+${totalEarnedXP} XP${intimacyBonusXP > 0 ? `<br><span style="font-size:0.85em; opacity:0.9;">(親密 +${intimacyBonusXP})</span>` : ""}`;
  document.getElementById("reward-accuracy").innerText = `${accuracy}% 正確`;
  
  const ticketContainer = document.getElementById("reward-ticket-container");
  if (ticketContainer) {
    if (roundTickets > 0) {
      ticketContainer.style.display = "flex";
      document.getElementById("reward-ticket").innerText = `+${roundTickets} 閃卡券`;
    } else {
      ticketContainer.style.display = "none";
    }
  }
  
  const rankUpBox = document.getElementById("rank-up-box");
  const rankShareBtn = document.getElementById("complete-rank-share-btn");
  if (isLeveledUp) {
    rankUpBox.style.display = "block";
    document.getElementById("new-rank-text").innerText = `晉升為：${gameState.rank}`;
    if (rankShareBtn) {
      rankShareBtn.hidden = false;
      rankShareBtn.onclick = async () => {
        sounds.playClick();
        rankShareBtn.disabled = true;
        try {
          const result = await shareRankUp({
            level: gameState.level,
            rank: gameState.rank,
            accuracy,
            xp: totalEarnedXP
          });
          showToast(result === "image" ? "已開啟晉升圖卡！" : "已開啟分享內容！");
        } catch (error) {
          if (error?.name !== "AbortError") {
            console.warn("Rank up share failed", error);
            showToast("分享沒有完成，請再試一次");
          }
        } finally {
          rankShareBtn.disabled = false;
        }
      };
    }
  } else {
    rankUpBox.style.display = "none";
    if (rankShareBtn) {
      rankShareBtn.hidden = true;
      rankShareBtn.onclick = null;
    }
  }
  

  
  // 檢查解鎖成就
  import('./ui.js').then(module => {
    module.checkAchievements(true, accuracy);
    module.updateProfileBar();
  });
  
  document.getElementById("complete-modal").classList.add("active");
}

// ----------------------------------------------------------------------------
// 6.5. 計時挑戰賽專屬邏輯 (Time Challenge)
// ----------------------------------------------------------------------------
export function resumeTimer() {
  if (gameState.currentMode !== 'time' || gameState.timeRemaining <= 0) return;
  if (gameState.timerInterval) clearInterval(gameState.timerInterval);
  
  const timerUI = document.getElementById("game-timer");
  gameState.timerInterval = setInterval(() => {
    gameState.timeRemaining--;
    document.getElementById("timer-text").innerText = gameState.timeRemaining;
    
    if (gameState.timeRemaining <= 10 && gameState.timeRemaining > 0) {
      timerUI.classList.add("pulse-warning");
      if (gameState.timeRemaining <= 5) {
        sounds.playTone(880, 'sine', 0.1);
      }
    } else {
      timerUI.classList.remove("pulse-warning");
    }
    
    if (gameState.timeRemaining <= 0) {
      clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;
      showTimeUpModal();
    }
  }, 1000);
}

export function startTimeChallenge() {
  gameState.timeRemaining = 60;
  gameState.timeCorrectCount = 0;
  gameState.timeTotalScore = 0;
  
  const timerUI = document.getElementById("game-timer");
  timerUI.classList.remove("pulse-warning");
  document.getElementById("timer-text").innerText = gameState.timeRemaining;
  
  resumeTimer();
}

export function addTime(seconds) {
  if (gameState.currentMode !== 'time') return;
  gameState.timeRemaining = Math.min(60, gameState.timeRemaining + seconds);
  document.getElementById("timer-text").innerText = gameState.timeRemaining;
  if (gameState.timeRemaining <= 0) {
    stopTimer();
    showTimeUpModal();
  }
}

export function stopTimer() {
  if (imageSkipTimer) {
    clearTimeout(imageSkipTimer);
    imageSkipTimer = null;
  }
  if (gameState.timerInterval) {
    clearInterval(gameState.timerInterval);
    gameState.timerInterval = null;
  }
  const timerUI = document.getElementById("game-timer");
  timerUI.classList.remove("pulse-warning");
}

export function showTimeUpModal() {
  sounds.playError();
  
  const timeXpReward = applyIntimacyXpBonus(gameState.timeTotalScore);
  const xpEarned = timeXpReward.totalXP;
  const intimacyBonusXP = timeXpReward.bonusXP;
  gameState.xp += xpEarned;
  if (xpEarned > 0) recordDailyMissionProgress("gainXP", xpEarned);
  const isAdventureTimeLevel = gameState.isAdventureMode && gameState.currentMode === 'time' && gameState.currentPlayingLevel;
  let adventureTimeStars = 0;
  if (isAdventureTimeLevel) {
    if (gameState.timeCorrectCount >= 10) adventureTimeStars = 3;
    else if (gameState.timeCorrectCount >= 5) adventureTimeStars = 2;
    else if (gameState.timeCorrectCount >= 1) adventureTimeStars = 1;
    GameAnalytics.log('level_complete', {
      level_id: gameState.currentPlayingLevel,
      mode: gameState.currentMode,
      stars: adventureTimeStars,
      is_boss: !!gameState.isBossFight
    });
  }
  
  import('./state.js').then(module => {
    let nextXP = module.getNextLevelXP(gameState.level);
    let isLeveledUp = false;
    while (gameState.xp >= nextXP) {
      gameState.xp -= nextXP;
      gameState.level++;
      gameState.rank = module.getRankTitle(gameState.level);
      isLeveledUp = true;
      nextXP = module.getNextLevelXP(gameState.level);
    }
    
    const energyEarned = Math.floor(gameState.timeTotalScore / 2);
    gameState.energy += energyEarned;

    let timeTickets = 0;
    if (isAdventureTimeLevel && adventureTimeStars > 0) {
      const levelKey = `level_${gameState.currentPlayingLevel}`;
      const oldStars = gameState.levelStars[levelKey] || 0;
      
      if (adventureTimeStars === 3 && oldStars < 3) {
        timeTickets = 1;
        addDrawTickets(timeTickets);
      }

      if (adventureTimeStars > oldStars) {
        gameState.levelStars[levelKey] = adventureTimeStars;
      }
      if (gameState.currentPlayingLevel === gameState.currentAdventureLevel && gameState.currentAdventureLevel < LEVELS_DATA.length) {
        gameState.currentAdventureLevel++;
      }
      renderAdventureMap();
    }

    saveGameData();
    
    document.getElementById("time-correct-count").innerText = gameState.timeCorrectCount;
    document.getElementById("time-reward-xp").innerHTML = `+${xpEarned} XP${intimacyBonusXP > 0 ? `<br><span style="font-size:0.85em; opacity:0.9;">(親密 +${intimacyBonusXP})</span>` : ""}`;
    
    const timeTicketContainer = document.getElementById("time-reward-ticket-container");
    if (timeTicketContainer) {
      if (timeTickets > 0) {
        timeTicketContainer.style.display = "flex";
        document.getElementById("time-reward-ticket").innerText = `+${timeTickets} 閃卡券`;
      } else {
        timeTicketContainer.style.display = "none";
      }
    }
    
    const rankUpBox = document.getElementById("time-rank-up-box");
    const timeRankShareBtn = document.getElementById("time-rank-share-btn");
    if (isLeveledUp) {
      rankUpBox.style.display = "block";
      document.getElementById("time-new-rank-text").innerText = `晉升為：${gameState.rank}`;
      if (timeRankShareBtn) {
        timeRankShareBtn.hidden = false;
        timeRankShareBtn.onclick = async () => {
          sounds.playClick();
          timeRankShareBtn.disabled = true;
          try {
            const accuracy = gameState.timeCorrectCount > 0 ? 100 : 0;
            const result = await shareRankUp({
              level: gameState.level,
              rank: gameState.rank,
              accuracy,
              xp: xpEarned
            });
            showToast(result === "image" ? "已開啟晉升圖卡！" : "已開啟分享內容！");
          } catch (error) {
            if (error?.name !== "AbortError") {
              console.warn("Time rank up share failed", error);
              showToast("分享沒有完成，請再試一次");
            }
          } finally {
            timeRankShareBtn.disabled = false;
          }
        };
      }
    } else {
      rankUpBox.style.display = "none";
      if (timeRankShareBtn) {
        timeRankShareBtn.hidden = true;
        timeRankShareBtn.onclick = null;
      }
    }
    
    updateProfileBar();
    document.getElementById("time-up-modal").classList.add("active");
  });
}
