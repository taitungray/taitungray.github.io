/**
 * 成語大冒險 - 入口與事件綁定程式
 */

const NativeShare = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share) ? window.Capacitor.Plugins.Share : null;
const App = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) ? window.Capacitor.Plugins.App : null;
const SplashScreen = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) ? window.Capacitor.Plugins.SplashScreen : null;
const LocalNotifications = (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) ? window.Capacitor.Plugins.LocalNotifications : null;
const isNativeApp = !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
import {
  gameState,
  getGameCloudSaveState,
  LEVELS_DATA,
  loadGameData,
  restoreGameCloudSaveNow,
  signInCloudSave,
  signOutGameCloudSave,
  syncGameCloudSaveNow
} from './js/state.js';
import { onCloudAuthChange } from './js/cloud-save.js';
import { sounds } from './js/audio.js';
import { confetti } from './js/confetti.js';
import { switchScreen, showToast, updateProfileBar, renderLibrary, checkAchievements, setRenderLibraryRef } from './js/ui.js';
import { petFeedAction, petTouchAction, gachaDrawAction, gachaTenDrawAction, closeCardModalAction, renderMascotScreen, renderSubScreenCards } from './js/mascot.js';
import { initDailyCheckIn } from './js/checkin.js';
import { DAILY_MISSIONS } from './js/daily-missions.js';
import { enableDragScroll } from './js/drag-scroll.js';

let _minigamesAPI = null;
async function getMinigames() {
  if (!_minigamesAPI) {
    _minigamesAPI = await import('./js/minigames.js');
  }
  return _minigamesAPI;
}

async function showAdventureDashboard() {
  switchScreen("dashboard");
  (await getMinigames()).renderAdventureMap();
}

function scrollMascotHomeToTop() {
  const scrollTargets = [
    document.getElementById("mascot-screen"),
    document.querySelector("#mascot-screen .mascot-screen-content"),
    document.getElementById("sub-screen-home")
  ];

  requestAnimationFrame(() => {
    scrollTargets.forEach(target => {
      if (!target) return;
      target.scrollTop = 0;
    });
  });
}

function showHome() {
  switchScreen("mascot");
  setActiveSubTab("sub-tab-home", "sub-screen-home");
}

const DAILY_MISSION_GUIDE_MESSAGES = {
  correct_3: "\u524d\u5f80\u6311\u6230\uff0c\u7b54\u5c0d 3 \u984c\u5c31\u80fd\u5b8c\u6210\u4eca\u65e5\u4efb\u52d9\uff01",
  match_1: "\u524d\u5f80\u914d\u5c0d\u6311\u6230\uff0c\u5b8c\u6210\u4e00\u5c40\u5c31\u80fd\u56de\u4f86\u9818\u734e\uff01",
  feed_1: "\u5df2\u5e36\u4f60\u5230\u990c\u98df\u6309\u9215\u3002"
};

function highlightMissionTarget(element) {
  if (!element) return;
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  element.classList.remove("mission-guide-highlight");
  void element.offsetWidth;
  element.classList.add("mission-guide-highlight");
  if (typeof element.focus === "function") {
    element.focus({ preventScroll: true });
  }
  setTimeout(() => element.classList.remove("mission-guide-highlight"), 1600);
}

