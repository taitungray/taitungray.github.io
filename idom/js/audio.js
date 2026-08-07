/**
 * ??憭批???- ?單???璅∠?
 */

class SoundSynth {
  constructor() {
    this.ctx = null;
    this.bgm = null;
    this.isBgmMuted = localStorage.getItem('idiom_adv_music_muted') === 'true';
    this.isAppActive = true;
    this.wasBgmPlayingBeforeBackground = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, startTimeOffset = 0, targetFreq = null) {
    if (this.isBgmMuted || !this.isAppActive) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTimeOffset);
    
    if (targetFreq) {
      osc.frequency.exponentialRampToValueAtTime(targetFreq, this.ctx.currentTime + startTimeOffset + duration);
    }
    
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime + startTimeOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTimeOffset + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(this.ctx.currentTime + startTimeOffset);
    osc.stop(this.ctx.currentTime + startTimeOffset + duration);
  }

  playClick() {
    this.playTone(800, 'sine', 0.05);
  }

  playSuccess() {
    this.playTone(523.25, 'triangle', 0.1, 0);       // C5
    this.playTone(659.25, 'triangle', 0.1, 0.08);    // E5
    this.playTone(783.99, 'triangle', 0.25, 0.16);   // G5
    this.speakEncouragement(true);
  }

  playError() {
    this.playTone(220, 'sawtooth', 0.25, 0, 110);    // A3 down to A2 slide
    this.speakEncouragement(false);
  }

  speakEncouragement(isSuccess) {
    if (this.encourageTimeout) clearTimeout(this.encourageTimeout);
    
    this.encourageTimeout = setTimeout(() => {
      // 避免與連擊音效重疊
      if (this.isComboVoicePlaying) return;
      
      const successFiles = [
        "assets/audio/success_1.mp3",
        "assets/audio/success_2.mp3",
        "assets/audio/success_3.mp3",
        "assets/audio/success_4.mp3",
        "assets/audio/success_5.mp3",
        "assets/audio/success_6.mp3",
        "assets/audio/success_7.mp3",
        "assets/audio/success_8.mp3"
      ];
      const errorFiles = [
        "assets/audio/error_1.mp3",
        "assets/audio/error_2.mp3"
      ];
      
      const files = isSuccess ? successFiles : errorFiles;
      const file = files[Math.floor(Math.random() * files.length)];
      
      const audio = new Audio(file);
      audio.volume = 1.0;
      audio.play().catch(e => {
        // 若尚未準備好音檔，會在這裡報錯但不會影響遊戲運行
        console.log("Encouragement MP3 play failed or not found:", e);
      });
    }, 50);
  }

  playMatch() {
    this.playTone(587.33, 'sine', 0.08, 0);          // D5
    this.playTone(880.00, 'sine', 0.15, 0.08);         // A5
  }

  playLevelUp() {
    const tones = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    tones.forEach((t, i) => {
      this.playTone(t, 'triangle', 0.15, i * 0.12);
    });
    this.playTone(1046.50, 'triangle', 0.4, 0.48, 1200);
  }

  initBgm() {
    if (this.bgm) return;
    this.bgm = new Audio('assets/audio/bgm_soft_loop.wav');
    this.bgm.loop = true;
    this.bgm.volume = 0.18;
  }

  playBgm() {
    if (!this.isAppActive) return;
    this.initBgm();
    if (!this.isBgmMuted) {
      this.bgm.play().catch(err => {
        console.log("Autoplay blocked or failed:", err);
      });
    }
  }

  pauseBgm() {
    if (this.bgm) {
      this.bgm.pause();
    }
  }

  pauseForBackground() {
    if (!this.isAppActive) return;
    this.wasBgmPlayingBeforeBackground = !!this.bgm && !this.bgm.paused && !this.isBgmMuted;
    this.isAppActive = false;
    this.pauseBgm();
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(err => console.log("Audio suspend failed:", err));
    }
  }

  resumeFromBackground() {
    if (this.isAppActive) return;
    this.isAppActive = true;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(err => console.log("Audio resume failed:", err));
    }
    if (this.wasBgmPlayingBeforeBackground && !this.isBgmMuted) {
      this.playBgm();
    }
    this.wasBgmPlayingBeforeBackground = false;
  }

  toggleBgm() {
    this.initBgm();
    this.isBgmMuted = !this.isBgmMuted;
    localStorage.setItem('idiom_adv_music_muted', this.isBgmMuted);
    
    if (this.isBgmMuted) {
      this.bgm.pause();
      this.updateBgmButton(true);
    } else {
      if (this.isAppActive) {
        this.bgm.play().catch(err => console.log("BGM play failed:", err));
      }
      this.updateBgmButton(false);
    }
  }

  updateBgmButton(muted) {
    const btn = document.getElementById('bgm-toggle-btn');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
    }
  }

  playAnnouncerVoice(text) {
    if (!this.isAppActive) return;

    // 播放一個歡樂的小前奏音效
    if (!this.isBgmMuted) {
      this.playTone(659.25, 'sine', 0.1, 0);       // E5
      this.playTone(880.00, 'triangle', 0.2, 0.1); // A5
    }

    const voiceMap = {
      "小試牛刀": "assets/audio/combo_3.mp3",
      "小有成就": "assets/audio/combo_5.mp3",
      "無懈可擊": "assets/audio/combo_10.mp3",
      "勢不可擋": "assets/audio/combo_15.mp3",
      "登峰造極": "assets/audio/combo_20.mp3"
    };

    if (voiceMap[text]) {
      this.stopSpeech(); // 取消剛剛可能排入的 TTS 鼓勵語音
      this.isComboVoicePlaying = true;
      setTimeout(() => { this.isComboVoicePlaying = false; }, 2000); // 鎖定 TTS 2秒

      const audio = new Audio(voiceMap[text]);
      audio.volume = 1.0;
      audio.play().catch(e => console.log("Audio play failed:", e));
    }
  }

  getNativeTts() {
    if (typeof window === 'undefined') return null;
    return window.Capacitor?.Plugins?.NativeTts || null;
  }

  async speakIdiom(idiomText, explanationText) {
    this.stopSpeech(); // Stop any ongoing speech

    const nativeTts = this.getNativeTts();
    if (nativeTts?.speak) {
      try {
        await nativeTts.speak({
          text: `${idiomText}\u3002${explanationText}`,
          rate: 1.0,
          pitch: 1.2
        });
        return;
      } catch (e) {
        console.log("Native TTS failed, falling back to Web Speech:", e);
      }
    }

    if (!window.speechSynthesis) return;

    // 為了和 APP (Native TTS) 統一，合併為單一句子並使用相同的語速與音調
    const text = `${idiomText}\u3002${explanationText}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.pitch = 1.2;
    utterance.rate = 1.0;
    
    // 嘗試尋找合適的語音
    const voices = window.speechSynthesis.getVoices();
    const twVoice = voices.find(v => v.lang === 'zh-TW' && (v.name.includes('Google') || v.name.includes('Female') || v.name.includes('Microsoft')));
    if (twVoice) {
      utterance.voice = twVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  stopSpeech() {
    const nativeTts = this.getNativeTts();
    if (nativeTts?.stop) {
      nativeTts.stop().catch(e => console.log("Native TTS stop failed:", e));
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
}

export const sounds = new SoundSynth();

// 預先載入語音清單 (瀏覽器通常需非同步載入語音)
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
