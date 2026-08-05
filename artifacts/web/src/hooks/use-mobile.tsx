import * as React from "react"

export const MOBILE_BREAKPOINT = 768

/** Viewport width below MOBILE_BREAKPOINT is treated as mobile (sidebar sheet). */
export function isMobileViewport(width: number): boolean {
  return width < MOBILE_BREAKPOINT
}

export function mobileMediaQuery(): string {
  return `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(mobileMediaQuery())
    const onChange = () => {
      setIsMobile(isMobileViewport(window.innerWidth))
    }
    mql.addEventListener("change", onChange)
    setIsMobile(isMobileViewport(window.innerWidth))
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
