export type PlatformEvent = {
  type: string;
  payload: Record<string, unknown>;
  at: string;
};
