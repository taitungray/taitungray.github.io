/**
 * 成語大冒險 - 語意與關聯類小遊戲渲染模組
 */

import { gameState } from '../state.js';
import { sounds } from '../audio.js';
import { unlockIdiom } from '../ui.js';
import { handleCorrectAnswer, logIncorrectAttempt, addTime, canRenderImageGuess, skipIncompleteImageQuestion } from '../minigames.js';
import { shuffleArray } from './helpers.js';

// 成語語意關係定義 (近義詞/反義詞)
export const IDIOM_RELATIONS = [
  // === 近義詞 ===
  { a: "一箭雙鵰", b: "一舉兩得", relation: "近義詞" },
  { a: "真相大白", b: "水落石出", relation: "近義詞" },
  { a: "司空見慣", b: "屢見不鮮", relation: "近義詞" },
  { a: "三顧茅廬", b: "禮賢下士", relation: "近義詞" },
  { a: "畫蛇添足", b: "多此一舉", relation: "近義詞" },
  { a: "守株待兔", b: "徒勞無功", relation: "近義詞" },
  { a: "完璧歸趙", b: "物歸原主", relation: "近義詞" },
  { a: "望梅止渴", b: "畫餅充飢", relation: "近義詞" },
  { a: "自欺欺人", b: "掩耳盜鈴", relation: "近義詞" },
  { a: "愚公移山", b: "精衛填海", relation: "近義詞" },
  { a: "杯弓蛇影", b: "杞人憂天", relation: "近義詞" },
  { a: "對牛彈琴", b: "對手談天", relation: "近義詞" },
  { a: "揠苗助長", b: "急於求成", relation: "近義詞" },
  { a: "狐假虎威", b: "仗勢欺人", relation: "近義詞" },
  { a: "自相矛盾", b: "前後抵觸", relation: "近義詞" },
  { a: "一鳴驚人", b: "一舉成名", relation: "近義詞" },
  { a: "飲水思源", b: "感恩圖報", relation: "近義詞" },
  { a: "熟能生巧", b: "得心應手", relation: "近義詞" },
  { a: "班門弄斧", b: "布鼓雷門", relation: "近義詞" },
  { a: "鷸蚌相爭", b: "兩敗俱傷", relation: "近義詞" },
  { a: "指鹿為馬", b: "混淆黑白", relation: "近義詞" },
  { a: "朝三暮四", b: "反覆無常", relation: "近義詞" },
  { a: "破釜沉舟", b: "背水一戰", relation: "近義詞" },
  { a: "鶴立雞群", b: "出類拔萃", relation: "近義詞" },
  { a: "亡羊補牢", b: "防微杜漸", relation: "近義詞" },
  { a: "畫龍點睛", b: "錦上添花", relation: "近義詞" },
  { a: "鐵杵磨針", b: "持之以恆", relation: "近義詞" },
  { a: "驚弓之鳥", b: "漏網之魚", relation: "近義詞" },
  { a: "杞人憂天", b: "庸人自擾", relation: "近義詞" },
  { a: "開卷有益", b: "學無止境", relation: "近義詞" },
  { a: "青出於藍", b: "後來居上", relation: "近義詞" },
  { a: "光明正大", b: "光明磊落", relation: "近義詞" },
  { a: "心知肚明", b: "心照不宣", relation: "近義詞" },
  { a: "精益求精", b: "力求完美", relation: "近義詞" },
  { a: "一往無前", b: "勇往直前", relation: "近義詞" },
  { a: "餘音繞梁", b: "繞梁三日", relation: "近義詞" },
  { a: "安步當車", b: "從容不迫", relation: "近義詞" },
  { a: "兵貴神速", b: "速戰速決", relation: "近義詞" },
  { a: "草船借箭", b: "足智多謀", relation: "近義詞" },
  { a: "程門立雪", b: "尊師重道", relation: "近義詞" },
  { a: "倒背如流", b: "滾瓜爛熟", relation: "近義詞" },
  { a: "東山再起", b: "重整旗鼓", relation: "近義詞" },
  { a: "耳目一新", b: "煥然一新", relation: "近義詞" },
  { a: "奮筆疾書", b: "筆走龍蛇", relation: "近義詞" },
  { a: "高瞻遠矚", b: "深謀遠慮", relation: "近義詞" },
  { a: "海誓山盟", b: "海枯石爛", relation: "近義詞" },

  // === 反義詞 ===
  { a: "守株待兔", b: "通權達變", relation: "反義詞" },
  { a: "夜郎自大", b: "虛懷若谷", relation: "反義詞" },
  { a: "雪中送炭", b: "落井下石", relation: "反義詞" },
  { a: "完璧歸趙", b: "強取豪奪", relation: "反義詞" },
  { a: "望梅止渴", b: "無濟於事", relation: "反義詞" },
  { a: "自欺欺人", b: "光明磊落", relation: "反義詞" },
  { a: "愚公移山", b: "半途而廢", relation: "反義詞" },
  { a: "杯弓蛇影", b: "處之泰然", relation: "反義詞" },
  { a: "揠苗助長", b: "順其自然", relation: "反義詞" },
  { a: "狐假虎威", b: "獨當一面", relation: "反義詞" },
  { a: "自相矛盾", b: "天衣無縫", relation: "反義詞" },
  { a: "一鳴驚人", b: "默默無聞", relation: "反義詞" },
  { a: "飲水思源", b: "過河拆橋", relation: "反義詞" },
  { a: "熟能生巧", b: "生疏笨拙", relation: "反義詞" },
  { a: "班門弄斧", b: "深藏不露", relation: "反義詞" },
  { a: "鷸蚌相爭", b: "相輔相成", relation: "反義詞" },
  { a: "指鹿為馬", b: "實事求是", relation: "反義詞" },
  { a: "朝三暮四", b: "始終如一", relation: "反義詞" },
  { a: "破釜沉舟", b: "優柔寡斷", relation: "反義詞" },
  { a: "鶴立雞群", b: "平淡無奇", relation: "反義詞" },
  { a: "亡羊補牢", b: "執迷不悟", relation: "反義詞" },
  { a: "畫龍點睛", b: "畫蛇添足", relation: "反義詞" },
  { a: "鐵杵磨針", b: "半途而廢", relation: "反義詞" },
  { a: "驚弓之鳥", b: "泰然自若", relation: "反義詞" },
  { a: "杞人憂天", b: "無憂無慮", relation: "反義詞" },
  { a: "山窮水盡", b: "柳暗花明", relation: "反義詞" },
  { a: "心平氣和", b: "暴跳如雷", relation: "反義詞" },
  { a: "足智多謀", b: "愚昧無知", relation: "反義詞" },
  { a: "博古通今", b: "孤陋寡聞", relation: "反義詞" },
  { a: "地動山搖", b: "風平浪靜", relation: "反義詞" },
  { a: "開卷有益", b: "不學無術", relation: "反義詞" },
  { a: "青出於藍", b: "一成不變", relation: "反義詞" },
  { a: "光明正大", b: "偷偷摸摸", relation: "反義詞" },
  { a: "心知肚明", b: "一無所知", relation: "反義詞" },
  { a: "精益求精", b: "敷衍了事", relation: "反義詞" },
  { a: "一往無前", b: "畏縮不前", relation: "反義詞" },
  { a: "餘音繞梁", b: "索然無味", relation: "反義詞" },
  { a: "樂極生悲", b: "否極泰來", relation: "反義詞" },
  { a: "安步當車", b: "急如星火", relation: "反義詞" },
  { a: "兵貴神速", b: "拖泥帶水", relation: "反義詞" },
  { a: "草船借箭", b: "束手無策", relation: "反義詞" },
  { a: "程門立雪", b: "目無尊長", relation: "反義詞" },
  { a: "倒背如流", b: "結結巴巴", relation: "反義詞" },
  { a: "東山再起", b: "一蹶不振", relation: "反義詞" },
  { a: "耳目一新", b: "老生常談", relation: "反義詞" },
  { a: "奮筆疾書", b: "慢條斯理", relation: "反義詞" },
  { a: "高瞻遠矚", b: "目光短淺", relation: "反義詞" },
  { a: "海誓山盟", b: "背信忘義", relation: "反義詞" }
].reduce((acc, curr) => {
  acc.push(curr);
  if (curr.a !== curr.b) {
    acc.push({ a: curr.b, b: curr.a, relation: curr.relation });
  }
  return acc;
}, []);

