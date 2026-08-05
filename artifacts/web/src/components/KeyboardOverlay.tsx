import { useCallback, useEffect, useRef, useState } from "react";

// ── Key catalogue ─────────────────────────────────────────────────────────────
export interface KeyEntry { label: string; key: string; code: string }

export const KEY_CATALOGUE: KeyEntry[] = [
  { label: "W", key: "w", code: "KeyW" },
  { label: "A", key: "a", code: "KeyA" },
  { label: "S", key: "s", code: "KeyS" },
  { label: "D", key: "d", code: "KeyD" },
  { label: "Q", key: "q", code: "KeyQ" },
  { label: "E", key: "e", code: "KeyE" },
  { label: "R", key: "r", code: "KeyR" },
  { label: "F", key: "f", code: "KeyF" },
  { label: "G", key: "g", code: "KeyG" },
  { label: "C", key: "c", code: "KeyC" },
  { label: "V", key: "v", code: "KeyV" },
  { label: "Z", key: "z", code: "KeyZ" },
  { label: "X", key: "x", code: "KeyX" },
  { label: "T", key: "t", code: "KeyT" },
  { label: "H", key: "h", code: "KeyH" },
  { label: "B", key: "b", code: "KeyB" },
  { label: "1", key: "1", code: "Digit1" },
  { label: "2", key: "2", code: "Digit2" },
  { label: "3", key: "3", code: "Digit3" },
  { label: "4", key: "4", code: "Digit4" },
  { label: "5", key: "5", code: "Digit5" },
  { label: "Space", key: " ", code: "Space" },
  { label: "Shift", key: "Shift", code: "ShiftLeft" },
  { label: "Ctrl", key: "Control", code: "ControlLeft" },
  { label: "Alt", key: "Alt", code: "AltLeft" },
  { label: "Tab", key: "Tab", code: "Tab" },
  { label: "Esc", key: "Escape", code: "Escape" },
  { label: "Enter", key: "Enter", code: "Enter" },
  { label: "←", key: "ArrowLeft", code: "ArrowLeft" },
  { label: "→", key: "ArrowRight", code: "ArrowRight" },
  { label: "↑", key: "ArrowUp", code: "ArrowUp" },
  { label: "↓", key: "ArrowDown", code: "ArrowDown" },
  { label: "F1", key: "F1", code: "F1" },
  { label: "F2", key: "F2", code: "F2" },
  { label: "F3", key: "F3", code: "F3" },
  { label: "F4", key: "F4", code: "F4" },
];

// ── Button model ──────────────────────────────────────────────────────────────
export interface KeyButton {
  id: string;
  label: string;
  key: string;
  code: string;
  altLabel?: string;   // shown small below — hint for double-tap action
  altKey?: string;
  altCode?: string;
  size: number;        // diameter in px
  pos: { x: number; y: number }; // % of viewport (vw/vh)
}

// ── Presets ───────────────────────────────────────────────────────────────────
let _id = 0;
const bid = () => String(++_id);

export type PresetName = "wasd" | "arrows" | "custom";

