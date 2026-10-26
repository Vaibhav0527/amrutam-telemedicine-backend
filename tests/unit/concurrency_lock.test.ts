import {
  acquireDistributedLock,
  releaseDistributedLock,
} from '../../src/cache/redis';

describe('Concurrency Control — Distributed Lock (Zero Double-Booking)', () => {
  const testSlotKey = `lock:slot:test-slot-${Date.now()}`;

  afterEach(async () => {
    await releaseDistributedLock(testSlotKey);
  });

  it('should acquire lock when free and reject concurrent second acquisition', async () => {
    const firstAcquire = await acquireDistributedLock(testSlotKey, 5);
    expect(firstAcquire).toBe(true);

    // Immediate second acquisition attempt must fail (simulating concurrent race condition)
    const secondAcquire = await acquireDistributedLock(testSlotKey, 5);
    expect(secondAcquire).toBe(false);
  });

  it('should allow acquisition after lock is explicitly released', async () => {
    const firstAcquire = await acquireDistributedLock(testSlotKey, 5);
    expect(firstAcquire).toBe(true);

    await releaseDistributedLock(testSlotKey);

    const reAcquire = await acquireDistributedLock(testSlotKey, 5);
    expect(reAcquire).toBe(true);
  });
});
