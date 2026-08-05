export const HOST_LAYOUT_NAV_ITEMS = [
  { href: "/host", label: "Дашборд" },
  { href: "/host/library", label: "Моя библиотека" },
  { href: "/host/wallet", label: "Кошелёк" },
] as const;

export type HostLayoutNavHref = (typeof HOST_LAYOUT_NAV_ITEMS)[number]["href"];

export function resolveHostSiteNavActivePath(location: string): "/host" | "/host/wallet" {
  return location.startsWith("/host/wallet") ? "/host/wallet" : "/host";
}

export function isHostNavItemActive(location: string, href: string): boolean {
  return location === href;
}
