import { useState, useCallback, useEffect } from 'react'
import type { ToolApprovalRequest } from '../../../shared/types'

export function useToolApproval() {
  const [pendingRequests, setPendingRequests] = useState<ToolApprovalRequest[]>([])

  useEffect(() => {
    const cleanup = window.api.onToolApprovalRequest((request) => {
      setPendingRequests((prev) => {
        const exists = prev.some((candidate) => candidate.toolCallId === request.toolCallId)
        return exists
          ? prev.map((candidate) =>
              candidate.toolCallId === request.toolCallId ? request : candidate
            )
          : [...prev, request]
      })
    })
    return cleanup
  }, [])

  const approve = useCallback(async (toolCallId: string) => {
    setPendingRequests((prev) => prev.filter((r) => r.toolCallId !== toolCallId))
    await window.api.respondToolApproval({ toolCallId, approved: true })
  }, [])

  const reject = useCallback(async (toolCallId: string) => {
    setPendingRequests((prev) => prev.filter((r) => r.toolCallId !== toolCallId))
    await window.api.respondToolApproval({ toolCallId, approved: false })
  }, [])

  const rejectAll = useCallback(async () => {
    const ids = pendingRequests.map((request) => request.toolCallId)
    setPendingRequests([])
    await Promise.all(
      ids.map((toolCallId) => window.api.respondToolApproval({ toolCallId, approved: false }))
    )
  }, [pendingRequests])

  return { pendingRequests, approve, reject, rejectAll }
}
