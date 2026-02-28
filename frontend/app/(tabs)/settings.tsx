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
    } catch {
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
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}>
      {/* Profile */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.secondaryText }]}>{user?.email}</Text>
        </View>
      </View>

      {/* Bank Connection */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Bank Connection</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionDesc, { color: colors.secondaryText }]}>
          Connect your bank account to automatically track transactions and trigger savings.
        </Text>
        <PlaidLinkButton isConnected={user?.has_plaid_connected} onSuccess={refreshUser} />
      </View>

      {/* Risk */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Risk Level</Text>
        {savingRisk && <ActivityIndicator size="small" color={colors.accent} />}
      </View>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionDesc, { color: colors.secondaryText }]}>
          Set how aggressively the AI saves from each purchase.
        </Text>
        <RiskSlider value={riskProfile} onChange={handleRiskChange} disabled={savingRisk} />
      </View>

      {/* Account Details */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>Member Since</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>Risk Profile</Text>
          <Text style={[styles.infoValue, { color: colors.accent }]}>
            {riskProfile.charAt(0).toUpperCase() + riskProfile.slice(1)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.secondaryText }]}>Bank Connected</Text>
          <View style={[styles.statusDot, { backgroundColor: user?.has_plaid_connected ? colors.savingsGreen : colors.danger }]} />
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={[styles.logoutButton, { borderColor: colors.border }]}
        onPress={handleLogout}
        activeOpacity={0.7}>
        <Text style={[styles.logoutText, { color: colors.danger }]}>Log Out</Text>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.secondaryText }]}>
        SubConscious Invest v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 28,
    gap: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '600', marginBottom: 2 },
  profileEmail: { fontSize: 14 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  sectionDesc: { fontSize: 14, lineHeight: 20 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, marginVertical: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  logoutButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  logoutText: { fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, marginBottom: 20 },
});
