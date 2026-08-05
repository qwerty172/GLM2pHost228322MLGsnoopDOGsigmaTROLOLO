import { useCallback, useEffect, useRef, useState } from "react";

// ─── Button indices (Web Gamepad / XInput standard) ──────────────────────────
export const TOUCH_BTN_A = 0;
export const TOUCH_BTN_B = 1;
export const TOUCH_BTN_X = 2;
export const TOUCH_BTN_Y = 3;
export const TOUCH_BTN_LB = 4;
export const TOUCH_BTN_RB = 5;
export const TOUCH_BTN_LT = 6;
export const TOUCH_BTN_RT = 7;
export const TOUCH_BTN_SELECT = 8;
export const TOUCH_BTN_START = 9;
export const TOUCH_TOTAL_BUTTONS = 10;
export const TOUCH_TOTAL_AXES = 4;

const BTN_A = TOUCH_BTN_A;
const BTN_B = TOUCH_BTN_B;
const BTN_X = TOUCH_BTN_X;
const BTN_Y = TOUCH_BTN_Y;
const BTN_LB = TOUCH_BTN_LB;
const BTN_RB = TOUCH_BTN_RB;
const BTN_LT = TOUCH_BTN_LT;
const BTN_RT = TOUCH_BTN_RT;
const BTN_SELECT = TOUCH_BTN_SELECT;
const BTN_START = TOUCH_BTN_START;
const TOTAL_BUTTONS = TOUCH_TOTAL_BUTTONS;
const TOTAL_AXES = TOUCH_TOTAL_AXES;

// ─── Per-control layout ───────────────────────────────────────────────────────
// Each control has an absolute position in % of viewport (vw/vh).
export const TOUCH_LAYOUT_STORAGE_KEY = "touchLayout";

interface Pos { x: number; y: number }

interface LayoutState {
  stickLeft: Pos;
  stickRight: Pos;
  btnA: Pos;
  btnB: Pos;
  btnX: Pos;
  btnY: Pos;
  btnLB: Pos;
  btnRB: Pos;
  btnLT: Pos;
  btnRT: Pos;
  btnStart: Pos;
  btnSelect: Pos;
}

export const DEFAULT_TOUCH_LAYOUT: LayoutState = {
  stickLeft: { x: 5, y: 58 },
  stickRight: { x: 75, y: 58 },
  btnA:      { x: 82, y: 75 },
  btnB:      { x: 88, y: 68 },
  btnX:      { x: 76, y: 68 },
  btnY:      { x: 82, y: 61 },
  btnLT:     { x: 3,  y: 8  },
  btnLB:     { x: 3,  y: 16 },
  btnRT:     { x: 82, y: 8  },
  btnRB:     { x: 82, y: 16 },
  btnSelect: { x: 42, y: 88 },
  btnStart:  { x: 52, y: 88 },
};

export function loadTouchLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(TOUCH_LAYOUT_STORAGE_KEY);
    if (raw) return { ...DEFAULT_TOUCH_LAYOUT, ...(JSON.parse(raw) as Partial<LayoutState>) };
  } catch { /* ignore */ }
  return { ...DEFAULT_TOUCH_LAYOUT };
}

export function saveTouchLayout(layout: LayoutState): void {
  try { localStorage.setItem(TOUCH_LAYOUT_STORAGE_KEY, JSON.stringify(layout)); } catch { /* ignore */ }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onGamepadInput: (axes: number[], buttons: number[]) => void;
  /** When true, controls enter drag-to-reposition mode (no input sent). */
  editMode?: boolean;
}

// ─── Shared mutable gamepad state (ref-based, no re-renders) ─────────────────
type GamepadState = { axes: number[]; buttons: number[] };

