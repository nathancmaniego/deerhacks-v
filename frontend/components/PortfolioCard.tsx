import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { PortfolioHolding } from '@/services/investments';

interface PortfolioCardProps {
  holding: PortfolioHolding;
}

export default function PortfolioCard({ holding }: PortfolioCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const isPositive = holding.unrealized_pl >= 0;
  const plColor = isPositive ? colors.savingsGreen : colors.danger;
  const plSign = isPositive ? '+' : '';
  const plPercent = (holding.unrealized_plpc * 100).toFixed(2);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.left}>
        <View style={[styles.symbolBadge, { backgroundColor: colors.accentLight }]}>
          <Text style={[styles.symbolText, { color: colors.accent }]}>{holding.symbol}</Text>
        </View>
        <View>
          <Text style={[styles.shares, { color: colors.text }]}>
            {holding.qty.toFixed(6)} {holding.symbol}
          </Text>
          <Text style={[styles.avgPrice, { color: colors.secondaryText }]}>
            Avg ${holding.avg_entry_price.toFixed(2)}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.value, { color: colors.text }]}>
          ${holding.market_value.toFixed(2)}
        </Text>
        <Text style={[styles.pl, { color: plColor }]}>
          {plSign}${Math.abs(holding.unrealized_pl).toFixed(2)} ({plSign}{plPercent}%)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  symbolBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  symbolText: { fontSize: 14, fontWeight: '700' },
  shares: { fontSize: 14, fontWeight: '600' },
  avgPrice: { fontSize: 13, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  value: { fontSize: 15, fontWeight: '600' },
  pl: { fontSize: 13, fontWeight: '600', marginTop: 2 },
});
