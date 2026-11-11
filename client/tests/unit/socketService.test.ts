import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
}))

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connect: mocks.connect,
    disconnect: mocks.disconnect,
  })),
}))

describe('socket service', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.connect.mockClear()
    mocks.disconnect.mockClear()
  })

  it('keeps the same singleton after a view disconnects', async () => {
    const service = await import('@/services/socket')
    const first = service.getSocket()

    service.disconnectSocket()
    const second = service.getSocket()

    expect(second).toBe(first)
    expect(mocks.disconnect).toHaveBeenCalledTimes(1)
  })
})