// ----------------------------------------------------------------------------
// 遊戲模式一：看圖猜成語
// ----------------------------------------------------------------------------
function buildImageGuessLetterPool(idiomItem) {
  const targetSize = 12;
  const answerChars = Array.from(idiomItem.idiom || "");
  const answerSet = new Set(answerChars);
  const sourceChars = Array.from(String(idiomItem.letters || ""));
  const pool = [...answerChars];
  const usedDistractors = new Set();

  sourceChars.forEach(char => {
    if (pool.length >= targetSize) return;
    if (answerSet.has(char) || usedDistractors.has(char)) return;

    usedDistractors.add(char);
    pool.push(char);
  });

  const fallbackChars = Array.from("天地山水日月風火木金土人心口手足目耳鳥魚花草馬牛羊犬虎龍雲雨石竹書筆門車船");
  fallbackChars.forEach(char => {
    if (pool.length >= targetSize) return;
    if (answerSet.has(char) || usedDistractors.has(char)) return;

    usedDistractors.add(char);
    pool.push(char);
  });

  return pool.slice(0, targetSize);
}

export function renderImageGuess(container, idiomItem) {
  gameState.selectedChars = [];

  if (!canRenderImageGuess(idiomItem)) {
    skipIncompleteImageQuestion();
    return;
  }
  
  const imgContainer = document.createElement("div");
  imgContainer.className = "guess-img-container";
  const img = document.createElement("img");
  img.src = idiomItem.image;
  img.alt = "成語提示圖";
  img.className = "guess-img";
  img.onerror = () => {
    skipIncompleteImageQuestion("圖片暫時載入失敗，正在換下一題。");
  };
  imgContainer.appendChild(img);
  container.appendChild(imgContainer);
  
  const slotsContainer = document.createElement("div");
  slotsContainer.className = "answer-slots";
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    slot.className = "char-slot";
    slot.dataset.index = i;
    slot.addEventListener("click", () => handleRemoveSlotChar(i, idiomItem));
    slotsContainer.appendChild(slot);
  }
  container.appendChild(slotsContainer);
  
  const poolContainer = document.createElement("div");
  poolContainer.className = "letter-pool";
  
  const shuffledPool = shuffleArray(buildImageGuessLetterPool(idiomItem));
  
  shuffledPool.forEach((char, idx) => {
    const btn = document.createElement("button");
    btn.className = "letter-btn";
    btn.innerText = char;
    btn.dataset.poolIdx = idx;
    btn.addEventListener("click", () => handleSelectPoolChar(char, btn, idiomItem));
    poolContainer.appendChild(btn);
  });
  container.appendChild(poolContainer);
}