// ─── Individual draggable control shell ──────────────────────────────────────
// In edit mode: pointers drag the control. In play mode: pointers are
// forwarded to the child (which handles press/move itself via its own events).
function DraggableControl({
  posKey,
  layout,
  setLayout,
  editMode,
  children,
  style,
}: {
  posKey: keyof LayoutState;
  layout: LayoutState;
  setLayout: (l: LayoutState) => void;
  editMode: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const pos = layout[posKey];
  const dragRef = useRef<{ startPx: number; startPy: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = { startPx: e.clientX, startPy: e.clientY, ox: pos.x, oy: pos.y };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!editMode || !dragRef.current) return;
    e.stopPropagation();
    const dx = ((e.clientX - dragRef.current.startPx) / window.innerWidth) * 100;
    const dy = ((e.clientY - dragRef.current.startPy) / window.innerHeight) * 100;
    const newX = Math.max(0, Math.min(92, dragRef.current.ox + dx));
    const newY = Math.max(0, Math.min(92, dragRef.current.oy + dy));
    const next = { ...layout, [posKey]: { x: newX, y: newY } };
    setLayout(next);
    saveTouchLayout(next);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!editMode) return;
    e.stopPropagation();
    dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "absolute",
        left: `${pos.x}vw`,
        top:  `${pos.y}vh`,
        touchAction: "none",
        userSelect: "none",
        // In edit mode: show drag cursor and highlight ring; suppress child events
        cursor: editMode ? "grab" : "default",
        outline: editMode ? "2px dashed rgba(14,165,233,0.7)" : "none",
        borderRadius: 12,
        pointerEvents: "auto",
        // Block child pointer events in edit mode so drag works cleanly
        ...style,
      }}
    >
      <div style={{ pointerEvents: editMode ? "none" : "auto" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Analog stick ─────────────────────────────────────────────────────────────
const STICK_RADIUS = 44;
const KNOB_R = 20;

function AnalogStick({ axisX, axisY, onChange }: {
  axisX: number;
  axisY: number;
  onChange: (x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const centerRef = useRef<{ x: number; y: number } | null>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activePointer.current !== null) return;
    e.stopPropagation();
    e.preventDefault();
    activePointer.current = e.pointerId;
    containerRef.current?.setPointerCapture(e.pointerId);
    const rect = containerRef.current!.getBoundingClientRect();
    centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current || !centerRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const dx = e.clientX - centerRef.current.x;
    const dy = e.clientY - centerRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamp = Math.min(dist, STICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamp;
    const ky = Math.sin(angle) * clamp;
    setKnobPos({ x: kx, y: ky });
    onChange(kx / STICK_RADIUS, ky / STICK_RADIUS);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    e.stopPropagation();
    activePointer.current = null;
    centerRef.current = null;
    setKnobPos({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Левый стик"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: (STICK_RADIUS + KNOB_R) * 2,
        height: (STICK_RADIUS + KNOB_R) * 2,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        border: "2px solid rgba(255,255,255,0.20)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        touchAction: "none",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: KNOB_R * 2,
          height: KNOB_R * 2,
          borderRadius: "50%",
          background: "rgba(14,165,233,0.75)",
          border: "2px solid rgba(14,165,233,0.95)",
          position: "absolute",
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          transition: activePointer.current !== null ? "none" : "transform 0.1s ease",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ─── Round touch button (face / menu) ─────────────────────────────────────────
function TouchButton({
  label,
  color,
  size = 44,
  onPressChange,
}: {
  label: string;
  color: string;
  size?: number;
  onPressChange: (pressed: boolean) => void;
}) {
  const [pressed, setPressed] = useState(false);
  const activePointer = useRef<number | null>(null);

  const down = (e: React.PointerEvent) => {
    if (activePointer.current !== null) return;
    e.stopPropagation();
    e.preventDefault();
    activePointer.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPressed(true);
    onPressChange(true);
  };

  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    e.stopPropagation();
    activePointer.current = null;
    setPressed(false);
    onPressChange(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Кнопка ${label}`}
      aria-pressed={pressed}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: pressed ? color : `${color}55`,
        border: `2px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        fontSize: size < 40 ? 11 : 14,
        color: "#fff",
        touchAction: "none",
        userSelect: "none",
        flexShrink: 0,
        transition: "background 0.05s",
      }}
    >
      {label}
    </div>
  );
}

// ─── Shoulder / trigger pill button ───────────────────────────────────────────
function ShoulderButton({ label, onPressChange }: {
  label: string;
  onPressChange: (pressed: boolean) => void;
}) {
  const [pressed, setPressed] = useState(false);
  const activePointer = useRef<number | null>(null);

  const down = (e: React.PointerEvent) => {
    if (activePointer.current !== null) return;
    e.stopPropagation();
    e.preventDefault();
    activePointer.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPressed(true);
    onPressChange(true);
  };

  const up = (e: React.PointerEvent) => {
    if (e.pointerId !== activePointer.current) return;
    e.stopPropagation();
    activePointer.current = null;
    setPressed(false);
    onPressChange(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Кнопка ${label}`}
      aria-pressed={pressed}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        minWidth: 52,
        height: 32,
        borderRadius: 8,
        background: pressed ? "rgba(148,163,184,0.55)" : "rgba(148,163,184,0.18)",
        border: "2px solid rgba(148,163,184,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        fontSize: 12,
        color: "#e2e8f0",
        touchAction: "none",
        userSelect: "none",
        padding: "0 10px",
        transition: "background 0.05s",
      }}
    >
      {label}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TouchOverlay({ onGamepadInput, editMode = false }: Props) {
  const [layout, setLayout] = useState<LayoutState>(loadTouchLayout);

  // Mutable gamepad state — updated without triggering re-renders
  const gs = useRef<GamepadState>({
    axes:    new Array(TOTAL_AXES).fill(0) as number[],
    buttons: new Array(TOTAL_BUTTONS).fill(0) as number[],
  });
  const rafRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    onGamepadInput([...gs.current.axes], [...gs.current.buttons]);
  }, [onGamepadInput]);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flush();
    });
  }, [flush]);

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  const setAxis = useCallback((idx: number, v: number) => {
    gs.current.axes[idx] = v;
    scheduleFlush();
  }, [scheduleFlush]);

  const setBtn = useCallback((idx: number, pressed: boolean) => {
    gs.current.buttons[idx] = pressed ? 1 : 0;
    scheduleFlush();
  }, [scheduleFlush]);

  const OPACITY = 0.62;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
        opacity: editMode ? 0.9 : OPACITY,
      }}
    >
      {/* Left analog stick */}
      <DraggableControl posKey="stickLeft" layout={layout} setLayout={setLayout} editMode={editMode}>
        <AnalogStick
          axisX={gs.current.axes[0] ?? 0}
          axisY={gs.current.axes[1] ?? 0}
          onChange={(x, y) => { setAxis(0, x); setAxis(1, y); }}
        />
      </DraggableControl>

      {/* Right analog stick (camera) */}
      <DraggableControl posKey="stickRight" layout={layout} setLayout={setLayout} editMode={editMode}>
        <AnalogStick
          axisX={gs.current.axes[2] ?? 0}
          axisY={gs.current.axes[3] ?? 0}
          onChange={(x, y) => { setAxis(2, x); setAxis(3, y); }}
        />
      </DraggableControl>

      {/* Face buttons — each individually draggable */}
      <DraggableControl posKey="btnY" layout={layout} setLayout={setLayout} editMode={editMode}>
        <TouchButton label="Y" color="#eab308" onPressChange={(p) => setBtn(BTN_Y, p)} />
      </DraggableControl>
      <DraggableControl posKey="btnB" layout={layout} setLayout={setLayout} editMode={editMode}>
        <TouchButton label="B" color="#ef4444" onPressChange={(p) => setBtn(BTN_B, p)} />
      </DraggableControl>
      <DraggableControl posKey="btnX" layout={layout} setLayout={setLayout} editMode={editMode}>
        <TouchButton label="X" color="#3b82f6" onPressChange={(p) => setBtn(BTN_X, p)} />
      </DraggableControl>
      <DraggableControl posKey="btnA" layout={layout} setLayout={setLayout} editMode={editMode}>
        <TouchButton label="A" color="#22c55e" onPressChange={(p) => setBtn(BTN_A, p)} />
      </DraggableControl>

      {/* Left shoulder buttons */}
      <DraggableControl posKey="btnLT" layout={layout} setLayout={setLayout} editMode={editMode}>
        <ShoulderButton label="LT" onPressChange={(p) => setBtn(BTN_LT, p)} />
      </DraggableControl>
      <DraggableControl posKey="btnLB" layout={layout} setLayout={setLayout} editMode={editMode}>
        <ShoulderButton label="LB" onPressChange={(p) => setBtn(BTN_LB, p)} />
      </DraggableControl>

      {/* Right shoulder buttons */}
      <DraggableControl posKey="btnRT" layout={layout} setLayout={setLayout} editMode={editMode}>
        <ShoulderButton label="RT" onPressChange={(p) => setBtn(BTN_RT, p)} />
      </DraggableControl>
      <DraggableControl posKey="btnRB" layout={layout} setLayout={setLayout} editMode={editMode}>
        <ShoulderButton label="RB" onPressChange={(p) => setBtn(BTN_RB, p)} />
      </DraggableControl>

      {/* Menu buttons */}
      <DraggableControl posKey="btnSelect" layout={layout} setLayout={setLayout} editMode={editMode}>
        <TouchButton label="☰" color="#64748b" size={36} onPressChange={(p) => setBtn(BTN_SELECT, p)} />
      </DraggableControl>
      <DraggableControl posKey="btnStart" layout={layout} setLayout={setLayout} editMode={editMode}>
        <TouchButton label="▶" color="#64748b" size={36} onPressChange={(p) => setBtn(BTN_START, p)} />
      </DraggableControl>
    </div>
  );
}
