import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface SavingsChartProps {
  data: { date: string; amount: number }[];
}

export default function SavingsChart({ data }: SavingsChartProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const screenWidth = Dimensions.get('window').width - 48;

  if (!data || data.length < 2) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
          Not enough data for chart yet
        </Text>
      </View>
    );
  }

  let cumulative = 0;
  const cumulativeData = data.map((d) => {
    cumulative += d.amount;
    return cumulative;
  });

  const labels = data.map((d) => {
    const parts = d.date.split('-');
    return `${parts[1]}/${parts[2]}`;
  });

  const step = Math.max(1, Math.floor(labels.length / 6));
  const displayLabels = labels.map((l, i) => (i % step === 0 ? l : ''));

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Savings Growth</Text>
      <LineChart
        data={{
          labels: displayLabels,
          datasets: [{ data: cumulativeData }],
        }}
        width={screenWidth}
        height={180}
        yAxisLabel="$"
        yAxisSuffix=""
        chartConfig={{
          backgroundColor: colors.card,
          backgroundGradientFrom: colors.card,
          backgroundGradientTo: colors.card,
          decimalPlaces: 0,
          color: () => colors.accent,
          labelColor: () => colors.secondaryText,
          propsForDots: {
            r: '3',
            strokeWidth: '1',
            stroke: colors.accent,
          },
          propsForBackgroundLines: {
            stroke: colors.border,
            strokeDasharray: '4',
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  chart: { borderRadius: 12, marginLeft: -16 },
  empty: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: { fontSize: 14 },
});
