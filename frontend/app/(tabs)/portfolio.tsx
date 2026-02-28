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
} from 'react-native';
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

  const handleInvestNow = async () => {
    const pool = user?.savings_pool ?? 0;
    if (pool < 1) {
      Alert.alert('Insufficient Funds', 'You need at least $1.00 in your savings pool to invest.');
      return;
    }

    Alert.alert(
      'Invest Now',
      `Invest $${pool.toFixed(2)} from your savings pool?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Invest',
          onPress: async () => {
            setInvesting(true);
            try {
              await executeInvestment();
              Alert.alert('Success', 'Investment order placed!');
              await fetchData();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.detail || 'Failed to execute investment.'
              );
            } finally {
              setInvesting(false);
            }
          },
        },
      ]
    );
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
      {/* Portfolio Value Header */}
      <View style={[styles.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.headerLabel, { color: colors.secondaryText }]}>
          Total Portfolio Value
        </Text>
        <Text style={[styles.headerValue, { color: colors.text }]}>
          ${(portfolio?.total_value ?? 0).toFixed(2)}
        </Text>
        <Text
          style={[
            styles.headerGain,
            { color: isPositive ? colors.savingsGreen : colors.danger },
          ]}>
          {isPositive ? '+' : ''}${totalGainLoss.toFixed(2)} total
        </Text>

        <View style={styles.poolRow}>
          <View>
            <Text style={[styles.poolLabel, { color: colors.secondaryText }]}>
              Savings Pool
            </Text>
            <Text style={[styles.poolValue, { color: colors.savingsGreen }]}>
              ${(user?.savings_pool ?? 0).toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.investButton, { backgroundColor: colors.accent }]}
            onPress={handleInvestNow}
            disabled={investing}>
            {investing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.investButtonText}>Invest Now</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Holdings */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Holdings</Text>

      {!portfolio || portfolio.holdings.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No holdings yet
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>
            Your investments will appear here once you start auto-investing.
          </Text>
        </View>
      ) : (
        portfolio.holdings.map((holding) => (
          <PortfolioCard key={holding.symbol} holding={holding} />
        ))
      )}

      {/* Investment History */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Investment History
      </Text>

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
            style={[
              styles.historyItem,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <View>
              <Text style={[styles.historyAsset, { color: colors.text }]}>
                {inv.asset}
              </Text>
              <Text style={[styles.historyDate, { color: colors.secondaryText }]}>
                {new Date(inv.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.historyAmount, { color: colors.text }]}>
                ${inv.amount_invested.toFixed(2)}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      inv.status === 'filled'
                        ? colors.savingsGreen + '20'
                        : colors.warning + '20',
                  },
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        inv.status === 'filled'
                          ? colors.savingsGreen
                          : colors.warning,
                    },
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
  headerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerValue: {
    fontSize: 36,
    fontWeight: '800',
    marginVertical: 4,
  },
  headerGain: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  poolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E8E8F020',
    paddingTop: 14,
  },
  poolLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  poolValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  investButton: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  investButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 14,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  historyAsset: {
    fontSize: 16,
    fontWeight: '700',
  },
  historyDate: {
    fontSize: 13,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