function handleSelectPoolChar(char, btn, idiomItem) {
  sounds.playClick();
  if (gameState.selectedChars.length >= 4) return;
  
  gameState.selectedChars.push({ char, btn });
  btn.classList.add("selected");
  
  const slots = document.querySelectorAll(".char-slot");
  const fillIdx = gameState.selectedChars.length - 1;
  slots[fillIdx].innerText = char;
  slots[fillIdx].classList.add("filled");
  
  if (gameState.selectedChars.length === 4) {
    const answer = gameState.selectedChars.map(item => item.char).join("");
    if (answer === idiomItem.idiom) {
      handleCorrectAnswer(idiomItem);
    } else {
      handleWrongAnswer();
    }
  }
}

function handleRemoveSlotChar(slotIndex, idiomItem) {
  if (slotIndex >= gameState.selectedChars.length) return;
  sounds.playClick();
  
  const removed = gameState.selectedChars.splice(slotIndex, 1)[0];
  removed.btn.classList.remove("selected");
  
  const slots = document.querySelectorAll(".char-slot");
  slots.forEach((slot, idx) => {
    if (idx < gameState.selectedChars.length) {
      slot.innerText = gameState.selectedChars[idx].char;
      slot.classList.add("filled");
    } else {
      slot.innerText = "";
      slot.classList.remove("filled");
    }
  });
}

