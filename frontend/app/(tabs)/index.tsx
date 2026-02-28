import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }>
      {/* Greeting */}
      <Text style={[styles.greeting, { color: colors.secondaryText }]}>
        Welcome back,
      </Text>
      <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>

      {/* Summary Cards */}
      <View style={styles.cardsRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.secondaryText }]}>
            Savings Pool
          </Text>
          <Text style={[styles.cardValue, { color: colors.savingsGreen }]}>
            ${(user?.savings_pool ?? 0).toFixed(2)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.secondaryText }]}>
            Portfolio
          </Text>
          <Text style={[styles.cardValue, { color: colors.investBlue }]}>
            ${portfolioValue.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.cardsRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.secondaryText }]}>
            Total Saved
          </Text>
          <Text style={[styles.cardValue, { color: colors.text }]}>
            ${(savings?.total_saved ?? 0).toFixed(2)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.secondaryText }]}>
            Total Invested
          </Text>
          <Text style={[styles.cardValue, { color: colors.accent }]}>
            ${(savings?.total_invested ?? 0).toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Savings Chart */}
      {savings?.savings_history && (
        <SavingsChart data={savings.savings_history} />
      )}

      {/* Recent Transactions */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Recent Transactions
      </Text>

      {transactions.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No transactions yet
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>
            Connect your bank account in Settings to start tracking spending and auto-investing.
          </Text>
        </View>
      ) : (
        transactions.map((txn) => (
          <TransactionCard key={txn.id} transaction={txn} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 15,
    marginBottom: 2,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 14,
    marginTop: 8,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
