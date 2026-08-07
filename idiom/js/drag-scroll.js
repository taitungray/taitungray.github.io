export function enableDragScroll(selectorOrElements) {
  let containers;
  if (typeof selectorOrElements === "string") {
    containers = document.querySelectorAll(selectorOrElements);
  } else if (selectorOrElements instanceof NodeList || Array.isArray(selectorOrElements)) {
    containers = selectorOrElements;
  } else {
    containers = [selectorOrElements];
  }

  containers.forEach(container => {
    if (!container || container.dataset.dragScrollEnabled) return;
    
    container.dataset.dragScrollEnabled = "true";
    container.classList.add("drag-scrollable");

    let isDown = false;
    let startX;
    let startY;
    let scrollLeft;
    let scrollTop;
    let isDragging = false;
    const DRAG_THRESHOLD = 5; // 移動超過 5px 判定為拖曳

    const onPointerDown = (e) => {
      // 避免與其他原本需要預設行為的元素衝突 (例如輸入框)
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      
      // 如果點擊的是按鈕或連結，只記錄不阻止預設，等到判定是 drag 才會 stop
      isDown = true;
      isDragging = false;
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY - container.offsetTop;
      scrollLeft = container.scrollLeft;
      scrollTop = container.scrollTop;
    };

    const onPointerMove = (e) => {
      if (!isDown) return;
      
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = x - startX;
      const walkY = y - startY;

      // 如果移動超過閾值，判定為正在拖曳
      if (!isDragging && (Math.abs(walkX) > DRAG_THRESHOLD || Math.abs(walkY) > DRAG_THRESHOLD)) {
        isDragging = true;
        container.classList.add("is-dragging");
      }

      if (isDragging) {
        // 阻止預設行為避免拖曳選取文字或觸發其他預設事件
        e.preventDefault(); 
        container.scrollLeft = scrollLeft - walkX;
        container.scrollTop = scrollTop - walkY;
      }
    };

    const onPointerUp = (e) => {
      if (!isDown) return;
      isDown = false;
      // 延遲移除 is-dragging class，確保 click 事件在 capture 階段時還讀得到
      setTimeout(() => {
        container.classList.remove("is-dragging");
      }, 0);
    };

    const onPointerLeave = (e) => {
      isDown = false;
      container.classList.remove("is-dragging");
    };

    // 使用捕獲階段攔截點擊事件，如果在拖曳，就不讓點擊觸發
    const onClick = (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);
    container.addEventListener("pointerleave", onPointerLeave);
    container.addEventListener("click", onClick, true); // capture = true
  });
}
