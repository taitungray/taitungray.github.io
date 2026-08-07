/**
 * 成語大冒險 - 字形與字音類小遊戲渲染模組
 */

import { gameState } from '../state.js';
import { sounds } from '../audio.js';
import { showToast } from '../ui.js';
import { handleCorrectAnswer, logIncorrectAttempt } from '../minigames.js';
import { shuffleArray } from './helpers.js';

// 部首拆解定義 (部首 + 偏旁/部件)
// 僅收「國小可辨、部件正確」的拆法；獨體或易誤導者不列入。
export const CHAR_COMPONENTS = {
  "蛙": ["虫", "圭"],
  "蛇": ["虫", "它"],
  "茅": ["艸", "矛"],
  "慣": ["心", "貫"],
  "廬": ["广", "盧"],
  "逸": ["辵", "兔"],
  "郎": ["邑", "良"],
  "借": ["人", "昔"],
  "功": ["力", "工"],
  "助": ["力", "且"],
  "苗": ["艸", "田"],
  "假": ["人", "叚"],
  "補": ["衣", "甫"],
  "彈": ["弓", "單"],
  "拔": ["手", "犮"],
  "鳴": ["口", "鳥"],
  "狐": ["犬", "瓜"],
  "飲": ["食", "欠"],
  "針": ["金", "十"],
  "睛": ["目", "青"],
  "眼": ["目", "艮"],
  "珠": ["王", "朱"],
  "箭": ["竹", "前"],
  "雙": ["隹", "隹", "又"],
  "鵰": ["周", "鳥"],
  "舉": ["與", "手"],
  "卷": ["龹", "㔾"],
  "藍": ["艸", "監"],
  "正": ["止", "一"],
  "明": ["日", "月"],
  "精": ["米", "青"],
  "音": ["立", "日"],
  "悲": ["心", "非"],
  "速": ["辵", "束"],
  "船": ["舟", "八", "口"],
  "程": ["禾", "呈"],
  "背": ["肉", "北"],
  "起": ["走", "己"],
  "新": ["斤", "亲"],
  "筆": ["竹", "聿"],
  "誓": ["言", "折"],
  "落": ["艸", "洛"],
  "紙": ["糸", "氏"],
  "談": ["言", "炎"],
  "狡": ["犬", "交"],
  "窟": ["穴", "屈"],
  "鶴": ["鳥", "隺"],
  "順": ["頁", "川"],
  "百": ["一", "白"],
  "識": ["言", "戠"],
  "途": ["辵", "余"],
  "汗": ["水", "干"],
  "吞": ["口", "天"],
  "囫": ["囗", "勿"],
  "綢": ["糸", "周"],
  "刻": ["刀", "亥"],
  "銘": ["金", "名"],
  "沙": ["水", "少"],
  "塔": ["土", "荅"],
  "滴": ["水", "啇"],
  "穿": ["穴", "牙"],
  "堅": ["土", "臤"],
  "驚": ["馬", "敬"],
  "歡": ["欠", "雚"],
  "天": ["一", "大"],
  "喜": ["壴", "口"],
  "地": ["土", "也"],
  "驕": ["馬", "喬"],
  "兵": ["丘", "八"],
  "敗": ["貝", "攵"],
  "動": ["重", "力"],
  "體": ["骨", "豊"],
  "貼": ["貝", "占"],
  "粗": ["米", "且"],
  "意": ["心", "音"],
  "異": ["田", "共"],
  "同": ["冂", "一", "口"],
  "聲": ["耳", "殸"],
  "鳳": ["鳥", "几"],
  "舞": ["舛", "無"],
  "足": ["口", "止"],
  "智": ["日", "知"],
  "謀": ["言", "某"],
  "膽": ["肉", "詹"],
  "如": ["女", "口"],
  "博": ["十", "尃"],
  "古": ["十", "口"],
  "通": ["辵", "甬"],
  "怪": ["心", "圣"],
  "妙": ["女", "少"],
  "始": ["女", "台"],
  "終": ["糸", "冬"]
};

