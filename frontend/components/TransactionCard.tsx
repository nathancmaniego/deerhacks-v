import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Transaction } from '@/services/transactions';

interface TransactionCardProps {
  transaction: Transaction;
}

export default function TransactionCard({ transaction }: TransactionCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const categoryColor =
    transaction.ai_category === 'essential'
      ? colors.warning
      : transaction.ai_category === 'discretionary'
      ? colors.investBlue
      : colors.tabIconDefault;

  const categoryLabel =
    transaction.ai_category
      ? transaction.ai_category.charAt(0).toUpperCase() +
        transaction.ai_category.slice(1)
      : 'Pending';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.left}>
        <Text style={[styles.merchant, { color: colors.text }]} numberOfLines={1}>
          {transaction.merchant}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: categoryColor + '20' }]}>
            <Text style={[styles.badgeText, { color: categoryColor }]}>
              {categoryLabel}
            </Text>
          </View>
          <Text style={[styles.date, { color: colors.secondaryText }]}>
            {transaction.date}
          </Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: colors.text }]}>
          -${transaction.amount.toFixed(2)}
        </Text>
        {transaction.savings_amount != null && transaction.savings_amount > 0 && (
          <Text style={[styles.savings, { color: colors.savingsGreen }]}>
            +${transaction.savings_amount.toFixed(2)} saved
          </Text>
        )}
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
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  left: {
    flex: 1,
    marginRight: 12,
  },
  merchant: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  date: {
    fontSize: 13,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  savings: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
});
