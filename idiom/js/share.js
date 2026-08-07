/**
 * 成語大冒險 - 小成就分享工具
 */

const OFFICIAL_WEBSITE_URL = "https://taitungray.github.io/developer.html";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.taitungray.chengyu";

function getShareUrl() {
  if (typeof window !== "undefined" && window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform()) {
    return PLAY_STORE_URL;
  }
  return OFFICIAL_WEBSITE_URL;
}

function getNativeShare() {
  if (typeof window === "undefined") return null;
  return window.Capacitor?.Plugins?.Share || null;
}

function getShortExplanation(item) {
  if (!item?.explanation) return "";
  const firstSentence = item.explanation.split("。")[0]?.trim();
  return firstSentence ? `${firstSentence}。` : item.explanation.trim();
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const chars = String(text || "").split("");
  const lines = [];
  let line = "";

  chars.forEach(char => {
    const nextLine = line + char;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line);

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].slice(0, -1)}…`;
  }

  visibleLines.forEach((lineText, index) => {
    ctx.fillText(lineText, x, y + index * lineHeight);
  });

  return y + visibleLines.length * lineHeight;
}

function drawCoverImage(ctx, image, x, y, width, height, radius) {
  ctx.save();
  drawRoundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  ctx.restore();
}

function canvasToFile(canvas, fileName) {
  return new Promise((resolve) => {
    if (typeof File === "undefined") {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new File([blob], fileName, { type: "image/png" }));
    }, "image/png", 0.92);
  });
}

async function createIdiomCardImage({ item, rarity, setName, collectedText }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  const image = await loadImage(item.image);

  const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, "#FFF7ED");
  bg.addColorStop(0.48, "#ECFEFF");
  bg.addColorStop(1, "#F8FAFC");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 54px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText("成語大冒險", 84, 116);

  ctx.fillStyle = "#EA580C";
  drawRoundRect(ctx, 780, 72, 216, 72, 36);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 34px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${rarity} 新卡`, 888, 119);
  ctx.textAlign = "left";

  ctx.fillStyle = "#FFFFFF";
  drawRoundRect(ctx, 84, 180, 912, 1030, 46);
  ctx.fill();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.10)";
  ctx.lineWidth = 4;
  ctx.stroke();

  if (image) {
    drawCoverImage(ctx, image, 138, 246, 804, 468, 34);
  } else {
    ctx.fillStyle = "#F1F5F9";
    drawRoundRect(ctx, 138, 246, 804, 468, 34);
    ctx.fill();
    ctx.fillStyle = "#64748B";
    ctx.font = "900 150px system-ui, 'Microsoft JhengHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("成語", 540, 520);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#111827";
  ctx.font = "900 104px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(item.idiom, 540, 840);
  ctx.textAlign = "left";

  ctx.fillStyle = "#475569";
  ctx.font = "700 34px system-ui, 'Microsoft JhengHei', sans-serif";
  drawWrappedText(ctx, getShortExplanation(item), 150, 920, 780, 52, 3);

  ctx.fillStyle = "#E0F2FE";
  drawRoundRect(ctx, 150, 1090, 780, 64, 32);
  ctx.fill();
  ctx.fillStyle = "#0369A1";
  ctx.font = "800 28px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText(setName || "典藏閃卡", 188, 1132);

  ctx.fillStyle = "#64748B";
  ctx.font = "800 28px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText(collectedText || "收集成語閃卡中", 84, 1280);
  ctx.textAlign = "right";
  ctx.fillText("一起來收集", 996, 1280);
  ctx.textAlign = "left";

  return canvasToFile(canvas, `idiom-card-${item.id || "unlock"}.png`);
}

async function createMascotGrowthImage({ level, title, evolutionName, imageSrc }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  const image = await loadImage(imageSrc);

  const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, "#ECFDF5");
  bg.addColorStop(0.42, "#FFF7ED");
  bg.addColorStop(1, "#F8FAFC");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 54px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText("成語大冒險", 84, 116);

  ctx.fillStyle = "#059669";
  drawRoundRect(ctx, 730, 72, 266, 72, 36);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 34px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("小屋成長", 863, 119);
  ctx.textAlign = "left";

  ctx.fillStyle = "#FFFFFF";
  drawRoundRect(ctx, 92, 200, 896, 1000, 52);
  ctx.fill();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.10)";
  ctx.lineWidth = 4;
  ctx.stroke();

  if (image) {
    drawCoverImage(ctx, image, 270, 290, 540, 540, 72);
  }

  ctx.fillStyle = "#111827";
  ctx.font = "900 76px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`親密 Lv.${level}`, 540, 930);

  ctx.fillStyle = "#EA580C";
  ctx.font = "900 48px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText(title, 540, 1004);

  ctx.fillStyle = "#475569";
  ctx.font = "800 36px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.textAlign = "left";
  drawWrappedText(ctx, `我的 ${evolutionName} 又長大了一點，今天也一起學成語。`, 186, 1082, 708, 56, 2);
  ctx.textAlign = "left";

  ctx.fillStyle = "#64748B";
  ctx.font = "800 28px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText("每天互動，陪牠一起進步", 84, 1280);
  ctx.textAlign = "right";
  ctx.fillText("一起來養成", 996, 1280);
  ctx.textAlign = "left";

  return canvasToFile(canvas, `mascot-growth-lv-${level}.png`);
}

