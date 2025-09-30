import { Principal } from '@dfinity/principal';
import { getUsageTrackerActor } from '../actors';

import { fromNullable } from '@dfinity/utils';
import { UsageTracker } from '@prometheus-protocol/declarations';

export type { UsageTracker };

export const getAppMetrics = async (
  principalId: Principal,
): Promise<UsageTracker.AppMetrics | undefined> => {
  const usageTrackerActor = getUsageTrackerActor();
  const res = await usageTrackerActor.get_app_metrics(principalId);
  return fromNullable(res);
};
