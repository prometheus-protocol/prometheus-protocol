import { useInternetIdentity } from 'ic-use-internet-identity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  useVerifierProfile,
  usePaymentToken,
} from '@/hooks/useVerifierDashboard';

export const VerifierStatsTab = () => {
  const { identity } = useInternetIdentity();
  const { data: profile, isLoading: profileLoading } = useVerifierProfile();
  const { data: paymentToken, isLoading: tokenLoading } = usePaymentToken();

  const isLoading = profileLoading || tokenLoading;

  if (!identity) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-center text-muted-foreground">
            Please connect your wallet to view statistics.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!paymentToken) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-center text-muted-foreground">
            Payment token configuration not available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalVerifications = Number(profile?.total_verifications ?? 0n);
  const reputationScore = Number(profile?.reputation_score ?? 0n);
  const totalEarnings = profile
    ? paymentToken.fromAtomic(profile.total_earnings)
    : '0';

  // Calculate success rate from reputation score (reputation_score is 0-100)
  const successRate = reputationScore;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Total Verifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalVerifications}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Success Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{successRate}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {totalEarnings} {paymentToken.symbol}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Lifetime earnings from successful verifications
          </p>
        </CardContent>
      </Card>

      <Card className="md:col-span-3">
        <CardHeader>
          <CardTitle>Reputation Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Score</span>
              <span className="font-bold">{reputationScore}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${reputationScore}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
