import { Principal } from '@icp-sdk/core/principal';
import { getUsageTrackerActor } from '../actors.js';

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

export const getNamespaceMetrics = async (
  namespace: string,
): Promise<UsageTracker.NamespaceMetrics | undefined> => {
  const usageTrackerActor = getUsageTrackerActor();
  const res = await usageTrackerActor.get_namespace_metrics(namespace);
  return fromNullable(res);
};

export const getNamespaceTools = async (
  namespace: string,
): Promise<UsageTracker.ToolMetrics[]> => {
  const usageTrackerActor = getUsageTrackerActor();
  const res = await usageTrackerActor.get_namespace_tools(namespace);
  return res;
};

export const getNamespaceMetricsDetailed = async (
  namespace: string,
): Promise<UsageTracker.NamespaceMetricsDetailed | undefined> => {
  const usageTrackerActor = getUsageTrackerActor();
  const res = await usageTrackerActor.get_namespace_metrics_detailed(namespace);
  return fromNullable(res);
};
