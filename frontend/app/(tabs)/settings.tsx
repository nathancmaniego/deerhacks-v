import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import RiskSlider from '@/components/RiskSlider';
import PlaidLinkButton from '@/components/PlaidLinkButton';
import { updateRiskProfile } from '@/services/auth';

type RiskLevel = 'chill' | 'moderate' | 'aggressive';

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [riskProfile, setRiskProfile] = useState<RiskLevel>(
    (user?.risk_profile as RiskLevel) ?? 'moderate'
  );
  const [savingRisk, setSavingRisk] = useState(false);

  const handleRiskChange = async (value: RiskLevel) => {
    setRiskProfile(value);
    setSavingRisk(true);
    try {
      await updateRiskProfile(value);
      await refreshUser();
    } catch (error) {
      Alert.alert('Error', 'Failed to update risk profile');
      setRiskProfile((user?.risk_profile as RiskLevel) ?? 'moderate');
    } finally {
      setSavingRisk(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to log out?')) {
        logout();
      }
      return;
    }
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}>
      {/* Profile Card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={[styles.profileName, { color: colors.text }]}>
          {user?.name}
        </Text>
        <Text style={[styles.profileEmail, { color: colors.secondaryText }]}>
          {user?.email}
        </Text>
      </View>

      {/* Bank Connection */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Bank Connection
      </Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionDesc, { color: colors.secondaryText }]}>
          Connect your bank account via Plaid to automatically track transactions
          and trigger savings.
        </Text>
        <PlaidLinkButton
          isConnected={user?.has_plaid_connected}
          onSuccess={refreshUser}
        />
      </View>

      {/* Risk Profile */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Investment Aggressiveness
        </Text>
        {savingRisk && <ActivityIndicator size="small" color={colors.accent} />}
      </View>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionDesc, { color: colors.secondaryText }]}>
          Choose how aggressively the AI saves from each purchase. Higher
          aggressiveness means a larger percentage of each transaction goes to
          your investment pool.
        </Text>
        <RiskSlider
          value={riskProfile}
          onChange={handleRiskChange}
          disabled={savingRisk}
        />
      </View>

      {/* Account Info */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>
            Member Since
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString()
              : '-'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>
            Risk Profile
          </Text>
          <Text style={[styles.infoValue, { color: colors.accent }]}>
            {riskProfile.charAt(0).toUpperCase() + riskProfile.slice(1)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>
            Bank Connected
          </Text>
          <Text
            style={[
              styles.infoValue,
              {
                color: user?.has_plaid_connected
                  ? colors.savingsGreen
                  : colors.danger,
              },
            ]}>
            {user?.has_plaid_connected ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: colors.danger }]}
        onPress={handleLogout}>
        <Text style={[styles.logoutText, { color: colors.danger }]}>
          Log Out
        </Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.tabIconDefault }]}>
        SubConscious Invest v1.0.0
      </Text>
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
  profileCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 12,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  sectionDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 20,
  },
});
