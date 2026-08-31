import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

/**
 * AI 悬浮助手窗口的定位管理：贴边停靠、拖拽换侧、位置持久化。
 *
 * 与聊天逻辑无关，仅负责徽标/面板"在哪显示"与"如何拖动"；展开状态与
 * 会话行为由调用方通过回调接入。
 */
export function useWidgetWindow(options: {
  /** 点击徽标（未发生拖拽）时触发 */
  onBadgeClick: () => void;
  /** 点击贴边拉手时触发 */
  onTabActivate: () => void;
}) {
  const STORAGE_KEY = 'ypbin_ai_assistant_widget_pos';
  const WIDGET_WIDTH = 124;
  const WIDGET_HEIGHT = 38;
  const PANEL_HEIGHT = 530;
  const MARGIN = 16;

  const open = ref(false);
  const isDocked = ref(false);
  const isDragging = ref(false);
  const isHovering = ref(false);

  interface PositionState {
    side: 'left' | 'right';
    top: number;
    docked: boolean;
  }

  const pos = reactive<PositionState>({
    side: 'right',
    top: window.innerHeight - 100,
    docked: false,
  });

  let dragStartX = 0;
  let dragStartY = 0;
  let initialTop = 0;
  let hasMoved = false;

  function loadSavedPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PositionState>;
        if (parsed.side === 'left' || parsed.side === 'right') {
          pos.side = parsed.side;
        }
        if (typeof parsed.top === 'number') {
          const maxTop = window.innerHeight - WIDGET_HEIGHT - MARGIN;
          pos.top = Math.max(MARGIN + 48, Math.min(maxTop, parsed.top));
        }
        if (typeof parsed.docked === 'boolean') {
          pos.docked = parsed.docked;
          isDocked.value = parsed.docked;
        }
      } else {
        pos.top = window.innerHeight - 100;
        pos.side = 'right';
      }
    } catch {
      pos.top = window.innerHeight - 100;
      pos.side = 'right';
    }
  }

  function savePosition() {
    try {
      pos.docked = isDocked.value;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // 忽略存储异常
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.ai-badge-dock-btn')) return;

    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialTop = pos.top;
    hasMoved = false;

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function handlePointerMove(e: PointerEvent) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    if (!hasMoved && Math.hypot(dx, dy) > 4) {
      hasMoved = true;
      isDragging.value = true;
      isDocked.value = false;
    }

    if (isDragging.value) {
      const nextTop = initialTop + dy;
      const maxTop = window.innerHeight - WIDGET_HEIGHT - MARGIN;
      pos.top = Math.max(MARGIN + 48, Math.min(maxTop, nextTop));

      pos.side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
    }
  }

  function handlePointerUp() {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);

    if (isDragging.value) {
      isDragging.value = false;
      savePosition();
    } else {
      options.onBadgeClick();
    }
  }

  function handleWindowResize() {
    const maxTop = window.innerHeight - WIDGET_HEIGHT - MARGIN;
    if (pos.top > maxTop) {
      pos.top = Math.max(MARGIN + 48, maxTop);
    }
  }

  onMounted(() => {
    loadSavedPosition();
    window.addEventListener('resize', handleWindowResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleWindowResize);
  });

  /** 贴边收起与展开 */
  function toggleDock(e?: Event) {
    if (e) {
      e.stopPropagation();
    }
    isDocked.value = !isDocked.value;
    if (isDocked.value) {
      open.value = false;
    }
    savePosition();
  }

  /** 点击贴边拉手：复位停靠态并通知调用方激活面板 */
  function handleTabClick() {
    isDocked.value = false;
    open.value = true;
    savePosition();
    options.onTabActivate();
  }

  const widgetStyle = computed(() => {
    const top = `${pos.top}px`;
    if (pos.side === 'left') {
      return { left: `${MARGIN}px`, top };
    }
    return { right: `${MARGIN}px`, top };
  });

  const tabStyle = computed(() => {
    const top = `${pos.top}px`;
    if (pos.side === 'left') {
      return { left: '0px', top };
    }
    return { right: '0px', top };
  });

  const panelStyle = computed(() => {
    let top = pos.top + WIDGET_HEIGHT - PANEL_HEIGHT;
    if (top < MARGIN + 48) {
      top = MARGIN + 48;
    }
    if (top + PANEL_HEIGHT > window.innerHeight - MARGIN) {
      top = window.innerHeight - PANEL_HEIGHT - MARGIN;
    }

    if (pos.side === 'left') {
      return {
        left: `${MARGIN + WIDGET_WIDTH + 10}px`,
        top: `${top}px`,
      };
    }
    return {
      right: `${MARGIN + WIDGET_WIDTH + 10}px`,
      top: `${top}px`,
    };
  });

  return {
    handlePointerDown,
    handleTabClick,
    isDocked,
    isDragging,
    isHovering,
    open,
    panelStyle,
    pos,
    tabStyle,
    toggleDock,
    widgetStyle,
  };
}
