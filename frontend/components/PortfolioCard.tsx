import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { PortfolioHolding } from '@/services/investments';

interface PortfolioCardProps {
  holding: PortfolioHolding;
  onSell?: () => void;
  selling?: boolean;
}

export default function PortfolioCard({ holding, onSell, selling }: PortfolioCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const isPositive = holding.unrealized_pl >= 0;
  const plColor = isPositive ? colors.savingsGreen : colors.danger;
  const plSign = isPositive ? '+' : '';
  const plPercent = (holding.unrealized_plpc * 100).toFixed(2);
  const isCrypto = holding.asset_type === 'crypto';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.top}>
        <View style={styles.left}>
          <View style={[styles.symbolBadge, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.symbolText, { color: colors.accent }]}>{holding.symbol}</Text>
          </View>
          <View>
            <Text style={[styles.shares, { color: colors.text }]}>
              {(isCrypto ? holding.qty.toFixed(6) : holding.qty.toFixed(4))} {holding.symbol}
            </Text>
            <Text style={[styles.avgPrice, { color: colors.secondaryText }]}>
              Avg ${holding.avg_entry_price.toFixed(2)} · ${holding.current_price.toFixed(2)} now
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
      {onSell && (
        <TouchableOpacity
          style={[styles.sellBtn, { borderColor: colors.danger }]}
          onPress={onSell}
          disabled={selling}>
          <Text style={[styles.sellBtnText, { color: colors.danger }]}>
            {selling ? 'Selling…' : 'Sell all'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  symbolBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  symbolText: { fontSize: 14, fontWeight: '700' },
  shares: { fontSize: 14, fontWeight: '600' },
  avgPrice: { fontSize: 13, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  value: { fontSize: 15, fontWeight: '600' },
  pl: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  sellBtn: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  sellBtnText: { fontSize: 13, fontWeight: '600' },
});