export const KEYBOARD_PRESETS: Record<PresetName, { label: string; buttons: KeyButton[] }> = {
  wasd: {
    label: "WASD",
    buttons: [
      { id: bid(), label: "W", key: "w", code: "KeyW", size: 52, pos: { x: 9, y: 30 } },
      { id: bid(), label: "A", key: "a", code: "KeyA", size: 52, pos: { x: 2, y: 50 } },
      { id: bid(), label: "S", key: "s", code: "KeyS", size: 52, pos: { x: 9, y: 50 } },
      { id: bid(), label: "D", key: "d", code: "KeyD", size: 52, pos: { x: 16, y: 50 } },
      {
        id: bid(), label: "⇧", key: "Shift", code: "ShiftLeft",
        altLabel: "Ctrl", altKey: "Control", altCode: "ControlLeft",
        size: 44, pos: { x: 2, y: 70 },
      },
      { id: bid(), label: "Space", key: " ", code: "Space", size: 56, pos: { x: 10, y: 72 } },
      {
        id: bid(), label: "E", key: "e", code: "KeyE",
        altLabel: "F", altKey: "f", altCode: "KeyF",
        size: 52, pos: { x: 78, y: 42 },
      },
      {
        id: bid(), label: "R", key: "r", code: "KeyR",
        altLabel: "G", altKey: "g", altCode: "KeyG",
        size: 44, pos: { x: 87, y: 28 },
      },
      { id: bid(), label: "Tab", key: "Tab", code: "Tab", size: 40, pos: { x: 75, y: 12 } },
      { id: bid(), label: "Esc", key: "Escape", code: "Escape", size: 40, pos: { x: 88, y: 12 } },
    ],
  },
  arrows: {
    label: "Стрелки",
    buttons: [
      { id: bid(), label: "↑", key: "ArrowUp", code: "ArrowUp", size: 52, pos: { x: 9, y: 32 } },
      { id: bid(), label: "←", key: "ArrowLeft", code: "ArrowLeft", size: 52, pos: { x: 2, y: 52 } },
      { id: bid(), label: "↓", key: "ArrowDown", code: "ArrowDown", size: 52, pos: { x: 9, y: 52 } },
      { id: bid(), label: "→", key: "ArrowRight", code: "ArrowRight", size: 52, pos: { x: 16, y: 52 } },
      { id: bid(), label: "Space", key: " ", code: "Space", size: 56, pos: { x: 10, y: 74 } },
      {
        id: bid(), label: "Z", key: "z", code: "KeyZ",
        altLabel: "X", altKey: "x", altCode: "KeyX",
        size: 52, pos: { x: 78, y: 55 },
      },
      { id: bid(), label: "Enter", key: "Enter", code: "Enter", size: 52, pos: { x: 88, y: 55 } },
      { id: bid(), label: "Esc", key: "Escape", code: "Escape", size: 40, pos: { x: 88, y: 12 } },
    ],
  },
  custom: {
    label: "Своя",
    buttons: [],
  },
};

const STORAGE_KEY = "keyboardOverlayLayout_v1";
export const KEYBOARD_OVERLAY_STORAGE_KEY = STORAGE_KEY;
export const KEYBOARD_DOUBLE_TAP_MS = 320;

/** Resolve primary vs double-tap alt key for overlay buttons. */
export function resolveKeyTap(
  btn: Pick<KeyButton, "key" | "code" | "altKey" | "altCode">,
  lastTapMs: number,
  nowMs: number,
  doubleTapMs = KEYBOARD_DOUBLE_TAP_MS,
): { key: string; code: string; isDouble: boolean } {
  const isDouble = !!btn.altKey && nowMs - lastTapMs < doubleTapMs;
  if (isDouble) {
    return { key: btn.altKey!, code: btn.altCode ?? btn.altKey!, isDouble: true };
  }
  return { key: btn.key, code: btn.code, isDouble: false };
}

/** Clamp overlay control position to viewport bounds (vw/vh %). */
export function clampOverlayPos(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(92, x)),
    y: Math.max(0, Math.min(88, y)),
  };
}

export function isWideKeyButton(btn: Pick<KeyButton, "size" | "label">): boolean {
  return btn.size >= 56 && btn.label.length > 2;
}

export function loadKeyboardOverlayLayout(): { preset: PresetName; buttons: KeyButton[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { preset: PresetName; buttons: KeyButton[] };
  } catch { /* ignore */ }
  return { preset: "wasd", buttons: structuredClone(KEYBOARD_PRESETS.wasd.buttons) };
}

export function saveKeyboardOverlayLayout(preset: PresetName, buttons: KeyButton[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset, buttons })); } catch { /* ignore */ }
}

function loadLayout(): { preset: PresetName; buttons: KeyButton[] } {
  return loadKeyboardOverlayLayout();
}

function saveLayout(preset: PresetName, buttons: KeyButton[]) {
  saveKeyboardOverlayLayout(preset, buttons);
}

// ── Individual draggable key button ───────────────────────────────────────────
const DOUBLE_TAP_MS = KEYBOARD_DOUBLE_TAP_MS;