// ----------------------------------------------------------------------------
// 遊戲模式五：成語錯字糾察隊
// ----------------------------------------------------------------------------
export function renderTypoQuestion(container, idiomItem) {
  const wrongOptions = [...idiomItem.fillIn.options].filter(opt => opt !== idiomItem.fillIn.answerChar);
  const typoChar = wrongOptions[Math.floor(Math.random() * wrongOptions.length)] || "X";
  
  const typoIdiom = idiomItem.idiom.split("");
  const typoIndex = idiomItem.fillIn.missingIndex;
  typoIdiom[typoIndex] = typoChar;
  
  const title = document.createElement("div");
  title.className = "typo-options-title";
  title.innerText = "🔍 請找出成語中的「錯別字」：";
  container.appendChild(title);
  
  const charsContainer = document.createElement("div");
  charsContainer.className = "typo-chars-container";
  
  const charDoms = [];
  typoIdiom.forEach((char, idx) => {
    const btn = document.createElement("button");
    btn.className = "typo-char-btn";
    btn.innerText = char;
    btn.addEventListener("click", () => {
      charDoms.forEach(b => b.classList.remove("selected", "wrong-selected"));
      
      if (idx === typoIndex) {
        sounds.playClick();
        btn.classList.add("selected");
        showTypoCorrectionOptions(container, idiomItem, typoIndex, charDoms, btn);
      } else {
        sounds.playError();
        btn.classList.add("wrong-selected");
        gameState.roundAccuracy = false;
        logIncorrectAttempt();
        showToast("這個字是正確的喔，再仔細找看看！");
        setTimeout(() => btn.classList.remove("wrong-selected"), 600);
      }
    });
    charDoms.push(btn);
    charsContainer.appendChild(btn);
  });
  container.appendChild(charsContainer);
}

function showTypoCorrectionOptions(container, idiomItem, typoIndex, charDoms, selectedBtn) {
  let block = container.querySelector(".typo-correction-block");
  if (block) block.remove();
  
  block = document.createElement("div");
  block.className = "typo-correction-block";
  
  const title = document.createElement("div");
  title.className = "typo-options-title";
  title.innerText = "💡 請問正確的中文字是哪一個？";
  block.appendChild(title);
  
  const optionsContainer = document.createElement("div");
  optionsContainer.className = "typo-options-container";
  
  const shuffledOpts = shuffleArray([...idiomItem.fillIn.options]);
  shuffledOpts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "fill-option-btn";
    btn.innerText = opt;
    btn.addEventListener("click", () => {
      if (opt === idiomItem.fillIn.answerChar) {
        sounds.playSuccess();
        btn.style.backgroundColor = "var(--success)";
        btn.style.borderColor = "var(--success-dark)";
        selectedBtn.innerText = opt;
        selectedBtn.className = "typo-char-btn active-letter";
        selectedBtn.style.borderColor = "var(--success)";
        selectedBtn.style.color = "var(--success-dark)";
        selectedBtn.style.backgroundColor = "#E8F5E9";
        
        block.querySelectorAll(".fill-option-btn").forEach(b => b.style.pointerEvents = "none");
        charDoms.forEach(b => b.style.pointerEvents = "none");
        
        handleCorrectAnswer(idiomItem);
      } else {
        sounds.playError();
        gameState.roundAccuracy = false;
        logIncorrectAttempt();
        btn.style.backgroundColor = "#FFEBEE";
        btn.style.borderColor = "#EF5350";
        btn.style.color = "#C62828";
        btn.classList.add("shake");
        setTimeout(() => btn.classList.remove("shake"), 500);
      }
    });
    optionsContainer.appendChild(btn);
  });
  block.appendChild(optionsContainer);
  container.appendChild(block);
}