function handleWrongAnswer() {
  sounds.playError();
  gameState.roundAccuracy = false;
  logIncorrectAttempt();
  
  const slots = document.querySelectorAll(".char-slot");
  slots.forEach(s => s.classList.add("shake"));
  
  setTimeout(() => {
    slots.forEach(s => {
      s.innerText = "";
      s.classList.remove("filled", "shake");
    });
    gameState.selectedChars.forEach(item => {
      if (item.btn) item.btn.classList.remove("selected");
    });
    gameState.selectedChars = [];
  }, 600);
}

// ----------------------------------------------------------------------------
// 遊戲模式二：成語填空賽
// ----------------------------------------------------------------------------
export function renderFillQuestion(container, idiomItem) {
  const qCard = document.createElement("div");
  qCard.className = "fill-question-card";
  
  const sentenceDiv = document.createElement("div");
  sentenceDiv.className = "fill-sentence";
  
  const qText = idiomItem.fillIn.question || (() => {
    const idiomStr = idiomItem.idiom;
    const missingIndex = idiomItem.fillIn.missingIndex;
    const replaceStr = idiomStr.substring(0, missingIndex) + '＿' + idiomStr.substring(missingIndex + 1);
    return (idiomItem.fillIn.sentence || idiomItem.example).replace(idiomStr, replaceStr);
  })();
  const parts = qText.split("＿");
  
  sentenceDiv.appendChild(document.createTextNode(parts[0]));
  const blank = document.createElement("span");
  blank.className = "fill-blank-highlight";
  blank.innerText = "？";
  sentenceDiv.appendChild(blank);
  sentenceDiv.appendChild(document.createTextNode(parts[1]));
  
  qCard.appendChild(sentenceDiv);
  container.appendChild(qCard);
  
  const optionsDiv = document.createElement("div");
  optionsDiv.className = "fill-options-container";
  
  const shuffledOptions = shuffleArray([...idiomItem.fillIn.options]);
  
  shuffledOptions.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "fill-option-btn";
    btn.innerText = opt;
    btn.addEventListener("click", () => handleSelectFillOption(opt, btn, blank, idiomItem));
    optionsDiv.appendChild(btn);
  });
  
  container.appendChild(optionsDiv);
}

function handleSelectFillOption(selectedOpt, btn, blankSpan, idiomItem) {
  const ans = idiomItem.fillIn.answerChar;
  
  if (selectedOpt === ans) {
    sounds.playSuccess();
    btn.style.backgroundColor = "var(--success)";
    btn.style.borderColor = "var(--success-dark)";
    btn.style.color = "var(--dark)";
    blankSpan.innerText = ans;
    blankSpan.style.borderColor = "var(--success-dark)";
    blankSpan.style.backgroundColor = "#E8F5E9";
    blankSpan.style.color = "var(--dark)";
    
    document.querySelectorAll(".fill-option-btn").forEach(b => b.style.pointerEvents = "none");
    
    handleCorrectAnswer(idiomItem);
  } else {
    sounds.playError();
    gameState.roundAccuracy = false;
    logIncorrectAttempt();
    btn.style.backgroundColor = "#FFEBEE";
    btn.style.borderColor = "#EF5350";
    btn.style.color = "#C62828";
    btn.classList.add("shake");
    
    if (gameState.currentMode === 'time') {
      addTime(-3);
    }
    
    setTimeout(() => {
      btn.classList.remove("shake");
    }, 500);
  }
}

