/** Dev-only automated route tour for navigation timing (see `/dev/nav-autopilot`). */

export const NAV_AUTOPILOT_STORAGE_KEY = 'fujimak_nav_autopilot_v1'

/** Round-trip tour through primary portal routes */
export const NAV_AUTOPILOT_HOPS = [
  '/dashboard',
  '/maintenance',
  '/management',
  '/history',
  '/notifications',
  '/manual',
  '/troubleshooting',
  '/parts',
  '/dashboard',
] as const

export const NAV_AUTOPILOT_DWELL_MS = 950

export type NavAutopilotPersistedState =
  | { phase: 'going_to'; targetIndex: number }
  | { phase: 'dwell'; targetIndex: number }
