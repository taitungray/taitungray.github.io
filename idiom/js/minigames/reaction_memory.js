/**
 * 成語大冒險 - 反應與記憶類小遊戲渲染模組
 */

import { gameState } from '../state.js';
import { sounds } from '../audio.js';
import { unlockIdiom } from '../ui.js';
import { handleCorrectAnswer, logIncorrectAttempt } from '../minigames.js';
import { shuffleArray } from './helpers.js';

// ----------------------------------------------------------------------------
// 遊戲模式三：釋義配對牌 (翻牌記憶)
// ----------------------------------------------------------------------------
export function renderMatchGame(container, selectedFourIdioms) {
  clearMatchPreviewTimers();
  gameState.flippedCards = [];
  gameState.matchedPairs = 0;
  gameState.totalPairs = selectedFourIdioms.length;
  gameState.matchPreviewActive = true;
  
  let cards = [];
  selectedFourIdioms.forEach(item => {
    cards.push({
      id: item.id,
      type: "idiom",
      content: item.idiom
    });
    let shortDef = item.explanation.split("。")[0] + "。";
    if (shortDef.length > 25) {
      shortDef = shortDef.substring(0, 24) + "...";
    }
    cards.push({
      id: item.id,
      type: "definition",
      content: shortDef
    });
  });
  
  cards = shuffleArray(cards);
  
  const stage = document.createElement("div");
  stage.className = "match-stage";

  const previewBanner = document.createElement("div");
  previewBanner.className = "match-preview-banner";
  previewBanner.innerText = "先記住牌面：5";
  stage.appendChild(previewBanner);

  const grid = document.createElement("div");
  grid.className = "match-grid previewing";
  
  cards.forEach((cardData, idx) => {
    const cardContainer = document.createElement("div");
    cardContainer.className = "card-container flipped preview-locked";
    cardContainer.dataset.idx = idx;
    
    const cardInner = document.createElement("div");
    cardInner.className = "memory-card";
    
    const cardBack = document.createElement("div");
    cardBack.className = "card-face card-back";
    cardBack.innerText = "❓";
    
    const cardFront = document.createElement("div");
    cardFront.className = `card-face card-front type-${cardData.type}`;
    cardFront.innerText = cardData.content;
    
    cardInner.appendChild(cardBack);
    cardInner.appendChild(cardFront);
    cardContainer.appendChild(cardInner);
    
    cardContainer.addEventListener("click", () => handleFlipCard(cardContainer, cardData));
    
    grid.appendChild(cardContainer);
  });
  
  stage.appendChild(grid);
  container.appendChild(stage);

  startMatchPreviewCountdown(grid, previewBanner);
}

function handleFlipCard(cardDom, cardData) {
  if (gameState.matchPreviewActive) {
    return;
  }

  if (cardDom.classList.contains("flipped") || 
      cardDom.classList.contains("matched") || 
      gameState.flippedCards.length >= 2) {
    return;
  }
  
  sounds.playClick();
  cardDom.classList.add("flipped");
  gameState.flippedCards.push({ dom: cardDom, data: cardData });
  
  if (gameState.flippedCards.length === 2) {
    const card1 = gameState.flippedCards[0];
    const card2 = gameState.flippedCards[1];
    
    if (card1.data.id === card2.data.id && card1.data.type !== card2.data.type) {
      setTimeout(() => {
        sounds.playMatch();
        card1.dom.classList.add("matched");
        card2.dom.classList.add("matched");
        gameState.matchedPairs++;
        
        unlockIdiom(card1.data.id);
        
        gameState.flippedCards = [];
        
        if (gameState.matchedPairs === gameState.totalPairs) {
          setTimeout(() => {
            gameState.roundCorrectAnswers = 1;
            handleCorrectAnswer(null);
          }, 600);
        }
      }, 500);
    } else {
      setTimeout(() => {
        sounds.playError();
        card1.dom.classList.remove("flipped");
        card2.dom.classList.remove("flipped");
        gameState.flippedCards = [];
        gameState.roundAccuracy = false;
        logIncorrectAttempt();
      }, 1000);
    }
  }
}

function clearMatchPreviewTimers() {
  if (gameState.matchPreviewInterval) {
    clearInterval(gameState.matchPreviewInterval);
    gameState.matchPreviewInterval = null;
  }
  if (gameState.matchPreviewTimeout) {
    clearTimeout(gameState.matchPreviewTimeout);
    gameState.matchPreviewTimeout = null;
  }
}

