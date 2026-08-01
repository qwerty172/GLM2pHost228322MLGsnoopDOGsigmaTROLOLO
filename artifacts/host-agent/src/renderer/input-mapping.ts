import type { InputEvent } from "../shared/messages";

export function parseDcInputEvent(raw: Record<string, unknown>): InputEvent | null {
  const kind = raw["kind"];
  if (kind === "mousemove") {
    if (typeof raw["x"] !== "number" || typeof raw["y"] !== "number") return null;
    if (!Number.isFinite(raw["x"]) || !Number.isFinite(raw["y"])) return null;
    const mode = raw["mode"];
    if (mode !== undefined && mode !== "absolute" && mode !== "relative") return null;
    return {
      kind: "mousemove",
      x: raw["x"],
      y: raw["y"],
      ...(mode === "relative" || mode === "absolute" ? { mode } : {}),
    };
  }
  if (kind === "mousedown" || kind === "mouseup") {
    if (raw["button"] !== "left" && raw["button"] !== "right" && raw["button"] !== "middle") {
      return null;
    }
    return { kind, button: raw["button"] };
  }
  if (kind === "wheel") {
    if (typeof raw["deltaY"] !== "number" || !Number.isFinite(raw["deltaY"])) return null;
    return { kind: "wheel", deltaY: raw["deltaY"] };
  }
  if (kind === "keydown" || kind === "keyup") {
    if (typeof raw["code"] !== "string" || typeof raw["key"] !== "string") return null;
    if (raw["code"].length > 64 || raw["key"].length > 64) return null;
    return { kind, code: raw["code"], key: raw["key"] };
  }
  return null;
}

function mapPlayerInput(raw: Record<string, unknown>): InputEvent | null {
  if (raw["type"] !== "input") return null;
  const kind = raw["kind"];
  const action = raw["action"];
  if (kind === "key" && (action === "down" || action === "up")) {
    const code = String(raw["code"] ?? raw["key"] ?? "");
    const key = String(raw["key"] ?? raw["code"] ?? "");
    if (!code || code.length > 64) return null;
    return action === "down"
      ? { kind: "keydown", code, key }
      : { kind: "keyup", code, key };
  }
  if (kind === "mouse") {
    const mode = raw["mode"] === "relative" ? "relative" : "absolute";
    if (action === "move") {
      if (mode === "relative") {
        return {
          kind: "mousemove",
          x: Number(raw["movementX"] ?? 0),
          y: Number(raw["movementY"] ?? 0),
          mode: "relative",
        };
      }
      // Prefer normalized absolute coords (x/y in 0..1) when present.
      if (typeof raw["x"] === "number" && typeof raw["y"] === "number") {
        return {
          kind: "mousemove",
          x: raw["x"],
          y: raw["y"],
          mode: "absolute",
        };
      }
      return {
        kind: "mousemove",
        x: Number(raw["x"] ?? 0.5),
        y: Number(raw["y"] ?? 0.5),
        mode: "absolute",
      };
    }
    if (action === "down" || action === "up") {
      const buttonIdx = Number(raw["button"] ?? 0);
      const button: "left" | "right" | "middle" =
        buttonIdx === 2 ? "right" : buttonIdx === 1 ? "middle" : "left";
      return action === "down"
        ? { kind: "mousedown", button }
        : { kind: "mouseup", button };
    }
  }
  if (kind === "wheel") {
    const deltaY = Number(raw["deltaY"] ?? 0);
    if (!Number.isFinite(deltaY)) return null;
    return { kind: "wheel", deltaY };
  }
  return null;
}

export function injectPlayerInput(raw: Record<string, unknown>): void {
  const fallback = raw["event"] as InputEvent | undefined;
  if (fallback) {
    window.agent.injectInput(fallback);
    return;
  }
  if (raw["kind"] === "mouse" && raw["action"] === "down") {
    const x = Number(raw["x"] ?? 0.5);
    const y = Number(raw["y"] ?? 0.5);
    window.agent.injectInput({ kind: "mousemove", x, y, mode: "absolute" });
  }
  const event = mapPlayerInput(raw);
  if (event) window.agent.injectInput(event);
}