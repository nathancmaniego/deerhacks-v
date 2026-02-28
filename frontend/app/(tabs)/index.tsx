import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import TransactionCard from '@/components/TransactionCard';
import SavingsChart from '@/components/SavingsChart';
import {
  getTransactions,
  getSavingsSummary,
  Transaction,
  SavingsSummary,
} from '@/services/transactions';
import { getPortfolio } from '@/services/investments';

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savings, setSavings] = useState<SavingsSummary | null>(null);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [txnData, savingsData] = await Promise.all([
        getTransactions(20).catch(() => ({ transactions: [], total_savings: 0, count: 0 })),
        getSavingsSummary().catch(() => null),
      ]);
      setTransactions(txnData.transactions);
      setSavings(savingsData);
      try {
        const portfolio = await getPortfolio();
        setPortfolioValue(portfolio.total_value);
      } catch {
        setPortfolioValue(0);
      }
      await refreshUser();
    } catch (error) {
      console.log('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const totalNet = portfolioValue + (user?.savings_pool ?? 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={[styles.greeting, { color: colors.secondaryText }]}>
          Welcome back, {user?.name?.split(' ')[0]}
        </Text>
        <Text style={[styles.netWorth, { color: colors.text }]}>
          ${totalNet.toFixed(2)}
        </Text>
        <Text style={[styles.netWorthLabel, { color: colors.secondaryText }]}>
          Total Balance
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Savings Pool</Text>
          <Text style={[styles.statValue, { color: colors.savingsGreen }]}>
            ${(user?.savings_pool ?? 0).toFixed(2)}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Portfolio</Text>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            ${portfolioValue.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Total Saved</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            ${(savings?.total_saved ?? 0).toFixed(2)}
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.secondaryText }]}>Invested</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            ${(savings?.total_invested ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Chart */}
      {savings?.savings_history && <SavingsChart data={savings.savings_history} />}

      {/* Transactions */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Recent Transactions
      </Text>

      {transactions.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="bar-chart-outline" size={24} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No transactions yet
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>
            Connect your bank in Settings to start tracking spending and auto-investing.
          </Text>
        </View>
      ) : (
        transactions.map((txn) => <TransactionCard key={txn.id} transaction={txn} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  netWorth: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  netWorthLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 14,
    marginTop: 12,
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
