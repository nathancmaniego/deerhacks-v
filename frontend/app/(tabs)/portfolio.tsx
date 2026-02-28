import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import PortfolioCard from '@/components/PortfolioCard';
import {
  getPortfolio,
  getInvestmentHistory,
  executeInvestment,
  PortfolioResponse,
  Investment,
} from '@/services/investments';

export default function PortfolioScreen() {
  const { user, refreshUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [investing, setInvesting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [portfolioData, historyData] = await Promise.all([
        getPortfolio().catch(() => null),
        getInvestmentHistory(20).catch(() => ({ investments: [], total_invested: 0, count: 0 })),
      ]);
      setPortfolio(portfolioData);
      setInvestments(historyData.investments);
      await refreshUser();
    } catch (error) {
      console.log('Portfolio fetch error:', error);
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

  const handleBuyCrypto = async () => {
    const pool = user?.savings_pool ?? 0;
    if (pool < 1) {
      Alert.alert('Insufficient Funds', 'You need at least $1.00 in your savings pool.');
      return;
    }

    const doInvest = async () => {
      setInvesting(true);
      try {
        await executeInvestment();
        Alert.alert('Success', 'Crypto purchase complete!');
        await fetchData();
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.detail || 'Failed to buy crypto.');
      } finally {
        setInvesting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Buy crypto with $${pool.toFixed(2)} from your savings pool?`)) {
        await doInvest();
      }
    } else {
      Alert.alert('Buy Crypto', `Invest $${pool.toFixed(2)} from your savings pool into crypto?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Buy', onPress: doInvest },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const totalGainLoss = portfolio?.total_gain_loss ?? 0;
  const isPositive = totalGainLoss >= 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }>
      {/* Value Header */}
      <View style={styles.valueHeader}>
        <Text style={[styles.valueLabel, { color: colors.secondaryText }]}>
          Portfolio Value
        </Text>
        <Text style={[styles.valueAmount, { color: colors.text }]}>
          ${(portfolio?.total_value ?? 0).toFixed(2)}
        </Text>
        <Text style={[styles.valueChange, { color: isPositive ? colors.savingsGreen : colors.danger }]}>
          {isPositive ? '+' : ''}${totalGainLoss.toFixed(2)} all time
        </Text>
      </View>

      {/* Pool + Invest */}
      <View style={[styles.poolCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.poolLabel, { color: colors.secondaryText }]}>
            Available to invest
          </Text>
          <Text style={[styles.poolValue, { color: colors.savingsGreen }]}>
            ${(user?.savings_pool ?? 0).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.investButton, { backgroundColor: colors.accent }]}
          onPress={handleBuyCrypto}
          activeOpacity={0.85}
          disabled={investing}>
          {investing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.investButtonText}>Buy Crypto</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Holdings */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Holdings</Text>

      {!portfolio || portfolio.holdings.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="trending-up-outline" size={24} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No crypto holdings yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>
            Buy BTC, ETH, or SOL to get started. Your holdings will appear here.
          </Text>
        </View>
      ) : (
        portfolio.holdings.map((h) => <PortfolioCard key={h.symbol} holding={h} />)
      )}

      {/* History */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>History</Text>

      {investments.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>
            No investments made yet.
          </Text>
        </View>
      ) : (
        investments.map((inv) => (
          <View
            key={inv.id}
            style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.historyAsset, { color: colors.text }]}>{inv.asset}</Text>
              <Text style={[styles.historyDate, { color: colors.secondaryText }]}>
                {new Date(inv.created_at).toLocaleDateString()}
                {inv.price_at_purchase ? ` @ $${inv.price_at_purchase.toLocaleString()}` : ''}
              </Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.historyAmount, { color: colors.text }]}>
                ${inv.amount_invested.toFixed(2)}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: inv.status === 'filled' ? colors.savingsGreen + '18' : colors.warning + '18' },
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    { color: inv.status === 'filled' ? colors.savingsGreen : colors.warning },
                  ]}>
                  {inv.status}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  valueHeader: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 8,
  },
  valueLabel: { fontSize: 14, fontWeight: '500' },
  valueAmount: { fontSize: 44, fontWeight: '700', letterSpacing: -1.5, marginVertical: 4 },
  valueChange: { fontSize: 15, fontWeight: '600' },
  poolCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
  },
  poolLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  poolValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  investButton: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  investButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 14 },
  emptyState: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', marginBottom: 24 },
  emptyIconContainer: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  historyAsset: { fontSize: 15, fontWeight: '600' },
  historyDate: { fontSize: 13, marginTop: 2 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyAmount: { fontSize: 15, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
});
