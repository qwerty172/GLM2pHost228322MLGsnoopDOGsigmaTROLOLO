import * as React from "react"

export const MOBILE_BREAKPOINT = 768
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function isMobileViewportWidth(width: number): boolean {
  return width < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
    const onChange = () => {
      setIsMobile(isMobileViewportWidth(window.innerWidth))
    }
    mql.addEventListener("change", onChange)
    setIsMobile(isMobileViewportWidth(window.innerWidth))
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
