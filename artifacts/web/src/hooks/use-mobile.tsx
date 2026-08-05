import * as React from "react"

export const MOBILE_BREAKPOINT = 768

/** matchMedia query for the mobile viewport (max-width 767px). */
export function buildMobileMediaQuery(): string {
  return `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
}

/** True when viewport width is below the mobile breakpoint. */
export function isMobileWidth(width: number): boolean {
  return width < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(buildMobileMediaQuery())
    const onChange = () => {
      setIsMobile(isMobileWidth(window.innerWidth))
    }
    mql.addEventListener("change", onChange)
    setIsMobile(isMobileWidth(window.innerWidth))
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