// ----------------------------------------------------------------------------
// 遊戲模式六：故事劇場
// ----------------------------------------------------------------------------
export function renderStoryQuestion(container, idiomItem) {
  const qCard = document.createElement("div");
  qCard.className = "fill-question-card";
  
  const sentenceDiv = document.createElement("div");
  sentenceDiv.className = "fill-sentence";
  
  const sentence = idiomItem.fillIn.sentence || idiomItem.example;
  const sentenceQuestion = sentence.replace(idiomItem.idiom, "「 ＿＿＿＿ 」");
  
  sentenceDiv.innerText = sentenceQuestion;
  qCard.appendChild(sentenceDiv);
  container.appendChild(qCard);
  
  const optionsContainer = document.createElement("div");
  optionsContainer.className = "story-options-container";
  
  const distractors = shuffleArray(IDIOMS_DATA.filter(item => item.id !== idiomItem.id)).slice(0, 3);
  const optionsPool = shuffleArray([idiomItem, ...distractors]);
  
  optionsPool.forEach(optItem => {
    const btn = document.createElement("button");
    btn.className = "story-option-btn";
    btn.textContent = optItem.idiom;
    btn.addEventListener("click", () => {
      if (optItem.id === idiomItem.id) {
        sounds.playSuccess();
        btn.style.backgroundColor = "var(--success)";
        btn.style.borderColor = "var(--success-dark)";
        btn.style.color = "var(--dark)";
        
        container.querySelectorAll(".story-option-btn").forEach(b => b.style.pointerEvents = "none");
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
  
  container.appendChild(optionsContainer);
}

// ----------------------------------------------------------------------------
// 遊戲模式十二：反義詞連連看 (左右卡片對連)
// ----------------------------------------------------------------------------
export function renderAntonymQuestion(container, relationItem) {
  const mainIdiomObj = IDIOMS_DATA.find(i => i.idiom === relationItem.a);
  
  const title = document.createElement("div");
  title.className = "typo-options-title";
  const relationColor = relationItem.relation === "反義詞" ? "#E53935" : "#43A047";
  title.innerHTML = `💡 請找出「<span style="color: #3F51B5; font-weight: bold;">${relationItem.a}</span>」的【<span style="color: ${relationColor}; font-weight: bold;">${relationItem.relation}</span>】：`;
  container.appendChild(title);
  
  const gameContainer = document.createElement("div");
  gameContainer.className = "antonym-game-container";
  
  const distractorsPool = [];
  IDIOM_RELATIONS.forEach(r => {
    if (r.a !== relationItem.a && r.a !== relationItem.b) distractorsPool.push(r.a);
    if (r.b !== relationItem.a && r.b !== relationItem.b) distractorsPool.push(r.b);
  });
  const uniqueDistractors = [...new Set(distractorsPool)];
  const distractors = shuffleArray(uniqueDistractors).slice(0, 3);
  
  const choices = [relationItem.b, ...distractors];
  const shuffledChoices = shuffleArray(choices);
  
  shuffledChoices.forEach(choiceText => {
    const card = document.createElement("div");
    card.className = "antonym-card";
    card.innerText = choiceText;
    
    card.addEventListener("click", () => {
      if (gameContainer.style.pointerEvents === "none" || card.classList.contains("wrong")) return;
      
      if (choiceText === relationItem.b) {
        sounds.playSuccess();
        card.classList.add("matched");
        
        gameContainer.style.pointerEvents = "none";
        
        if (mainIdiomObj) {
          unlockIdiom(mainIdiomObj.id);
        }
        
        setTimeout(() => {
          handleCorrectAnswer(mainIdiomObj || null);
        }, 600);
      } else {
        sounds.playError();
        gameState.roundAccuracy = false;
        logIncorrectAttempt();
        card.classList.add("wrong", "shake");
        setTimeout(() => {
          card.classList.remove("shake");
        }, 500);
      }
    });
    gameContainer.appendChild(card);
  });
  
  container.appendChild(gameContainer);
}