async function guideToDailyMission(missionId) {
  const mission = DAILY_MISSIONS.find(item => item.id === missionId);
  if (!mission || !mission.guide) return;

  const guide = mission.guide;
  if (guide.type === "round") {
    switchScreen("dashboard");
    const challengeTab = document.getElementById("dash-tab-challenge");
    if (challengeTab && !challengeTab.classList.contains("active")) {
      challengeTab.click();
    } else {
      (await getMinigames()).updateChallengeLobbyLocks();
    }
    showToast(DAILY_MISSION_GUIDE_MESSAGES[missionId] || "\u5df2\u5e36\u4f60\u5230\u4efb\u52d9\u5730\u9ede\u3002");
    setTimeout(async () => {
      highlightMissionTarget(document.getElementById(`mode-${guide.mode}`));
      (await getMinigames()).startNewRound(guide.mode);
    }, 220);
    return;
  }

  if (guide.type === "mascot") {
    showHome();
    setActiveSubTab(guide.tabId || "sub-tab-home", guide.screenId || "sub-screen-home");
    showToast(DAILY_MISSION_GUIDE_MESSAGES[missionId] || "\u5df2\u5e36\u4f60\u5230\u4efb\u52d9\u5730\u9ede\u3002");
    requestAnimationFrame(() => {
      highlightMissionTarget(document.getElementById(guide.targetId));
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // 啟用全域拖曳滾動功能，套用在常見的可滾動區塊
  enableDragScroll('.dashboard-scrollable, .dashboard-panel-scroll, .mascot-screen-content, .library-panel, .modal-body, .scrollable');



  // 全域 Ripple 點擊動畫監聽器
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest('.btn, .mode-card, .dash-tab, .sub-tab, .library-tab, .nav-item, .game-option, .option-btn');
    if (!target) return;
    // 避免重複添加多個 ripple 或改變結構異常
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ripple = document.createElement('span');
    ripple.className = 'js-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    target.appendChild(ripple);
    setTimeout(() => ripple.remove(), 500);
  });

  if (isNativeApp) {
    document.body.classList.add("native-app");
    
    const nativeShareBtn = document.getElementById("native-share-btn");
    if (nativeShareBtn) {
      nativeShareBtn.hidden = false;
      nativeShareBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        sounds.playClick();
        try {
          await NativeShare.share({
            title: "成語大冒險",
            text: `我正在挑戰成語大冒險，現在是 ${gameState.rank} (Lv.${gameState.level})，一起來挑戰成語大滿貫吧！\nhttps://play.google.com/store/apps/details?id=com.taitungray.chengyu`,
            dialogTitle: "分享成語大冒險"
          });
        } catch (error) {
          console.warn("APP 分享呼叫失敗", error);
        }
      });
    }
  }

  if (App) {
    App.addListener('backButton', () => {
      // 1. 優先關閉 Modal
      const detailModal = document.getElementById("detail-modal");
      if (detailModal && detailModal.classList.contains("active")) {
        const closeBtn = document.getElementById("detail-modal-close");
        if (closeBtn && closeBtn.style.display !== "none") {
          closeBtn.click();
        }
        return;
      }
      
      const confirmModal = document.getElementById("confirm-modal");
      if (confirmModal && confirmModal.classList.contains("active")) {
        document.getElementById("confirm-cancel-btn").click();
        return;
      }
      
      const completeModal = document.getElementById("complete-modal");
      if (completeModal && completeModal.classList.contains("active")) {
        document.getElementById("complete-leave-btn").click();
        return;
      }
      
      const timeUpModal = document.getElementById("time-up-modal");
      if (timeUpModal && timeUpModal.classList.contains("active")) {
        document.getElementById("time-up-continue-btn").click();
        return;
      }
      
      const cardModal = document.getElementById("card-modal");
      if (cardModal && cardModal.classList.contains("active")) {
        document.getElementById("card-modal-close-btn").click();
        return;
      }

      const checkinModal = document.getElementById("checkin-modal");
      if (checkinModal && checkinModal.classList.contains("active")) {
        document.getElementById("checkin-modal-close").click();
        return;
      }

      // 2. 判斷當前頁面
      const gameScreen = document.getElementById("game-screen");
      if (gameScreen && gameScreen.classList.contains("active")) {
        document.getElementById("game-back-btn").click();
        return;
      }

      const dashboardScreen = document.getElementById("dashboard-screen");
      if (dashboardScreen && dashboardScreen.classList.contains("active")) {
        switchScreen("mascot");
        return;
      }

      const libraryScreen = document.getElementById("library-screen");
      if (libraryScreen && libraryScreen.classList.contains("active")) {
        switchScreen("mascot");
        return;
      }
      
      const achievementsScreen = document.getElementById("achievements-screen");
      if (achievementsScreen && achievementsScreen.classList.contains("active")) {
        switchScreen("mascot");
        return;
      }

      // 3. 在首頁或小屋時退出 App
      App.exitApp();
    });
  }

  // 載入成語資料庫
  try {
    const response = await fetch('idioms.json');
    const data = await response.json();
    window.IDIOMS_DATA = data;
  } catch (error) {
    console.error('Failed to load idioms.json:', error);
    window.IDIOMS_DATA = [];
  }

  // A. 載入資料並更新狀態
  await loadGameData();


  updateProfileBar();

  const cloudSaveBtn = document.getElementById("cloud-save-btn");
  const cloudAccountStatus = document.getElementById("cloud-account-status");
  const cloudAccountLabel = document.getElementById("cloud-account-label");
  const cloudSignOutBtn = document.getElementById("cloud-signout-btn");
  let cloudSignInBusy = false;
  const updateCloudSaveButton = () => {
    const cloudState = getGameCloudSaveState();
    if (cloudAccountStatus) {
      cloudAccountStatus.hidden = !cloudState.signedIn;
    }
    if (cloudAccountLabel) {
      const accountName = cloudState.email || cloudState.displayName || cloudState.userId || "雲端帳號";
      cloudAccountLabel.textContent = cloudState.signedIn ? `雲端已登入：${accountName}` : "雲端未登入";
    }
    if (cloudSignOutBtn) {
      cloudSignOutBtn.disabled = !cloudState.signedIn;
    }
    if (!cloudSaveBtn) return;
    cloudSaveBtn.hidden = cloudSignInBusy || (cloudState.configured && !cloudState.authResolved) || cloudState.signedIn;
    // Firebase 正在恢復登入狀態或已登入時都隱藏，避免 App 回前景時短暫露出登入鈕。
    cloudSaveBtn.hidden = cloudSignInBusy || (cloudState.configured && !cloudState.authResolved) || cloudState.signedIn;
    cloudSaveBtn.classList.toggle("is-synced", cloudState.signedIn);
    cloudSaveBtn.title = cloudState.signedIn ? "雲端存檔已登入" : "登入雲端存檔";
  };
  updateCloudSaveButton();
  // 當 Firebase auth 狀態恢復時（重新啟動 App 仍有登入），自動隱藏按鈕
  let cloudAutoRestoreBusy = false;
  let cloudAutoRestoredUserId = "";
  const refreshAfterCloudRestore = async () => {
    updateProfileBar();
    (await getMinigames()).renderAdventureMap();
    (await getMinigames()).updateChallengeLobbyLocks();
    renderMascotScreen();
  };
  const enterMascotHomeAfterCloudLogin = () => {
    refreshAfterCloudRestore();
    showHome();
    setActiveSubTab("sub-tab-home", "sub-screen-home");
  };
  const restoreCloudSaveAfterAuth = async (cloudState, options = {}) => {
    if (!cloudState.signedIn || cloudAutoRestoreBusy) return;
    if (cloudSignInBusy && !options.force) return;
    if (!options.force && cloudAutoRestoredUserId === cloudState.userId) return;

    try {
      cloudAutoRestoreBusy = true;
      if (!options.silent) {
        showToast("正在載入雲端存檔...");
      }
      const result = await restoreGameCloudSaveNow();
      if (result.restored) {
        cloudAutoRestoredUserId = cloudState.userId;
        refreshAfterCloudRestore();
        if (!options.silent) {
          showToast("雲端資料已載入完成");
        }
      } else if (!options.silent) {
        showToast(result.state.lastError ? "雲端資料讀取失敗，請稍後再試" : "這個帳號沒有雲端存檔");
      }
    } catch (error) {
      console.warn("Cloud save restore failed", error);
    } finally {
      cloudAutoRestoreBusy = false;
      updateCloudSaveButton();
    }
  };
  onCloudAuthChange((cloudState) => {
    updateCloudSaveButton();
    restoreCloudSaveAfterAuth(cloudState, { silent: false });
  });

  if (cloudSaveBtn) {
    cloudSaveBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      sounds.playClick();
      const cloudState = getGameCloudSaveState();
      if (!cloudState.configured) {
        showToast("尚未設定 Firebase，請先填入 firebase-config.js");
        return;
      }
      if (cloudState.signedIn) return; // 已登入時按鈕應已隱藏，防呆

      try {
        cloudSignInBusy = true;
        cloudSaveBtn.disabled = true;
        updateCloudSaveButton();
        showToast("正在開啟 Google 登入...");
        const result = await signInCloudSave();
        if (result.pending) {
          showToast("登入確認中，完成後會載入雲端資料");
        } else if (result.restored) {
          showToast("雲端資料已載入完成");
        } else if (result.state.lastError) {
          showToast("雲端資料讀取失敗，請稍後再試");
        } else {
          showToast("這個帳號沒有雲端存檔，已建立新的雲端存檔");
        }
        await restoreCloudSaveAfterAuth(getGameCloudSaveState(), { force: true, silent: true });
        if (getGameCloudSaveState().signedIn) {
          enterMascotHomeAfterCloudLogin();
        } else {
          refreshAfterCloudRestore();
        }
      } catch (error) {
        console.warn("Cloud save action failed", error);
        const authError = error?.code || error?.message || getGameCloudSaveState().lastError || "";
        if (String(authError).includes("unauthorized-domain")) {
          showToast("這個網址尚未加入 Firebase 授權網域");
        } else {
          showToast("雲端登入失敗，請稍後再試");
        }
      } finally {
        cloudSignInBusy = false;
        cloudSaveBtn.disabled = false;
        updateCloudSaveButton();
      }
    });
  }

  if (cloudSignOutBtn) {
    cloudSignOutBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      sounds.playClick();
      const cloudState = getGameCloudSaveState();
      if (!cloudState.signedIn) {
        return;
      }

      try {
        cloudSignOutBtn.disabled = true;
        showToast("正在登出雲端帳號...");
        await signOutGameCloudSave();
        showToast("已登出雲端帳號");
      } catch (error) {
        console.warn("Cloud sign-out failed", error);
        showToast("雲端登出失敗，請稍後再試");
      } finally {
        cloudSignOutBtn.disabled = false;
        updateCloudSaveButton();
      }
    });
  }

  // 註冊即時搜尋重繪
  setRenderLibraryRef(renderLibrary);
  
  // 檢查符合條件成就但尚未解鎖的 (無聲)
  checkAchievements(false, 0, true);

  // 初始化冒險地圖與大廳
  (await getMinigames()).renderAdventureMap();
  (await getMinigames()).updateChallengeLobbyLocks();
  (await getMinigames()).initAdventureTabEvents();
  
  // B. 初始化背景音樂播放
  const startBgmOnInteraction = () => {
    sounds.playBgm();
    document.removeEventListener("click", startBgmOnInteraction);
    document.removeEventListener("touchstart", startBgmOnInteraction);
  };
  document.addEventListener("click", startBgmOnInteraction);
  document.addEventListener("touchstart", startBgmOnInteraction);

  // 監聽 App 退到背景與回到前景 (暫停/恢復背景音樂與音效上下文)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      sounds.pauseForBackground();
    } else {
      sounds.resumeFromBackground();
    }
  });
  document.addEventListener("pause", () => {
    sounds.pauseForBackground();
  }, false);
  document.addEventListener("resume", () => {
    sounds.resumeFromBackground();
  }, false);
  
  // C. 初始化 Canvas 碎紙
  confetti.init("confetti-canvas");
  
  // D. 綁定首頁與按鈕點擊
  document.getElementById("start-game-btn").addEventListener("click", () => {
    sounds.playTone(600, 'sine', 0.1);
    sounds.playBgm();
    showHome();
    showToast("歡迎回到小屋，準備好再出發冒險！");
  });
  
  // 導覽鈕
  document.getElementById("nav-adventure").addEventListener("click", () => {
    sounds.playClick();
    if (document.getElementById('nav-adventure').classList.contains('active')) return;
    showAdventureDashboard();
  });
  document.getElementById("nav-library").addEventListener("click", () => {
    sounds.playClick();
    switchScreen("library");
  });
  document.getElementById("nav-achievements").addEventListener("click", () => {
    sounds.playClick();
    switchScreen("achievements");
  });
  document.getElementById("nav-mascot").addEventListener("click", () => {
    sounds.playClick();
    if (document.getElementById('nav-mascot').classList.contains('active')) return;
    showHome();
  });
  
  // BGM 音樂開關
  const bgmBtn = document.getElementById("bgm-toggle-btn");
  if (bgmBtn) {
    sounds.updateBgmButton(sounds.isBgmMuted);
    bgmBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sounds.toggleBgm();
    });
  }
  
  // 大廳遊戲點擊
  document.getElementById("mode-image").addEventListener("click", async () => (await getMinigames()).startNewRound("image"));
  document.getElementById("mode-fill").addEventListener("click", async () => (await getMinigames()).startNewRound("fill"));
  document.getElementById("mode-match").addEventListener("click", async () => (await getMinigames()).startNewRound("match"));
  document.getElementById("mode-time").addEventListener("click", async () => (await getMinigames()).startNewRound("time"));
  document.getElementById("mode-typo").addEventListener("click", async () => (await getMinigames()).startNewRound("typo"));
  document.getElementById("mode-story").addEventListener("click", async () => (await getMinigames()).startNewRound("story"));
  document.getElementById("mode-chain").addEventListener("click", async () => (await getMinigames()).startNewRound("chain"));
  document.getElementById("mode-crossword").addEventListener("click", async () => (await getMinigames()).startNewRound("crossword"));
  document.getElementById("mode-radical").addEventListener("click", async () => (await getMinigames()).startNewRound("radical"));
  document.getElementById("mode-bubble").addEventListener("click", async () => (await getMinigames()).startNewRound("bubble"));
  document.getElementById("mode-simchar").addEventListener("click", async () => (await getMinigames()).startNewRound("simchar"));
  document.getElementById("mode-antonym").addEventListener("click", async () => (await getMinigames()).startNewRound("antonym"));
  document.getElementById("mode-synonym").addEventListener("click", async () => (await getMinigames()).startNewRound("synonym"));
  
  // 返回與確認視窗
  document.getElementById("game-back-btn").addEventListener("click", async () => {
    sounds.playClick();
    if (gameState.currentMode === 'time') {
      (await getMinigames()).stopTimer();
    }
    document.getElementById("confirm-modal").classList.add("active");
  });

  document.getElementById("confirm-cancel-btn").addEventListener("click", async () => {
    sounds.playClick();
    document.getElementById("confirm-modal").classList.remove("active");
    if (gameState.currentMode === 'time' && gameState.timeRemaining > 0) {
      (await getMinigames()).resumeTimer();
    }
  });

  document.getElementById("confirm-ok-btn").addEventListener("click", async () => {
    sounds.playClick();
    document.getElementById("confirm-modal").classList.remove("active");
    if (gameState.currentMode === 'time') {
      (await getMinigames()).stopTimer();
    }
    switchScreen("dashboard");
  });

  const detailModal = document.getElementById("detail-modal");
  const detailCloseBtn = document.getElementById("detail-modal-close");
  const closeDetailModal = () => {
    if (detailCloseBtn.style.display === "none") return;
    sounds.playClick();
    sounds.stopSpeech();
    detailModal.classList.remove("active");
  };

  detailCloseBtn.addEventListener("click", closeDetailModal);
  detailModal.addEventListener("click", (event) => {
    if (event.target === detailModal) {
      closeDetailModal();
    }
  });
  
  // Map Event Modals
  const mapEventIntroModal = document.getElementById("map-event-intro-modal");
  document.getElementById("map-event-intro-close").addEventListener("click", () => {
    sounds.playClick();
    mapEventIntroModal.classList.remove("active");
  });
  document.getElementById("map-event-intro-btn-start").addEventListener("click", () => {
    mapEventIntroModal.classList.remove("active");
    const levelId = mapEventIntroModal.dataset.eventLevelId;
    if (levelId) {
      getMinigames().then(m => m.startMapEventChallenge(parseInt(levelId, 10)));
    }
  });

  const mapEventCompleteModal = document.getElementById("map-event-complete-modal");
  document.getElementById("map-event-complete-btn-close").addEventListener("click", () => {
    sounds.playClick();
    mapEventCompleteModal.classList.remove("active");
    import('./js/ui.js').then(m => m.updateProfileBar());
    showAdventureDashboard();
  });
  
  // 提示按鈕
  document.getElementById("game-hint-btn").addEventListener("click", () => {
    sounds.playClick();
    const currentQuestion = gameState.currentRoundQuestions ? gameState.currentRoundQuestions[gameState.currentQuestionIndex] : null;
    if (!currentQuestion) {
      showToast("💡 翻牌配對模式下需要努力記憶配對喔！加油！");
      return;
    }

    if (gameState.currentMode === 'crossword') {
      const idiomAStr = currentQuestion.idiomA?.idiom || "";
      const idiomBStr = currentQuestion.idiomB?.idiom || "";
      if (idiomAStr && idiomBStr) {
        showToast(`💡 提示：橫向是「${idiomAStr}」，縱向是「${idiomBStr}」！`);
      } else {
        showToast("💡 提示：觀察橫向與縱向的成語線索！");
      }
    } else if (gameState.currentMode === 'chain') {
      const idiomItem = currentQuestion.from || currentQuestion;
      const lastChar = idiomItem && idiomItem.idiom ? idiomItem.idiom[3] : "";
      if (lastChar) {
        showToast(`💡 提示：找個以「${lastChar}」開頭的成語吧！`);
      } else {
        showToast("💡 提示：接上一個成語的字尾！");
      }
    } else if (gameState.currentMode === 'antonym' || gameState.currentMode === 'synonym') {
      const targetObj = currentQuestion.a ? IDIOMS_DATA.find(i => i.idiom === currentQuestion.a) : null;
      if (targetObj && targetObj.explanation) {
        showToast(`💡 提示：「${currentQuestion.a}」的意思是「${targetObj.explanation.substring(0, 16)}...」`);
      } else if (currentQuestion.a && currentQuestion.relation) {
        showToast(`💡 提示：請在右邊選出與「${currentQuestion.a}」成【${currentQuestion.relation}】關係的成語！`);
      } else {
        showToast("💡 提示：找出具備相對應關係的成語！");
      }
    } else if (gameState.currentMode === 'radical') {
      showToast("💡 提示：點擊下方字元庫中的兩個部件，拼出成語中缺少的那個中文字！");
    } else if (gameState.currentMode === 'bubble') {
      showToast("💡 提示：看準浮上來的泡泡，點擊含有正確答案的那個泡泡！");
    } else {
      const item = currentQuestion.explanation ? currentQuestion : (currentQuestion.from || currentQuestion.idiomA);
      if (item && item.explanation) {
        showToast(`💡 提示：此成語的意思是「${item.explanation.substring(0, 16)}...」`);
      } else {
        showToast("💡 翻牌配對模式下需要努力記憶配對喔！加油！");
      }
    }
  });
  
  // 成語筆記搜尋過濾
  document.getElementById("library-search-input").addEventListener("input", renderLibrary);
  ["library-card-filter", "library-set-filter", "library-sort-filter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderLibrary);
  });
  


  // 關卡重試與下關控制
  document.getElementById("complete-continue-btn").addEventListener("click", async () => {
    sounds.playClick();
    document.getElementById("complete-modal").classList.remove("active");
    
    // Check if we are in adventure mode
    if (gameState && gameState.isAdventureMode) {
      const btnText = document.getElementById("complete-continue-btn").innerText;
      if (btnText.includes("重新挑戰")) {
        import('./js/minigames.js').then(module => module.startAdventureLevel(gameState.currentPlayingLevel));
      } else {
        const nextLevelId = parseInt(gameState.currentPlayingLevel, 10) + 1;
        if (LEVELS_DATA && LEVELS_DATA.find(l => l.id === nextLevelId)) {
          import('./js/minigames.js').then(module => module.startAdventureLevel(nextLevelId));
        } else {
          showAdventureDashboard();
        }
      }
    } else {
      showAdventureDashboard();
    }
  });

  document.getElementById("complete-leave-btn").addEventListener("click", () => {
    sounds.playClick();
    document.getElementById("complete-modal").classList.remove("active");
    showAdventureDashboard();
  });
  
  document.getElementById("time-up-continue-btn").addEventListener("click", () => {
    sounds.playClick();
    document.getElementById("time-up-modal").classList.remove("active");
    showAdventureDashboard();
  });
  
  // 吉祥物與小屋互動
  const petFeedBtn = document.getElementById("pet-btn-feed");
  let feedHoldDelay = null;
  let feedHoldInterval = null;
  let feedHoldActive = false;
  const stopFeedHold = () => {
    feedHoldActive = false;
    clearTimeout(feedHoldDelay);
    clearInterval(feedHoldInterval);
    feedHoldDelay = null;
    feedHoldInterval = null;
  };
  const runFeedUpgrade = () => {
    if (gameState.energy < 30) {
      stopFeedHold();
      petFeedAction();
      return;
    }
    petFeedAction();
  };
  petFeedBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (feedHoldActive) return;
    feedHoldActive = true;
    runFeedUpgrade();
    feedHoldDelay = setTimeout(() => {
      feedHoldInterval = setInterval(runFeedUpgrade, 180);
    }, 360);
  });
  petFeedBtn.addEventListener("pointerup", stopFeedHold);
  petFeedBtn.addEventListener("pointercancel", stopFeedHold);
  petFeedBtn.addEventListener("pointerleave", stopFeedHold);
  petFeedBtn.addEventListener("click", (event) => event.preventDefault());
  document.getElementById("pet-btn-touch").addEventListener("click", petTouchAction);
  document.getElementById("pet-display-container").addEventListener("click", petTouchAction);
  document.getElementById("gacha-draw-btn").addEventListener("click", gachaDrawAction);
  document.getElementById("gacha-ten-draw-btn").addEventListener("click", gachaTenDrawAction);

  document.getElementById("card-modal-close-btn").addEventListener("click", () => {
    sounds.playClick();
    sounds.stopSpeech();
    closeCardModalAction();
  });
  
  // 初始化小屋子分頁切換
  document.getElementById("sub-tab-home").addEventListener("click", () => {
    sounds.playClick();
    setActiveSubTab("sub-tab-home", "sub-screen-home");
  });
  // (sub-tab-cards 已移至獨立的圖鑑畫面)
  const cardSetSortSelect = document.getElementById("card-set-sort-select");
  if (cardSetSortSelect) {
    cardSetSortSelect.addEventListener("change", renderSubScreenCards);
  }
  document.getElementById("sub-tab-stats").addEventListener("click", () => {
    sounds.playClick();
    setActiveSubTab("sub-tab-stats", "sub-screen-stats");
  });
  document.getElementById("sub-tab-report").addEventListener("click", () => {
    sounds.playClick();
    setActiveSubTab("sub-tab-report", "sub-screen-report");
  });

  document.getElementById("library-tab-cards").addEventListener("click", () => {
    sounds.playClick();
    setActiveLibraryTab("library-tab-cards", "library-panel-cards");
  });

  document.getElementById("library-tab-draw").addEventListener("click", () => {
    sounds.playClick();
    setActiveLibraryTab("library-tab-draw", "library-panel-draw");
    renderSubScreenCards();
  });

  
  initDailyCheckIn();
  window.addEventListener("daily-mission-guide", (event) => {
    guideToDailyMission(event.detail?.missionId);
  });

  // 原生 App SplashScreen 與 Local Notifications 初始化
  if (SplashScreen) {
    // 立即關閉原生 Android 12 的 Icon 啟動畫面，由網頁端的全螢幕海報接手
    SplashScreen.hide().catch(err => console.warn(err));
  }

  // 控制網頁端的自訂啟動畫面 (Custom Web Splash)
  const webSplash = document.getElementById("custom-web-splash");
  if (webSplash) {
    // 確保海報顯示至少 1.5 秒，讓玩家能欣賞海報
    setTimeout(() => {
      webSplash.style.opacity = "0";
      setTimeout(() => {
        webSplash.remove();
      }, 500); // 等待淡出動畫結束後移除元件
    }, 1500);
  }

  if (isNativeApp && LocalNotifications && App) {
    LocalNotifications.requestPermissions().then((res) => {
      console.log('Local Notifications permission:', res);
    });

    App.addListener('pause', () => {
      LocalNotifications.schedule({
        notifications: [
          {
            title: "書蟲肚子餓了！🐛",
            body: "快來「成語大冒險」餵書蟲，順便挑戰新的成語吧！",
            id: 1,
            smallIcon: "ic_notification_app_icon",
            largeIcon: "ic_notification_app_icon",
            iconColor: "#d56f63",
            schedule: { at: new Date(Date.now() + 1000 * 60 * 60 * 24) }
          }
        ]
      }).catch(err => console.warn(err));
    });

    App.addListener('resume', () => {
      LocalNotifications.cancel({ notifications: [{ id: 1 }] }).catch(err => console.warn(err));
    });
  }

  document.body.addEventListener('click', () => {
    sounds.init();
  }, { once: true });
});

