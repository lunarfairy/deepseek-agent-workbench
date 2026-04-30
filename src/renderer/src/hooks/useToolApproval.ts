import { useState, useCallback, useEffect } from 'react'
import type { ToolApprovalRequest } from '../../../shared/types'

export function useToolApproval() {
  const [pendingRequests, setPendingRequests] = useState<ToolApprovalRequest[]>([])

  useEffect(() => {
    const cleanup = window.api.onToolApprovalRequest((request) => {
      setPendingRequests((prev) => [...prev, request])
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

  return { pendingRequests, approve, reject }
}
