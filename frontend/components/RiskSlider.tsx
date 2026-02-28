import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RiskLevel = 'chill' | 'moderate' | 'aggressive';

interface RiskSliderProps {
  value: RiskLevel;
  onChange: (value: RiskLevel) => void;
  disabled?: boolean;
}

const RISK_OPTIONS: { key: RiskLevel; label: string; description: string; range: string }[] = [
  { key: 'chill', label: 'Chill', description: 'Low savings, preserve liquidity', range: '2–5%' },
  { key: 'moderate', label: 'Moderate', description: 'Balanced savings & spending', range: '5–10%' },
  { key: 'aggressive', label: 'Aggressive', description: 'Max savings per transaction', range: '8–15%' },
];

export default function RiskSlider({ value, onChange, disabled }: RiskSliderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [open, setOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const selected = RISK_OPTIONS.find((o) => o.key === value) ?? RISK_OPTIONS[1];

  const toggle = () => {
    if (disabled) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: open ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setOpen(!open);
  };

  const handleSelect = (key: RiskLevel) => {
    onChange(key);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setOpen(false);
  };

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.wrapper, { borderColor: open ? colors.accent : colors.border, backgroundColor: colors.card }]}>
      {/* Trigger */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={toggle}
        activeOpacity={0.7}
        disabled={disabled}>
        <View style={styles.triggerLeft}>
          <Text style={[styles.selectedLabel, { color: colors.text }]}>{selected.label}</Text>
          <Text style={[styles.selectedRange, { color: colors.secondaryText }]}>{selected.range}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Ionicons name="chevron-down" size={18} color={colors.secondaryText} />
        </Animated.View>
      </TouchableOpacity>

      {/* Dropdown Options */}
      {open && (
        <View style={[styles.options, { borderTopColor: colors.border }]}>
          {RISK_OPTIONS.map((option) => {
            const isActive = value === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.option,
                  isActive && { backgroundColor: colors.accentLight },
                ]}
                onPress={() => handleSelect(option.key)}
                activeOpacity={0.7}>
                <View style={styles.optionRow}>
                  <View style={styles.optionLeft}>
                    <Text style={[styles.optionLabel, { color: isActive ? colors.accent : colors.text }]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.optionDesc, { color: colors.secondaryText }]}>
                      {option.description}
                    </Text>
                  </View>
                  <View style={styles.optionRight}>
                    <Text style={[styles.optionRange, { color: isActive ? colors.accent : colors.secondaryText }]}>
                      {option.range}
                    </Text>
                    {isActive && (
                      <Ionicons name="checkmark" size={16} color={colors.accent} />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  selectedRange: {
    fontSize: 13,
  },
  options: {
    borderTopWidth: 1,
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionLeft: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionRange: {
    fontSize: 13,
    fontWeight: '500',
  },
});