function DraggableKeyButton({
  btn,
  editMode,
  onKeyInput,
  onUpdatePos,
  onTapEdit,
}: {
  btn: KeyButton;
  editMode: boolean;
  onKeyInput: (key: string, code: string, action: "down" | "up") => void;
  onUpdatePos: (id: string, pos: { x: number; y: number }) => void;
  onTapEdit: (btn: KeyButton) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startPx: number; startPy: number; ox: number; oy: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const activeKeyRef = useRef<{ key: string; code: string } | null>(null);
  const [pressed, setPressed] = useState(false);
  const [doubleTapped, setDoubleTapped] = useState(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    divRef.current?.setPointerCapture(e.pointerId);

    if (editMode) {
      dragRef.current = { startPx: e.clientX, startPy: e.clientY, ox: btn.pos.x, oy: btn.pos.y };
      return;
    }

    const now = Date.now();
    const tap = resolveKeyTap(btn, lastTapRef.current, now, DOUBLE_TAP_MS);
    lastTapRef.current = now;

    const k = { key: tap.key, code: tap.code };

    activeKeyRef.current = k;
    setPressed(true);
    setDoubleTapped(tap.isDouble);
    onKeyInput(k.key, k.code, "down");
  }, [editMode, btn, onKeyInput]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!editMode || !dragRef.current) return;
    e.stopPropagation();
    const dx = ((e.clientX - dragRef.current.startPx) / window.innerWidth) * 100;
    const dy = ((e.clientY - dragRef.current.startPy) / window.innerHeight) * 100;
    onUpdatePos(btn.id, clampOverlayPos(
      dragRef.current.ox + dx,
      dragRef.current.oy + dy,
    ));
  }, [editMode, btn.id, onUpdatePos]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();

    if (editMode) {
      // If barely moved → it was a tap in edit mode → open editor
      if (dragRef.current) {
        const moved = Math.abs(e.clientX - dragRef.current.startPx) + Math.abs(e.clientY - dragRef.current.startPy);
        if (moved < 8) onTapEdit(btn);
      }
      dragRef.current = null;
      return;
    }

    if (activeKeyRef.current) {
      onKeyInput(activeKeyRef.current.key, activeKeyRef.current.code, "up");
      activeKeyRef.current = null;
    }
    setPressed(false);
    setDoubleTapped(false);
  }, [editMode, btn, onKeyInput, onTapEdit]);

  const sz = btn.size;
  const isWide = isWideKeyButton(btn);

  return (
    <div
      ref={divRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "absolute",
        left: `${btn.pos.x}vw`,
        top: `${btn.pos.y}vh`,
        width: isWide ? sz * 1.7 : sz,
        height: sz,
        borderRadius: isWide ? sz * 0.35 : "50%",
        background: pressed
          ? (doubleTapped ? "rgba(234,179,8,0.75)" : "rgba(14,165,233,0.75)")
          : "rgba(255,255,255,0.10)",
        border: editMode
          ? "2px dashed rgba(14,165,233,0.75)"
          : `2px solid ${pressed ? (doubleTapped ? "rgba(234,179,8,0.9)" : "rgba(14,165,233,0.9)") : "rgba(255,255,255,0.28)"}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: editMode ? "grab" : "default",
        touchAction: "none",
        userSelect: "none",
        transition: "background 0.05s, border 0.05s",
        backdropFilter: "blur(4px)",
      }}
    >
      <span style={{ color: "#fff", fontWeight: 700, fontSize: sz < 44 ? 11 : sz < 56 ? 13 : 15, lineHeight: 1 }}>
        {btn.label}
      </span>
      {btn.altLabel && (
        <span style={{ color: "rgba(234,179,8,0.85)", fontSize: 9, lineHeight: 1, marginTop: 2 }}>
          ×2 {btn.altLabel}
        </span>
      )}
      {editMode && (
        <span style={{ position: "absolute", top: -8, right: -8, background: "#0ea5e9", borderRadius: "50%", width: 18, height: 18, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          ✎
        </span>
      )}
    </div>
  );
}

// ── Bottom editor panel ───────────────────────────────────────────────────────
function KeyEditorPanel({
  btn,
  onSave,
  onDelete,
  onClose,
}: {
  btn: KeyButton;
  onSave: (updated: KeyButton) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(btn.label);
  const [primaryKey, setPrimaryKey] = useState<KeyEntry>(() =>
    KEY_CATALOGUE.find((k) => k.code === btn.code) ?? { label: btn.label, key: btn.key, code: btn.code },
  );
  const [altKey, setAltKey] = useState<KeyEntry | null>(() =>
    btn.altKey ? (KEY_CATALOGUE.find((k) => k.code === btn.altCode) ?? { label: btn.altLabel ?? "", key: btn.altKey, code: btn.altCode ?? btn.altKey }) : null,
  );
  const [size, setSize] = useState(btn.size);
  const [tab, setTab] = useState<"primary" | "alt">("primary");

  const handleSave = () => {
    onSave({
      ...btn,
      label: label || primaryKey.label,
      key: primaryKey.key,
      code: primaryKey.code,
      altLabel: altKey?.label,
      altKey: altKey?.key,
      altCode: altKey?.code,
      size,
    });
    onClose();
  };

  const pickKey = (entry: KeyEntry) => {
    if (tab === "primary") {
      setPrimaryKey(entry);
      if (!label || label === primaryKey.label) setLabel(entry.label);
    } else {
      setAltKey(entry);
    }
  };

  return (
    <div
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(15,23,42,0.97)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "16px 16px 0 0",
        padding: "16px 16px 32px",
        maxHeight: "60vh",
        overflowY: "auto",
        backdropFilter: "blur(12px)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>Настройка кнопки</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { onDelete(btn.id); onClose(); }}
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 8, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}
          >
            Удалить
          </button>
          <button
            onClick={onClose}
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Label */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: "#64748b", fontSize: 11, display: "block", marginBottom: 4 }}>Подпись</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "7px 10px", color: "#f1f5f9", fontSize: 14, outline: "none" }}
          placeholder="Текст на кнопке"
        />
      </div>

      {/* Size */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ color: "#64748b", fontSize: 11, display: "block", marginBottom: 6 }}>Размер</label>
        <div style={{ display: "flex", gap: 8 }}>
          {([44, 56, 72] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              style={{
                flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: size === s ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.07)",
                border: size === s ? "1px solid rgba(14,165,233,0.7)" : "1px solid rgba(255,255,255,0.12)",
                color: size === s ? "#38bdf8" : "#94a3b8",
              }}
            >
              {s === 44 ? "S" : s === 56 ? "M" : "L"}
            </button>
          ))}
        </div>
      </div>

      {/* Key tab selector */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {(["primary", "alt"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: tab === t ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.06)",
                border: tab === t ? "1px solid rgba(14,165,233,0.6)" : "1px solid rgba(255,255,255,0.12)",
                color: tab === t ? "#38bdf8" : "#64748b",
              }}
            >
              {t === "primary" ? `Клавиша: ${primaryKey.label}` : `×2 Клавиша: ${altKey?.label ?? "нет"}`}
            </button>
          ))}
          {tab === "alt" && altKey && (
            <button
              onClick={() => setAltKey(null)}
              style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", color: "#f87171" }}
            >
              убрать
            </button>
          )}
        </div>

        {/* Key picker grid */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {KEY_CATALOGUE.map((entry) => {
            const isSelected = tab === "primary" ? entry.code === primaryKey.code : entry.code === altKey?.code;
            return (
              <button
                key={entry.code}
                onClick={() => pickKey(entry)}
                style={{
                  minWidth: 38, height: 38, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: isSelected ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.07)",
                  border: isSelected ? "1px solid rgba(14,165,233,0.8)" : "1px solid rgba(255,255,255,0.12)",
                  color: isSelected ? "#38bdf8" : "#e2e8f0",
                  padding: "0 6px",
                }}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        style={{ width: "100%", padding: "10px 0", marginTop: 14, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", background: "rgba(14,165,233,0.85)", border: "none", color: "#fff" }}
      >
        Сохранить
      </button>
    </div>
  );
}

// ── Preset picker ─────────────────────────────────────────────────────────────
function PresetPicker({
  current,
  onPick,
  onClose,
}: {
  current: PresetName;
  onPick: (p: PresetName) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed", top: 56, left: "50%", transform: "translateX(-50%)",
        zIndex: 101, background: "rgba(15,23,42,0.97)",
        border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12,
        padding: 10, display: "flex", gap: 8,
        backdropFilter: "blur(12px)",
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {(Object.entries(KEYBOARD_PRESETS) as [PresetName, { label: string }][]).map(([key, { label }]) => (
        <button
          key={key}
          onClick={() => { onPick(key); onClose(); }}
          style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: current === key ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.07)",
            border: current === key ? "1px solid rgba(14,165,233,0.7)" : "1px solid rgba(255,255,255,0.12)",
            color: current === key ? "#38bdf8" : "#94a3b8",
          }}
        >
          {label}
        </button>
      ))}
      <button
        onClick={onClose}
        style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b" }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export interface KeyboardOverlayProps {
  onKeyInput: (key: string, code: string, action: "down" | "up") => void;
  editMode?: boolean;
}

export function KeyboardOverlay({ onKeyInput, editMode = false }: KeyboardOverlayProps) {
  const [{ preset, buttons }, setLayout] = useState<{ preset: PresetName; buttons: KeyButton[] }>(loadLayout);
  const [editingBtn, setEditingBtn] = useState<KeyButton | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  // Sync to localStorage whenever layout changes
  useEffect(() => {
    saveLayout(preset, buttons);
  }, [preset, buttons]);

  const updatePos = useCallback((id: string, pos: { x: number; y: number }) => {
    setLayout((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b) => b.id === id ? { ...b, pos } : b),
    }));
  }, []);

  const saveBtn = useCallback((updated: KeyButton) => {
    setLayout((prev) => ({
      ...prev,
      buttons: prev.buttons.map((b) => b.id === updated.id ? updated : b),
    }));
  }, []);

  const deleteBtn = useCallback((id: string) => {
    setLayout((prev) => ({ ...prev, buttons: prev.buttons.filter((b) => b.id !== id) }));
  }, []);

  const addBtn = useCallback(() => {
    const newBtn: KeyButton = {
      id: String(Date.now()),
      label: "?",
      key: "e",
      code: "KeyE",
      size: 52,
      pos: { x: 50, y: 50 },
    };
    setLayout((prev) => ({ ...prev, buttons: [...prev.buttons, newBtn] }));
    setEditingBtn(newBtn);
  }, []);

  const applyPreset = useCallback((p: PresetName) => {
    const newBtns = structuredClone(KEYBOARD_PRESETS[p].buttons).map((b) => ({
      ...b,
      id: String(Date.now()) + Math.random(),
    }));
    setLayout({ preset: p, buttons: newBtns });
  }, []);

  return (
    <>
      {/* Overlay layer */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 21, opacity: editMode ? 0.95 : 0.7 }}>
        {buttons.map((btn) => (
          <DraggableKeyButton
            key={btn.id}
            btn={btn}
            editMode={editMode}
            onKeyInput={onKeyInput}
            onUpdatePos={updatePos}
            onTapEdit={setEditingBtn}
          />
        ))}

        {/* Edit mode toolbar */}
        {editMode && (
          <div
            style={{
              position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
              display: "flex", gap: 8, pointerEvents: "auto",
            }}
          >
            <button
              onClick={() => setShowPresets((v) => !v)}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: "rgba(14,165,233,0.2)", border: "1px solid rgba(14,165,233,0.5)", color: "#38bdf8",
              }}
            >
              Пресеты
            </button>
            <button
              onClick={addBtn}
              style={{
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.5)", color: "#4ade80",
              }}
            >
              + Клавиша
            </button>
          </div>
        )}
      </div>

      {/* Preset picker popup */}
      {editMode && showPresets && (
        <PresetPicker current={preset} onPick={applyPreset} onClose={() => setShowPresets(false)} />
      )}

      {/* Key editor panel */}
      {editingBtn && (
        <KeyEditorPanel
          btn={editingBtn}
          onSave={saveBtn}
          onDelete={deleteBtn}
          onClose={() => setEditingBtn(null)}
        />
      )}
    </>
  );
}