// ----------------------------------------------------------------------------
// 遊戲模式九：成語部首大裝配
// ----------------------------------------------------------------------------
export function renderRadicalQuestion(container, idiomItem) {
  const splitChar = idiomItem.idiom.split("").find(char => CHAR_COMPONENTS[char]);
  if (!splitChar) {
    showToast("這題暫時沒有拆字資料，已自動跳過。");
    handleCorrectAnswer(idiomItem);
    return;
  }

  const splitIndex = idiomItem.idiom.indexOf(splitChar);
  const parts = CHAR_COMPONENTS[splitChar];
  
  gameState.selectedChars = [];
  
  const title = document.createElement("div");
  title.className = "typo-options-title";
  title.innerText = "🧱 請組合偏旁與部首，裝配成正確的字：";
  container.appendChild(title);
  
  const slotsContainer = document.createElement("div");
  slotsContainer.className = "answer-slots";
  
  const slotDoms = [];
  idiomItem.idiom.split("").forEach((char, idx) => {
    const slot = document.createElement("div");
    if (idx === splitIndex) {
      slot.className = "char-slot radical-slot";
      
      const subContainer = document.createElement("div");
      subContainer.className = "radical-sub-slots-container";
      parts.forEach(() => {
        const sub = document.createElement("div");
        sub.className = "radical-sub-slot";
        sub.innerText = "？";
        subContainer.appendChild(sub);
      });
      slot.appendChild(subContainer);
      
      slot.addEventListener("click", () => resetRadicalSlot());
    } else {
      slot.className = "char-slot filled";
      slot.innerText = char;
      slot.style.borderColor = "#D1D5DB";
      slot.style.background = "#F9FAFB";
      slot.style.color = "#374151";
    }
    slotDoms.push(slot);
    slotsContainer.appendChild(slot);
  });
  container.appendChild(slotsContainer);
  
  const poolContainer = document.createElement("div");
  poolContainer.className = "letter-pool";
  
  const allParts = Object.values(CHAR_COMPONENTS).flat();
  const rawDistractors = allParts.filter(p => !parts.includes(p));
  const distractors = shuffleArray([...new Set(rawDistractors)]).slice(0, 10 - parts.length);
  
  const shuffledPool = shuffleArray([...parts, ...distractors]);
  
  shuffledPool.forEach((part, idx) => {
    const btn = document.createElement("button");
    btn.className = "letter-btn";
    btn.innerText = part;
    btn.dataset.poolIdx = idx;
    btn.addEventListener("click", () => handleSelectPart(part, btn));
    poolContainer.appendChild(btn);
  });
  container.appendChild(poolContainer);
  
  function handleSelectPart(part, btn) {
    if (gameState.selectedChars.length >= parts.length) return;
    sounds.playClick();
    
    gameState.selectedChars.push({ part, btn });
    btn.classList.add("selected");
    
    const subSlots = slotsContainer.querySelectorAll(".radical-sub-slot");
    const fillIdx = gameState.selectedChars.length - 1;
    subSlots[fillIdx].innerText = part;
    subSlots[fillIdx].style.color = "var(--primary)";
    subSlots[fillIdx].style.borderColor = "var(--primary)";
    
    if (gameState.selectedChars.length === parts.length) {
      const allSelected = gameState.selectedChars.map(item => item.part);
      const isCorrect = parts.every(p => allSelected.includes(p));
      
      if (isCorrect) {
        sounds.playSuccess();
        const radSlot = slotDoms[splitIndex];
        radSlot.innerHTML = "";
        radSlot.innerText = splitChar;
        radSlot.className = "char-slot filled radical-slot assembled";
        
        container.querySelectorAll(".letter-btn").forEach(b => b.style.pointerEvents = "none");
        handleCorrectAnswer(idiomItem);
      } else {
        sounds.playError();
        gameState.roundAccuracy = false;
        logIncorrectAttempt();
        
        subSlots.forEach(s => s.classList.add("shake"));
        setTimeout(() => {
          resetRadicalSlot();
        }, 600);
      }
    }
  }
  
  function resetRadicalSlot() {
    if (gameState.selectedChars.length === 0) return;
    sounds.playClick();
    
    gameState.selectedChars.forEach(item => {
      if (item.btn) item.btn.classList.remove("selected");
    });
    gameState.selectedChars = [];
    
    const subSlots = slotsContainer.querySelectorAll(".radical-sub-slot");
    subSlots.forEach(s => {
      s.innerText = "？";
      s.classList.remove("shake");
      s.style.color = "#8D6E63";
      s.style.borderColor = "#D7CCC8";
    });
  }
}

// ----------------------------------------------------------------------------
// 遊戲模式十一：形近字大作戰
// ----------------------------------------------------------------------------
export function renderSimCharQuestion(container, idiomItem) {
  const missingIndex = idiomItem.fillIn.missingIndex;
  const answerChar = idiomItem.fillIn.answerChar;
  
  const card = document.createElement("div");
  card.className = "simchar-idiom-card";
  
  const idiomChars = idiomItem.idiom.split("");
  idiomChars.forEach((char, idx) => {
    if (idx === missingIndex) {
      const blank = document.createElement("div");
      blank.className = "simchar-blank";
      blank.innerText = "？";
      card.appendChild(blank);
    } else {
      const box = document.createElement("div");
      box.className = "simchar-char-box";
      box.innerText = char;
      card.appendChild(box);
    }
  });
  container.appendChild(card);
  
  const optionsDiv = document.createElement("div");
  optionsDiv.className = "fill-options-container";
  
  const shuffledOpts = shuffleArray([...idiomItem.fillIn.options]);
  shuffledOpts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "fill-option-btn";
    btn.innerText = opt;
    btn.addEventListener("click", () => {
      if (opt === answerChar) {
        sounds.playSuccess();
        btn.style.backgroundColor = "var(--success)";
        btn.style.borderColor = "var(--success-dark)";
        btn.style.color = "var(--dark)";
        
        const blank = card.querySelector(".simchar-blank");
        blank.innerText = opt;
        blank.className = "simchar-blank correct";
        
        container.querySelectorAll(".fill-option-btn").forEach(b => b.style.pointerEvents = "none");
        handleCorrectAnswer(idiomItem);
      } else {
        sounds.playError();
        gameState.roundAccuracy = false;
        logIncorrectAttempt();
        btn.style.backgroundColor = "#FFEBEE";
        btn.style.borderColor = "#EF5350";
        btn.style.color = "#C62828";
        btn.classList.add("shake");
        setTimeout(() => btn.classList.remove("shake"), 500);
      }
    });
    optionsDiv.appendChild(btn);
  });
  container.appendChild(optionsDiv);
}