function startMatchPreviewCountdown(grid, previewBanner) {
  const previewSeconds = 5;
  let secondsLeft = previewSeconds;
  const previewToken = Date.now();
  gameState.matchPreviewToken = previewToken;

  gameState.matchPreviewInterval = setInterval(() => {
    if (gameState.matchPreviewToken !== previewToken) return;
    secondsLeft--;
    if (secondsLeft > 0) {
      previewBanner.innerText = `先記住牌面：${secondsLeft}`;
    }
  }, 1000);

  gameState.matchPreviewTimeout = setTimeout(() => {
    if (gameState.matchPreviewToken !== previewToken) return;
    clearMatchPreviewTimers();
    gameState.matchPreviewActive = false;
    previewBanner.innerText = "開始配對！";
    grid.classList.remove("previewing");
    grid.querySelectorAll(".card-container").forEach(card => {
      card.classList.remove("flipped", "preview-locked");
    });

    setTimeout(() => {
      if (previewBanner.isConnected) {
        previewBanner.classList.add("compact");
        previewBanner.innerText = "翻出成語與釋義配對";
      }
    }, 700);
  }, previewSeconds * 1000);
}

// ----------------------------------------------------------------------------
// 遊戲模式七：成語接龍大挑戰
// ----------------------------------------------------------------------------
export function renderChainQuestion(container, pairItem) {
  const idiomItem = pairItem.from || pairItem;
  const lastChar = idiomItem.idiom[3];
  
  const targetIdiomItem = pairItem.to || IDIOMS_DATA.find(item => item.idiom[0] === lastChar);
  const targetIdiom = targetIdiomItem.idiom;
  
  gameState.selectedChars = [{ char: lastChar, btn: null }];
  
  const card = document.createElement("div");
  card.className = "chain-question-card";
  
  const flow = document.createElement("div");
  flow.className = "chain-flow";
  
  const sourceBox = document.createElement("div");
  sourceBox.className = "chain-idiom-box";
  sourceBox.innerHTML = `${idiomItem.idiom.substring(0, 3)}<span class="last-char">${lastChar}</span>`;
  
  const arrow = document.createElement("div");
  arrow.className = "chain-arrow";
  arrow.innerText = "➡️";
  
  const targetBox = document.createElement("div");
  targetBox.className = "chain-target-box";
  targetBox.innerText = `接「${lastChar}」...`;
  
  flow.appendChild(sourceBox);
  flow.appendChild(arrow);
  flow.appendChild(targetBox);
  card.appendChild(flow);
  container.appendChild(card);
  
  const slotsContainer = document.createElement("div");
  slotsContainer.className = "answer-slots";
  
  const slotDoms = [];
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement("div");
    slot.className = "char-slot";
    if (i === 0) {
      slot.innerText = lastChar;
      slot.className += " filled";
      slot.style.borderColor = "var(--primary)";
      slot.style.background = "#F3E5F5";
      slot.style.color = "#7B1FA2";
      slot.style.cursor = "default";
    } else {
      slot.dataset.index = i;
      slot.addEventListener("click", () => handleRemoveChainChar(i));
    }
    slotDoms.push(slot);
    slotsContainer.appendChild(slot);
  }
  container.appendChild(slotsContainer);
  
  const poolContainer = document.createElement("div");
  poolContainer.className = "letter-pool";
  
  const targetChars = targetIdiom.substring(1).split("");
  const rawDistractors = IDIOMS_DATA.map(item => item.idiom)
    .join("")
    .split("")
    .filter(char => !targetIdiom.includes(char));
  const distractors = shuffleArray([...new Set(rawDistractors)]).slice(0, 9);
  
  const shuffledPool = shuffleArray([...targetChars, ...distractors]);
  
  shuffledPool.forEach((char, idx) => {
    const btn = document.createElement("button");
    btn.className = "letter-btn";
    btn.innerText = char;
    btn.dataset.poolIdx = idx;
    btn.addEventListener("click", () => handleSelectChainChar(char, btn));
    poolContainer.appendChild(btn);
  });
  container.appendChild(poolContainer);

  function handleSelectChainChar(char, btn) {
    if (gameState.selectedChars.length >= 4) return;
    sounds.playClick();
    
    gameState.selectedChars.push({ char, btn });
    btn.classList.add("selected");
    
    const fillIdx = gameState.selectedChars.length - 1;
    slotDoms[fillIdx].innerText = char;
    slotDoms[fillIdx].classList.add("filled");
    
    if (gameState.selectedChars.length === 4) {
      const answer = gameState.selectedChars.map(item => item.char).join("");
      if (answer === targetIdiom) {
        sounds.playSuccess();
        container.querySelectorAll(".letter-btn").forEach(b => b.style.pointerEvents = "none");
        slotDoms.forEach(s => s.style.pointerEvents = "none");
        
        slotDoms.forEach(s => {
          s.style.borderColor = "var(--success)";
          s.style.color = "var(--success-dark)";
          s.style.backgroundColor = "#E8F5E9";
        });
        
        targetBox.className = "chain-idiom-box";
        targetBox.style.border = "2px solid var(--success-dark)";
        targetBox.style.background = "#E8F5E9";
        targetBox.style.color = "var(--success-dark)";
        targetBox.innerText = targetIdiom;
        
        handleCorrectAnswer(targetIdiomItem);
      } else {
        sounds.playError();
        gameState.roundAccuracy = false;
        logIncorrectAttempt();
        
        slotDoms.forEach((s, index) => {
          if (index > 0) s.classList.add("shake");
        });
        
        setTimeout(() => {
          slotDoms.forEach((s, index) => {
            if (index > 0) {
              s.innerText = "";
              s.classList.remove("filled", "shake");
            }
          });
          gameState.selectedChars.forEach((item, index) => {
            if (index > 0 && item.btn) {
              item.btn.classList.remove("selected");
            }
          });
          gameState.selectedChars = [{ char: lastChar, btn: null }];
        }, 600);
      }
    }
  }

  function handleRemoveChainChar(slotIndex) {
    if (slotIndex >= gameState.selectedChars.length) return;
    sounds.playClick();
    
    const removed = gameState.selectedChars.splice(slotIndex, 1)[0];
    if (removed.btn) removed.btn.classList.remove("selected");
    
    slotDoms.forEach((slot, idx) => {
      if (idx > 0) {
        if (idx < gameState.selectedChars.length) {
          slot.innerText = gameState.selectedChars[idx].char;
          slot.classList.add("filled");
        } else {
          slot.innerText = "";
          slot.classList.remove("filled");
        }
      }
    });
  }
}

