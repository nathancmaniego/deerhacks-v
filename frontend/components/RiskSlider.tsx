import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

type RiskLevel = 'chill' | 'moderate' | 'aggressive';

interface RiskSliderProps {
  value: RiskLevel;
  onChange: (value: RiskLevel) => void;
  disabled?: boolean;
}

const RISK_OPTIONS: { key: RiskLevel; label: string; description: string; range: string }[] = [
  {
    key: 'chill',
    label: 'Chill',
    description: 'Low savings rate, preserve liquidity',
    range: '2-5%',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    description: 'Balanced savings and spending',
    range: '5-10%',
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    description: 'Maximum savings per transaction',
    range: '8-15%',
  },
];

export default function RiskSlider({ value, onChange, disabled }: RiskSliderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      {RISK_OPTIONS.map((option) => {
        const isSelected = value === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.option,
              {
                backgroundColor: isSelected ? colors.accentLight : colors.card,
                borderColor: isSelected ? colors.accent : colors.border,
              },
            ]}
            onPress={() => onChange(option.key)}
            disabled={disabled}>
            <View style={styles.optionHeader}>
              <Text
                style={[
                  styles.optionLabel,
                  { color: isSelected ? colors.accent : colors.text },
                ]}>
                {option.label}
              </Text>
              <Text
                style={[
                  styles.optionRange,
                  { color: isSelected ? colors.accent : colors.secondaryText },
                ]}>
                {option.range}
              </Text>
            </View>
            <Text style={[styles.optionDesc, { color: colors.secondaryText }]}>
              {option.description}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  option: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  optionRange: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 13,
  },
});
