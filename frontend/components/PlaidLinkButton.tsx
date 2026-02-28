import React, { useState, useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { create, open, LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk';
import { getLinkToken, exchangePublicToken } from '@/services/plaid';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

interface PlaidLinkButtonProps {
  onSuccess?: () => void;
  isConnected?: boolean;
}

export default function PlaidLinkButton({ onSuccess, isConnected }: PlaidLinkButtonProps) {
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const handleSuccess = useCallback(
    async (success: LinkSuccess) => {
      try {
        await exchangePublicToken(success.publicToken);
        Alert.alert('Success', 'Bank account connected successfully!');
        onSuccess?.();
      } catch (error) {
        Alert.alert('Error', 'Failed to link bank account.');
      }
    },
    [onSuccess]
  );

  const handleExit = useCallback((exit: LinkExit) => {
    if (exit.error) {
      console.log('Plaid Link exit error:', exit.error);
    }
  }, []);

  const initiatePlaidLink = async () => {
    setLoading(true);
    try {
      const token = await getLinkToken();

      // Create the Plaid Link session with the token
      create({ token, noLoadingState: false });

      // Open the Plaid Link UI
      open({
        onSuccess: handleSuccess,
        onExit: handleExit,
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to initialize bank connection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isConnected ? colors.savingsGreen : colors.accent,
        },
      ]}
      onPress={initiatePlaidLink}
      disabled={loading}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>
          {isConnected ? 'Bank Connected' : 'Connect Bank Account'}
        </Text>
      )}
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