// ----------------------------------------------------------------------------
// 遊戲模式八：填字交叉拼圖 (Crossword)
// ----------------------------------------------------------------------------
export function renderCrosswordQuestion(container, pairItem) {
  const { idiomA, idiomB, char, idxA, idxB } = pairItem || {};

  if (!idiomA || !idiomB || !char || idxA < 0 || idxB < 0) {
    const fallback = document.createElement("div");
    fallback.className = "typo-options-title";
    fallback.innerText = "這題暫時無法顯示，請返回再試一次。";
    container.appendChild(fallback);
    return;
  }
  
  const gridCells = Array(5).fill(null).map(() => Array(5).fill(null));
  const intersectRow = idxB <= 1 ? idxB + 1 : idxB;
  const intersectCol = idxA <= 1 ? idxA + 1 : idxA;
  
  const startColA = intersectCol - idxA;
  for (let c = 0; c < 4; c++) {
    const colIdx = startColA + c;
    gridCells[intersectRow][colIdx] = {
      char: idiomA.idiom[c],
      isIntersect: colIdx === intersectCol
    };
  }
  
  const startRowB = intersectRow - idxB;
  for (let r = 0; r < 4; r++) {
    const rowIdx = startRowB + r;
    gridCells[rowIdx][intersectCol] = {
      char: idiomB.idiom[r],
      isIntersect: rowIdx === intersectRow
    };
  }
  
  const crosswordContainer = document.createElement("div");
  crosswordContainer.className = "crossword-container";
  
  const gridDiv = document.createElement("div");
  gridDiv.className = "crossword-grid";
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement("div");
      cell.className = "crossword-cell";
      const cellData = gridCells[r][c];
      if (cellData) {
        if (cellData.isIntersect) {
          cell.className += " intersect-blank";
          cell.innerText = "？";
        } else {
          cell.className += " active-letter";
          cell.innerText = cellData.char;
        }
      }
      gridDiv.appendChild(cell);
    }
  }
  crosswordContainer.appendChild(gridDiv);
  
  const cluesDiv = document.createElement("div");
  cluesDiv.className = "crossword-clues";
  
  const clueA = document.createElement("div");
  clueA.className = "crossword-clue-item";
  clueA.innerHTML = `<span class="crossword-clue-label horizontal">➡️ 橫向成語</span> ${idiomA.explanation}`;
  cluesDiv.appendChild(clueA);
  
  const clueB = document.createElement("div");
  clueB.className = "crossword-clue-item";
  clueB.innerHTML = `<span class="crossword-clue-label vertical">⬇️ 縱向成語</span> ${idiomB.explanation}`;
  cluesDiv.appendChild(clueB);
  
  crosswordContainer.appendChild(cluesDiv);
  container.appendChild(crosswordContainer);
  
  const optionsTitle = document.createElement("div");
  optionsTitle.className = "typo-options-title";
  optionsTitle.innerText = "💡 請問重疊格應該填入哪一個字？";
  container.appendChild(optionsTitle);
  
  const optionsContainer = document.createElement("div");
  optionsContainer.className = "typo-options-container";
  
  const rawDistractors = [
    ...(idiomA.fillIn.options || []),
    ...(idiomB.fillIn.options || [])
  ].filter(opt => opt !== char);
  const distractors = shuffleArray([...new Set(rawDistractors)]).slice(0, 3);
  
  while (distractors.length < 3) {
    const randomChar = IDIOMS_DATA[Math.floor(Math.random() * IDIOMS_DATA.length)].idiom[Math.floor(Math.random() * 4)];
    if (randomChar !== char && !distractors.includes(randomChar)) {
      distractors.push(randomChar);
    }
  }
  
  const optionsPool = shuffleArray([char, ...distractors]);
  optionsPool.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "fill-option-btn";
    btn.innerText = opt;
    btn.addEventListener("click", () => {
      if (opt === char) {
        sounds.playSuccess();
        btn.style.backgroundColor = "var(--success)";
        btn.style.borderColor = "var(--success-dark)";
        
        const intersectCell = gridDiv.querySelector(".intersect-blank");
        intersectCell.innerText = char;
        intersectCell.className = "crossword-cell active-letter intersect-filled";
        
        container.querySelectorAll(".fill-option-btn").forEach(b => b.style.pointerEvents = "none");
        handleCorrectAnswer(idiomA, idiomB);
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
// 遊戲模式十：成語泡泡射手
// ----------------------------------------------------------------------------
export function renderBubbleQuestion(container, idiomItem) {
  const missingIndex = idiomItem.fillIn.missingIndex;
  const answerChar = idiomItem.fillIn.answerChar;
  
  const qCard = document.createElement("div");
  qCard.className = "fill-question-card";
  
  const sentenceDiv = document.createElement("div");
  sentenceDiv.className = "fill-sentence";
  
  const idiomChars = idiomItem.idiom.split("");
  idiomChars[missingIndex] = "＿";
  
  sentenceDiv.innerText = `成語填空：${idiomChars.join(" ")}`;
  qCard.appendChild(sentenceDiv);
  container.appendChild(qCard);
  
  const bubbleContainer = document.createElement("div");
  bubbleContainer.className = "bubble-game-container";
  container.appendChild(bubbleContainer);
  
  const rawDistractors = [
    ...(idiomItem.fillIn.options || [])
  ].filter(opt => opt !== answerChar);
  
  while (rawDistractors.length < 4) {
    const randomChar = IDIOMS_DATA[Math.floor(Math.random() * IDIOMS_DATA.length)].idiom[Math.floor(Math.random() * 4)];
    if (randomChar !== answerChar && !rawDistractors.includes(randomChar)) {
      rawDistractors.push(randomChar);
    }
  }
  
  const options = shuffleArray([answerChar, ...rawDistractors.slice(0, 4)]);
  
  let bubblesLaunched = [];
  let isFinished = false;
  
  options.forEach((char, idx) => {
    const delay = idx * 1300;
    const launchTimeout = setTimeout(() => {
      if (isFinished) return;
      createBubble(char);
    }, delay);
    bubblesLaunched.push(launchTimeout);
  });
  
  function createBubble(char) {
    const bubble = document.createElement("div");
    bubble.className = "bubble-item";
    bubble.innerText = char;
    
    const maxLeft = bubbleContainer.clientWidth - 60;
    const randomLeft = Math.max(10, Math.floor(Math.random() * maxLeft));
    bubble.style.left = `${randomLeft}px`;
    
    bubbleContainer.appendChild(bubble);
    
    let bottomPos = -50;
    const speed = Math.random() * 0.7 + 1.1;
    
    function floatUp() {
      if (isFinished) return;
      bottomPos += speed;
      bubble.style.bottom = `${bottomPos}px`;
      
      if (bottomPos < bubbleContainer.clientHeight) {
        requestAnimationFrame(floatUp);
      } else {
        bubble.remove();
        if (!isFinished) {
          createBubble(char);
        }
      }
    }
    
    bubble.addEventListener("click", () => {
      if (isFinished) return;
      
      if (char === answerChar) {
        sounds.playSuccess();
        isFinished = true;
        bubble.className += " popped";
        
        bubblesLaunched.forEach(t => clearTimeout(t));
        
        setTimeout(() => {
          bubble.remove();
          bubbleContainer.querySelectorAll(".bubble-item").forEach(b => b.remove());
          handleCorrectAnswer(idiomItem);
        }, 300);
      } else {
        sounds.playError();
        gameState.roundAccuracy = false;
        logIncorrectAttempt();
        
        bubble.classList.add("shake");
        setTimeout(() => bubble.classList.remove("shake"), 500);
      }
    });
    
    requestAnimationFrame(floatUp);
  }
}
