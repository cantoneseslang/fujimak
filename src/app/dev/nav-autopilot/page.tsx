import { notFound } from 'next/navigation'
import NavAutopilotClient from './NavAutopilotClient'

/** Development-only automated navigation benchmark (404 in production builds). */
export default function NavAutopilotPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }
  return <NavAutopilotClient />
}