async function createRankUpImage({ level, rank, accuracy, xp }) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 1080, 1350);
  bg.addColorStop(0, "#FFF7ED");
  bg.addColorStop(0.45, "#FEF3C7");
  bg.addColorStop(1, "#F8FAFC");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 54px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText("成語大冒險", 84, 116);

  ctx.fillStyle = "#EA580C";
  drawRoundRect(ctx, 728, 72, 268, 72, 36);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 34px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("榮譽晉升", 862, 119);

  ctx.fillStyle = "#FFFFFF";
  drawRoundRect(ctx, 92, 205, 896, 1000, 52);
  ctx.fill();
  ctx.strokeStyle = "rgba(234, 88, 12, 0.16)";
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.font = "900 148px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillStyle = "#F59E0B";
  ctx.fillText("🏆", 540, 430);

  ctx.fillStyle = "#0F172A";
  ctx.font = "900 68px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText(`Lv.${level}`, 540, 560);

  ctx.fillStyle = "#EA580C";
  ctx.font = "900 82px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText(rank, 540, 680);

  ctx.fillStyle = "#475569";
  ctx.font = "800 36px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText("我在關卡挑戰中成功晉升！", 540, 780);

  ctx.fillStyle = "#FEF3C7";
  drawRoundRect(ctx, 210, 850, 660, 112, 34);
  ctx.fill();
  ctx.fillStyle = "#92400E";
  ctx.font = "900 34px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.fillText(`本次正確率 ${accuracy}%  ·  +${xp} XP`, 540, 918);

  ctx.fillStyle = "#64748B";
  ctx.font = "800 28px system-ui, 'Microsoft JhengHei', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("用闖關、卡片與小屋養成學成語", 84, 1280);
  ctx.textAlign = "right";
  ctx.fillText("一起來挑戰", 996, 1280);
  ctx.textAlign = "left";

  return canvasToFile(canvas, `rank-up-lv-${level}.png`);
}

async function shareAchievement({ title, text, file, dialogTitle }) {
  let canShareFile = false;
  try {
    canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));
  } catch (error) {
    canShareFile = false;
  }

  if (canShareFile) {
    await navigator.share({
      title,
      text,
      files: [file]
    });
    return "image";
  }

  const combinedText = `${text}\n${getShareUrl()}`;

  const NativeShare = getNativeShare();
  if (NativeShare?.share) {
    await NativeShare.share({
      title,
      text: combinedText,
      dialogTitle
    });
    return "native-text";
  }

  if (navigator.share) {
    await navigator.share({
      title,
      text: combinedText
    });
    return "web-text";
  }

  const copyText = combinedText;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(copyText);
    return "clipboard";
  }

  window.prompt("複製分享內容", copyText);
  return "prompt";
}

export async function shareIdiomCardUnlock({ item, rarity, setName, collectedText }) {
  const shortExp = getShortExplanation(item);
  const text = `我在成語大冒險解鎖了 ${rarity} 成語卡「${item.idiom}」！${shortExp ? `\n${shortExp}` : ""}`;
  const file = await createIdiomCardImage({ item, rarity, setName, collectedText });
  return shareAchievement({
    title: `我解鎖了「${item.idiom}」`,
    text,
    file,
    dialogTitle: "分享新成語卡"
  });
}

export async function shareMascotGrowth({ level, title, evolutionName, imageSrc }) {
  const text = `我的小書蟲親密度升到 Lv.${level}「${title}」！一起在成語大冒險學成語、養小屋。`;
  const file = await createMascotGrowthImage({ level, title, evolutionName, imageSrc });
  return shareAchievement({
    title: `小書蟲親密 Lv.${level}`,
    text,
    file,
    dialogTitle: "分享吉祥物成長"
  });
}

export async function shareRankUp({ level, rank, accuracy, xp }) {
  const text = `我在成語大冒險成功晉升為 ${rank} (Lv.${level})！本次挑戰正確率 ${accuracy}%，獲得 +${xp} XP。`;
  const file = await createRankUpImage({ level, rank, accuracy, xp });
  return shareAchievement({
    title: `我晉升為 ${rank}`,
    text,
    file,
    dialogTitle: "分享晉升成果"
  });
}
