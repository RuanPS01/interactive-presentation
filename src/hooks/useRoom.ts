import { useEffect, useState } from 'react'
import { subscribeRoom } from '../lib/rooms'
import type { Room } from '../types/presentation'

interface RoomState {
  room: Room | null
  loading: boolean
  error: string | null
}

/** Assina em tempo real a sala de código `code`. */
export function useRoom(code: string | undefined): RoomState {
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const unsub = subscribeRoom(
      code,
      (r) => {
        setRoom(r)
        setLoading(false)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      },
    )
    return unsub
  }, [code])

  return { room, loading, error }
}
