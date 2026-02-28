import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  isConnected?: boolean;
}

export default function PlaidLinkButton({ onSuccess, isConnected }: PlaidLinkButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isConnected ? colors.savingsGreen : colors.accent,
          opacity: isConnected ? 1 : 0.6,
        },
      ]}
      onPress={() =>
        Alert.alert('Not Available', 'Bank linking is only available on mobile devices.')
      }>
      <Text style={styles.buttonText}>
        {isConnected ? 'Bank Connected' : 'Connect Bank (Mobile Only)'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