function setActiveLibraryTab(tabId, panelId) {
  document.querySelectorAll(".library-tab").forEach(tab => tab.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  document.querySelectorAll(".library-panel").forEach(panel => panel.classList.remove("active"));
  document.getElementById(panelId).classList.add("active");
}

function setActiveSubTab(tabId, screenId, options = {}) {
  document.querySelectorAll(".sub-tab").forEach(tab => tab.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  document.querySelectorAll(".sub-screen").forEach(scr => scr.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  if (screenId === "sub-screen-home" && !options.scrollToMissions) {
    scrollMascotHomeToTop();
  }
  if (options.scrollToMissions) {
    requestAnimationFrame(() => {
      const missions = document.getElementById("daily-missions-panel");
      if (missions) {
        missions.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }
  import('./js/mascot.js').then(module => {
    module.renderMascotScreen();
  });
}

// J. PWA 安裝註冊與離線快取
let deferredPrompt;
const installContainer = document.getElementById("pwa-install-container");
const installBtn = document.getElementById("pwa-install-btn");

if (!isNativeApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('Service Worker 註冊成功！範圍：', reg.scope))
      .catch((err) => console.error('Service Worker 註冊失敗：', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installContainer.style.display = 'block';
});

installBtn.addEventListener('click', (e) => {
  sounds.playClick();
  installContainer.style.display = 'none';
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      showToast("🎉 感謝安裝！已將成語大冒險新增至桌面。");
    }
    deferredPrompt = null;
  });
});

window.addEventListener('appinstalled', () => {
  showToast("🎉 成語大冒險安裝成功！你可以隨時離線遊玩囉。");
});
