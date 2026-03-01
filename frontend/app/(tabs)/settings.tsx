import React, { useState, useCallback, useEffect } from 'react';
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
import { addTransaction, getDemoOptions, type DemoOption } from '@/services/transactions';

type RiskLevel = 'chill' | 'moderate' | 'aggressive';

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [riskProfile, setRiskProfile] = useState<RiskLevel>(
    (user?.risk_profile as RiskLevel) ?? 'moderate'
  );
  const [savingRisk, setSavingRisk] = useState(false);
  const [addingTxn, setAddingTxn] = useState(false);
  const [demoOptions, setDemoOptions] = useState<DemoOption[]>([]);
  const [loadingDemoOptions, setLoadingDemoOptions] = useState(false);

  const loadDemoOptions = useCallback(async () => {
    setLoadingDemoOptions(true);
    try {
      const { options } = await getDemoOptions(8);
      setDemoOptions(options);
    } catch {
      setDemoOptions([]);
    } finally {
      setLoadingDemoOptions(false);
    }
  }, []);

  useEffect(() => {
    loadDemoOptions();
  }, [loadDemoOptions]);

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

      {/* Demo: Add transaction */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Demo</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionDesc, { color: colors.secondaryText }]}>
          Add a fake transaction to trigger savings + AI auto-invest. Pick one or add a random (discretionary vs essential).
        </Text>
        <TouchableOpacity
          style={[styles.demoButton, { backgroundColor: colors.accent }]}
          onPress={async () => {
            setAddingTxn(true);
            try {
              const res = await addTransaction({ demo: true, process: true });
              await refreshUser();
              const amt = res.transaction?.amount ?? 0;
              const msg = res.auto_invested
                ? `Added $${amt.toFixed(2)} → saved, auto-invested in ${res.auto_invest_asset ?? '?'}`
                : `Added $${amt.toFixed(2)} → saved $${res.savings_added?.toFixed(2) ?? '0'} to pool`;
              Alert.alert('Done', msg);
              loadDemoOptions();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.detail ?? 'Failed to add transaction');
            } finally {
              setAddingTxn(false);
            }
          }}
          disabled={addingTxn}>
          {addingTxn ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.demoButtonText}>Add random transaction</Text>
          )}
        </TouchableOpacity>
        {loadingDemoOptions ? (
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 8 }} />
        ) : demoOptions.length > 0 ? (
          <>
            <Text style={[styles.demoOptionsLabel, { color: colors.secondaryText }]}>
              Or pick one:
            </Text>
            <View style={styles.demoOptionsGrid}>
              {demoOptions.map((opt, i) => (
                <TouchableOpacity
                  key={`${opt.merchant}-${opt.amount}-${i}`}
                  style={[
                    styles.demoOptionChip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    opt.category === 'essential' && styles.demoOptionChipEssential,
                  ]}
                  onPress={async () => {
                    setAddingTxn(true);
                    try {
                      const res = await addTransaction({
                        merchant: opt.merchant,
                        amount: opt.amount,
                        category: opt.category,
                        process: true,
                      });
                      await refreshUser();
                      const msg = res.auto_invested
                        ? `Added ${opt.merchant} $${opt.amount.toFixed(2)} → auto-invested in ${res.auto_invest_asset ?? '?'}`
                        : `Added ${opt.merchant} $${opt.amount.toFixed(2)} → saved $${res.savings_added?.toFixed(2) ?? '0'} to pool`;
                      Alert.alert('Done', msg);
                      loadDemoOptions();
                    } catch (e: any) {
                      Alert.alert('Error', e.response?.data?.detail ?? 'Failed to add transaction');
                    } finally {
                      setAddingTxn(false);
                    }
                  }}
                  disabled={addingTxn}>
                  <Text style={[styles.demoOptionMerchant, { color: colors.text }]} numberOfLines={1}>
                    {opt.merchant}
                  </Text>
                  <Text style={[styles.demoOptionAmount, { color: colors.secondaryText }]}>
                    ${opt.amount.toFixed(2)} · {opt.category === 'essential' ? 'essential' : 'discretionary'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
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
  demoButton: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  demoButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  demoOptionsLabel: { fontSize: 13, marginTop: 12, marginBottom: 8 },
  demoOptionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoOptionChip: {
    width: '48%',
    minWidth: 140,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  demoOptionChipEssential: { borderLeftWidth: 3, borderLeftColor: '#22c55e' },
  demoOptionMerchant: { fontSize: 14, fontWeight: '600' },
  demoOptionAmount: { fontSize: 12, marginTop: 4 },
  version: { textAlign: 'center', fontSize: 12, marginBottom: 20 },
});
