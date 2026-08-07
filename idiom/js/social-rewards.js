import { gameState, saveGameData } from './state.js';

const OFFICIAL_WEBSITE_URL = "https://taitungray.github.io/developer.html";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.taitungray.chengyu";

function getShareUrl() {
  if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform()) {
    return PLAY_STORE_URL;
  }
  return OFFICIAL_WEBSITE_URL;
}

const SHARE_REWARD_ENERGY = 1000;
const RATING_REWARD_ENERGY = 1000;

const getNativeShare = () => {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.Plugins?.Share || null;
};

const ensureSocialRewardsState = () => {
  if (!gameState.socialRewards || typeof gameState.socialRewards !== "object") {
    gameState.socialRewards = {};
  }
  gameState.socialRewards.shareEnergyClaimed = Boolean(gameState.socialRewards.shareEnergyClaimed);
  gameState.socialRewards.ratingEnergyClaimed = Boolean(gameState.socialRewards.ratingEnergyClaimed);
  gameState.socialRewards.ratingPopupShown = Boolean(gameState.socialRewards.ratingPopupShown);
  return gameState.socialRewards;
};

const openExternalUrl = (url) => {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.href = url;
  }
};

async function shareApp() {
  const combinedText = "這款「成語大冒險」好玩又益智，還可以養自己的專屬小書蟲！快來一起挑戰吧！\n" + getShareUrl();
  const shareData = {
    title: "推薦成語大冒險",
    text: combinedText,
    dialogTitle: "推薦給好友"
  };

  const NativeShare = getNativeShare();
  if (NativeShare?.share) {
    await NativeShare.share(shareData);
    return true;
  }

  if (navigator.share) {
    await navigator.share(shareData);
    return true;
  }

  const copyText = shareData.text;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(copyText);
    return true;
  }

  window.prompt("複製分享連結", copyText);
}

async function grantSocialReward(rewardKey, amount, label, helpers) {
  const rewards = ensureSocialRewardsState();
  if (rewards[rewardKey]) {
    helpers.showToast(`${label}獎勵已經領過囉！`);
    return false;
  }

  rewards[rewardKey] = true;
  gameState.energy += amount;
  await saveGameData();
  helpers.sounds.playLevelUp();
  helpers.confetti.spawn(80);
  helpers.showToast(`${label}完成！獲得 +${amount} 能量`);
  helpers.updateProfileBar();
  return true;
}

export function renderSocialRewardsPanel(helpers) {
  const panel = document.getElementById("social-rewards-panel");
  if (!panel) return;

  const rewards = ensureSocialRewardsState();
  const items = [
    {
      id: "share",
      icon: "📣",
      title: "分享給朋友",
      desc: "把成語大冒險推薦給同學或家人。",
      reward: SHARE_REWARD_ENERGY,
      claimed: rewards.shareEnergyClaimed,
      actionText: rewards.shareEnergyClaimed ? "繼續分享" : "分享領取",
      onClick: async () => {
        const shouldGrantReward = !ensureSocialRewardsState().shareEnergyClaimed;
        if (shouldGrantReward) {
          await grantSocialReward("shareEnergyClaimed", SHARE_REWARD_ENERGY, "分享", helpers);
          renderSocialRewardsPanel(helpers);
        }

        try {
          await shareApp();
          if (!shouldGrantReward) {
            helpers.showToast("分享獎勵已領過，仍可繼續分享！");
          }
        } catch (error) {
          if (error?.name !== "AbortError") {
            console.warn("Share action failed", error);
            helpers.showToast("分享沒有完成，請再試一次");
          }
        }
      }
    },
    {
      id: "rating",
      icon: "⭐",
      title: "APP 評分支持",
      desc: "前往商店留下真實使用感受。",
      reward: RATING_REWARD_ENERGY,
      claimed: rewards.ratingEnergyClaimed,
      actionText: rewards.ratingEnergyClaimed ? "已領取" : "前往評分",
      onClick: async () => {
        openExternalUrl(PLAY_STORE_URL);
        await grantSocialReward("ratingEnergyClaimed", RATING_REWARD_ENERGY, "評分支持", helpers);
      }
    }
  ];

  const visibleItems = items.filter(item => {
    if (item.id === "rating" && (gameState.currentAdventureLevel || 1) <= 10) {
      return false;
    }
    return true;
  });
  panel.hidden = visibleItems.length === 0;
  if (visibleItems.length === 0) {
    panel.innerHTML = "";
    return;
  }

  panel.innerHTML = `
    <div class="social-rewards-header">
      <div>
        <h3>好友應援獎勵</h3>
        <p>分享與支持 App，各可領一次能量。</p>
      </div>
      <span class="social-rewards-badge">限領一次</span>
    </div>
    <div class="social-rewards-list">
      ${visibleItems.map(item => `
        <button class="social-reward-item ${item.claimed ? "reward-claimed" : ""}" data-social-reward="${item.id}" title="${item.title}：+${item.reward} 能量" aria-label="${item.title}：+${item.reward} 能量">
          <span class="social-reward-icon">${item.icon}</span>
          <span class="social-reward-copy">
            <strong>${item.title}</strong>
            <small>${item.desc}</small>
          </span>
          <span class="social-reward-action">
            <b>+${item.reward} <span aria-hidden="true">⚡</span></b>
            <small>${item.actionText}</small>
          </span>
        </button>
      `).join("")}
    </div>
  `;

  visibleItems.forEach(item => {
    const button = panel.querySelector(`[data-social-reward="${item.id}"]`);
    if (!button) return;
    const showPressFeedback = () => {
      button.classList.remove("is-pressing");
      void button.offsetWidth;
      button.classList.add("is-pressing");
      window.setTimeout(() => button.classList.remove("is-pressing"), 260);
    };
    button.addEventListener("pointerdown", showPressFeedback);
    button.addEventListener("click", async () => {
      helpers.sounds.playClick();
      await item.onClick();
      renderSocialRewardsPanel(helpers);
    });
  });

  // Auto popup for rating after level 10
  if ((gameState.currentAdventureLevel || 1) > 10 && !rewards.ratingEnergyClaimed && !rewards.ratingPopupShown) {
    rewards.ratingPopupShown = true;
    saveGameData();
    setTimeout(async () => {
      const wantRate = window.confirm("恭喜您已經通過 10 關！前往商店給我們 5 星好評，可以立刻獲得 1000 能量喔！\n現在要去評價嗎？");
      if (wantRate) {
        openExternalUrl(PLAY_STORE_URL);
        await grantSocialReward("ratingEnergyClaimed", RATING_REWARD_ENERGY, "評分支持", helpers);
        renderSocialRewardsPanel(helpers);
      }
    }, 800);
  }
}
