import { Injectable } from '@nestjs/common';

// Extension point for downstream distributions: the core allows everything,
// a cloud build can swap this provider to enforce plan limits (connections
// per user, messages per day, nodes per strategy).
@Injectable()
export class DeliveryPolicy {
  async canDeliver(_userId: string | null, _connectionId: string): Promise<{ allowed: boolean; reason?: string }> {
    return { allowed: true };
  }
}
