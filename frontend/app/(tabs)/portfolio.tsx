import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import PortfolioCard from '@/components/PortfolioCard';
import {
  getPortfolio,
  getInvestmentHistory,
  executeInvestment,
  getSupportedAssets,
  searchStocks,
  sellHolding,
  getInvestmentAdvice,
  PortfolioResponse,
  Investment,
  SupportedAssets,
  StockSearchResult,
  InvestmentAdvice,
} from '@/services/investments';

export default function PortfolioScreen() {
  const { user, refreshUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [supportedAssets, setSupportedAssets] = useState<SupportedAssets | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [investing, setInvesting] = useState(false);
  const [investModalVisible, setInvestModalVisible] = useState(false);
  const [investType, setInvestType] = useState<'crypto' | 'stock'>('stock');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockSearchResults, setStockSearchResults] = useState<StockSearchResult[]>([]);
  const [stockSearching, setStockSearching] = useState(false);
  const [sellingSymbol, setSellingSymbol] = useState<string | null>(null);
  const [investAmountTarget, setInvestAmountTarget] = useState<{ asset: string } | null>(null);
  const [investAmountInput, setInvestAmountInput] = useState('');
  const [advice, setAdvice] = useState<InvestmentAdvice | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshUserRef = useRef(refreshUser);
  const fetchInFlightRef = useRef(false);
  refreshUserRef.current = refreshUser;

  const fetchData = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const [portfolioData, historyData] = await Promise.all([
        getPortfolio().catch(() => null),
        getInvestmentHistory(20).catch(() => ({ investments: [], total_invested: 0, count: 0 })),
      ]);
      setPortfolio(portfolioData);
      setInvestments(historyData.investments);
      await refreshUserRef.current();
    } catch (error) {
      console.log('Portfolio fetch error:', error);
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadSupportedAssetsIfNeeded = useCallback(async () => {
    if (supportedAssets !== null) return;
    try {
      const supported = await getSupportedAssets();
      setSupportedAssets(supported);
    } catch {
      setSupportedAssets({ crypto: [], stocks: [] });
    }
  }, [supportedAssets]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    if (investType !== 'stock' || !investModalVisible) return;
    const q = stockSearchQuery.trim();
    if (!q) {
      setStockSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setStockSearching(true);
      try {
        const results = await searchStocks(q, 12);
        setStockSearchResults(results);
      } catch {
        setStockSearchResults([]);
      } finally {
        setStockSearching(false);
      }
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [stockSearchQuery, investType, investModalVisible]);

  const openInvestAmount = (asset: string) => {
    const pool = user?.savings_pool ?? 0;
    if (pool < 1) {
      Alert.alert('Insufficient Funds', 'You need at least $1.00 in your savings pool.');
      return;
    }
    setInvestAmountTarget({ asset });
    setInvestAmountInput('');
  };

  const pool = user?.savings_pool ?? 0;
  const isAmountEmpty = investAmountInput.trim() === '';
  const investAmountParsed = isAmountEmpty ? null : parseFloat(investAmountInput.trim());
  const hasValidParsed = investAmountParsed != null && !Number.isNaN(investAmountParsed) && investAmountParsed >= 1;
  const investAmountToUse = hasValidParsed ? investAmountParsed : (isAmountEmpty ? pool : 0);
  const investAmountValid = investAmountToUse >= 1 && investAmountToUse <= pool;

  const handleConfirmInvest = async () => {
    if (!investAmountTarget) return;
    const asset = investAmountTarget.asset;
    if (!investAmountValid) {
      Alert.alert('Invalid Amount', `Enter between $1.00 and $${pool.toFixed(2)} (your available balance).`);
      return;
    }
    setInvesting(true);
    try {
      await executeInvestment(investAmountToUse, asset, investType);
      Alert.alert('Done', `Invested $${investAmountToUse.toFixed(2)} in ${asset}.`);
      setInvestAmountTarget(null);
      setInvestModalVisible(false);
      await fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Investment failed.');
    } finally {
      setInvesting(false);
    }
  };

  const handleSell = (holding: { symbol: string; asset_type?: string }) => {
    const assetType = (holding.asset_type === 'stock' ? 'stock' : 'crypto') as 'crypto' | 'stock';
    const msg = `Sell all ${holding.symbol}? Proceeds go to your savings pool.`;
    const doSell = async () => {
      setSellingSymbol(holding.symbol);
      try {
        const res = await sellHolding(holding.symbol, assetType);
        Alert.alert('Sold', `$${res.proceeds.toFixed(2)} added to savings pool.`);
        await fetchData();
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.detail || 'Sell failed.');
      } finally {
        setSellingSymbol(null);
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(msg)) doSell();
    } else {
      Alert.alert('Sell', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Sell', onPress: doSell }]);
    }
  };

  const assetList = investType === 'crypto'
    ? (supportedAssets?.crypto ?? [])
    : (supportedAssets?.stocks ?? []);
  const assetsLoading = investModalVisible && supportedAssets === null;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const totalGainLoss = portfolio?.total_gain_loss ?? 0;
  const totalGainLossPct = portfolio?.total_gain_loss_pct ?? 0;
  const isPositive = totalGainLoss >= 0;
  const hasInvestments = (portfolio?.total_cost ?? 0) > 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }>
      {/* Balance: total + % change on investments */}
      <View style={styles.valueHeader}>
        <Text style={[styles.valueLabel, { color: colors.secondaryText }]}>
          Total Balance
        </Text>
        <Text style={[styles.valueAmount, { color: colors.text }]}>
          ${((portfolio?.total_value ?? 0) + (user?.savings_pool ?? 0)).toFixed(2)}
        </Text>
        <Text style={[styles.valueSub, { color: colors.secondaryText }]}>
          Portfolio ${(portfolio?.total_value ?? 0).toFixed(2)} + Cash ${(user?.savings_pool ?? 0).toFixed(2)}
        </Text>
        {hasInvestments && (
          <Text style={[styles.valueChange, { color: isPositive ? colors.savingsGreen : colors.danger }]}>
            {isPositive ? '+' : ''}{totalGainLossPct.toFixed(2)}% ({isPositive ? '+' : ''}${totalGainLoss.toFixed(2)})
          </Text>
        )}
      </View>

      {/* Pool + Invest */}
      <View style={[styles.poolCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.poolLabel, { color: colors.secondaryText }]}>
            Available to invest
          </Text>
          <Text style={[styles.poolValue, { color: colors.savingsGreen }]}>
            ${(user?.savings_pool ?? 0).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.investButton, { backgroundColor: colors.accent }]}
          onPress={() => {
            setInvestModalVisible(true);
            loadSupportedAssetsIfNeeded();
          }}
          activeOpacity={0.85}
          disabled={investing}>
          {investing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.investButtonText}>Invest</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* AI suggestion */}
      <View style={[styles.adviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.adviceHeader}>
          <Ionicons name="sparkles" size={20} color={colors.accent} />
          <Text style={[styles.adviceTitle, { color: colors.text }]}>AI suggestion</Text>
        </View>
        {adviceLoading && (
          <View style={styles.adviceLoading}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}
        {!adviceLoading && !advice && (
          <TouchableOpacity
            style={[styles.adviceButton, { borderColor: colors.accent }]}
            onPress={async () => {
              setAdviceLoading(true);
              setAdvice(null);
              try {
                const data = await getInvestmentAdvice();
                setAdvice(data);
              } catch {
                setAdvice({ advice: 'Unable to load suggestion.', suggestions: [] });
              } finally {
                setAdviceLoading(false);
              }
            }}>
            <Text style={[styles.adviceButtonText, { color: colors.accent }]}>Get advice</Text>
          </TouchableOpacity>
        )}
        {!adviceLoading && advice && (
          <>
            <Text style={[styles.adviceText, { color: colors.text }]}>{advice.advice}</Text>
            {advice.suggestions?.length > 0 && (
              <View style={styles.suggestionsList}>
                {advice.suggestions.map((s, i) => {
                  const amount = ((user?.savings_pool ?? 0) * s.amount_pct) / 100;
                  return (
                    <TouchableOpacity
                      key={`${s.asset}-${i}`}
                      style={[styles.suggestionRow, { borderColor: colors.border }]}
                      onPress={() => {
                        setInvestType((s.asset_type === 'crypto' ? 'crypto' : 'stock') as 'crypto' | 'stock');
                        setInvestAmountInput(amount >= 1 ? amount.toFixed(2) : '');
                        setInvestAmountTarget({ asset: s.asset });
                        setInvestModalVisible(true);
                        loadSupportedAssetsIfNeeded();
                      }}>
                      <Text style={[styles.suggestionAsset, { color: colors.text }]}>
                        {s.asset} — {s.amount_pct}%
                      </Text>
                      <Text style={[styles.suggestionReason, { color: colors.secondaryText }]} numberOfLines={1}>
                        {s.reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              style={[styles.adviceButton, { borderColor: colors.accent, marginTop: 8 }]}
              onPress={() => setAdvice(null)}>
              <Text style={[styles.adviceButtonText, { color: colors.accent }]}>New suggestion</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Invest modal: pick type + asset, then enter amount */}
      <Modal
        visible={investModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setInvestAmountTarget(null);
          setInvestModalVisible(false);
        }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setInvestAmountTarget(null);
              setInvestModalVisible(false);
            }}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.background }]} pointerEvents="box-none">
            <View style={styles.modalHeader}>
              {investAmountTarget ? (
                <TouchableOpacity onPress={() => setInvestAmountTarget(null)} style={styles.modalBackBtn}>
                  <Ionicons name="arrow-back" size={22} color={colors.accent} />
                </TouchableOpacity>
              ) : (
                <View style={styles.modalBackBtn} />
              )}
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {investAmountTarget ? `Invest in ${investAmountTarget.asset}` : 'Invest (simulated)'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setInvestAmountTarget(null);
                  setInvestModalVisible(false);
                }}
                hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            {investAmountTarget ? (
              <View style={styles.amountSection}>
                <Text style={[styles.amountLabel, { color: colors.secondaryText }]}>
                  Amount to invest (USD)
                </Text>
                <Text style={[styles.amountAvailable, { color: colors.text }]}>
                  Available: ${pool.toFixed(2)}
                </Text>
                <TextInput
                  style={[styles.amountInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="e.g. 50"
                  placeholderTextColor={colors.secondaryText}
                  value={investAmountInput}
                  onChangeText={setInvestAmountInput}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.maxButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setInvestAmountInput(pool.toFixed(2))}>
                  <Text style={[styles.maxButtonText, { color: colors.accent }]}>Use max</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmInvestButton, { backgroundColor: investAmountValid ? colors.accent : colors.border }]}
                  onPress={handleConfirmInvest}
                  disabled={!investAmountValid || investing}>
                  {investing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.confirmInvestButtonText}>
                      Invest ${investAmountToUse.toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[styles.typeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.typeTab, investType === 'stock' && { backgroundColor: colors.accent }]}
                    onPress={() => setInvestType('stock')}>
                    <Text style={[styles.typeTabText, { color: investType === 'stock' ? '#fff' : colors.text }]}>
                      Stocks
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeTab, investType === 'crypto' && { backgroundColor: colors.accent }]}
                    onPress={() => setInvestType('crypto')}>
                    <Text style={[styles.typeTabText, { color: investType === 'crypto' ? '#fff' : colors.text }]}>
                      Solana
                    </Text>
                  </TouchableOpacity>
                </View>

                {investType === 'stock' ? (
                  <>
                    <Text style={[styles.assetListLabel, { color: colors.secondaryText }]}>
                      Search any stock by name or ticker
                    </Text>
                    <TextInput
                      style={[styles.searchInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                      placeholder="e.g. Apple, AAPL, Tesla"
                      placeholderTextColor={colors.secondaryText}
                      value={stockSearchQuery}
                      onChangeText={setStockSearchQuery}
                      autoCapitalize="characters"
                    />
                    {stockSearching && (
                      <View style={styles.searchLoading}>
                        <ActivityIndicator size="small" color={colors.accent} />
                      </View>
                    )}
                    <FlatList
                      data={stockSearchResults}
                      keyExtractor={(item) => item.symbol}
                      style={styles.assetList}
                      contentContainerStyle={styles.assetListContent}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.stockRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => openInvestAmount(item.symbol)}
                          disabled={investing}>
                          <View>
                            <Text style={[styles.stockSymbol, { color: colors.text }]}>{item.symbol}</Text>
                            <Text style={[styles.stockName, { color: colors.secondaryText }]} numberOfLines={1}>{item.name}</Text>
                          </View>
                          <Text style={[styles.stockPrice, { color: colors.text }]}>${item.price.toFixed(2)}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </>
                ) : (
                  <>
                    <Text style={[styles.assetListLabel, { color: colors.secondaryText }]}>
                      Solana meme coins — tap one, then enter amount
                    </Text>
                    {assetsLoading && (
                      <View style={styles.searchLoading}>
                        <ActivityIndicator size="small" color={colors.accent} />
                      </View>
                    )}
                    <FlatList
                      data={assetList}
                      keyExtractor={(item) => item}
                      numColumns={2}
                      columnWrapperStyle={styles.assetRow}
                      style={styles.assetList}
                      contentContainerStyle={styles.assetListContent}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.assetChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => openInvestAmount(item)}
                          disabled={investing}>
                          <Text style={[styles.assetChipText, { color: colors.text }]}>{item}</Text>
                        </TouchableOpacity>
                      )}
                    />
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Holdings */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Holdings</Text>

      {!portfolio || portfolio.holdings.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="trending-up-outline" size={24} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No holdings yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>
            Search stocks by name or ticker, or pick Solana meme coins. Sell any holding to add proceeds to your balance.
          </Text>
        </View>
      ) : (
        portfolio.holdings.map((h) => (
          <PortfolioCard
            key={`${h.symbol}-${h.asset_type ?? 'crypto'}`}
            holding={h}
            onSell={() => handleSell(h)}
            selling={sellingSymbol === h.symbol}
          />
        ))
      )}

      {/* History */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>History</Text>

      {investments.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.emptyDesc, { color: colors.secondaryText }]}>
            No investments made yet.
          </Text>
        </View>
      ) : (
        investments.map((inv) => (
          <View
            key={inv.id}
            style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View>
              <Text style={[styles.historyAsset, { color: colors.text }]}>{inv.asset}</Text>
              <Text style={[styles.historyDate, { color: colors.secondaryText }]}>
                {new Date(inv.created_at).toLocaleDateString()}
                {inv.price_at_purchase ? ` @ $${inv.price_at_purchase.toLocaleString()}` : ''}
              </Text>
            </View>
            <View style={styles.historyRight}>
              <Text style={[styles.historyAmount, { color: colors.text }]}>
                ${inv.amount_invested.toFixed(2)}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: inv.status === 'filled' ? colors.savingsGreen + '18' : colors.warning + '18' },
                ]}>
                <Text
                  style={[
                    styles.statusText,
                    { color: inv.status === 'filled' ? colors.savingsGreen : colors.warning },
                  ]}>
                  {inv.status}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  valueHeader: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 8,
  },
  valueLabel: { fontSize: 14, fontWeight: '500' },
  valueAmount: { fontSize: 44, fontWeight: '700', letterSpacing: -1.5, marginVertical: 4 },
  valueSub: { fontSize: 12, marginBottom: 4 },
  valueChange: { fontSize: 15, fontWeight: '600' },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  amountSection: { marginTop: 8 },
  amountLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  amountAvailable: { fontSize: 13, marginBottom: 12 },
  amountInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    marginBottom: 10,
  },
  maxButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  maxButtonText: { fontSize: 14, fontWeight: '600' },
  confirmInvestButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmInvestButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  searchLoading: { paddingVertical: 8, alignItems: 'center' },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  stockSymbol: { fontSize: 15, fontWeight: '700' },
  stockName: { fontSize: 12, marginTop: 2, maxWidth: 180 },
  stockPrice: { fontSize: 15, fontWeight: '600' },
  poolCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 24,
  },
  poolLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  poolValue: { fontSize: 22, fontWeight: '700', marginTop: 4 },
  investButton: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  investButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  adviceCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  adviceTitle: { fontSize: 16, fontWeight: '700' },
  adviceLoading: { paddingVertical: 16, alignItems: 'center' },
  adviceButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  adviceButtonText: { fontSize: 14, fontWeight: '600' },
  adviceText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  suggestionsList: { gap: 8 },
  suggestionRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  suggestionAsset: { fontSize: 14, fontWeight: '700' },
  suggestionReason: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 14 },
  emptyState: { borderRadius: 14, borderWidth: 1, padding: 28, alignItems: 'center', marginBottom: 24 },
  emptyIconContainer: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  historyAsset: { fontSize: 15, fontWeight: '600' },
  historyDate: { fontSize: 13, marginTop: 2 },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyAmount: { fontSize: 15, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalBackBtn: { padding: 4, marginRight: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  typeToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 12,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeTabText: { fontSize: 14, fontWeight: '600' },
  assetListLabel: { fontSize: 12, marginBottom: 10 },
  assetList: { maxHeight: 260 },
  assetListContent: { paddingBottom: 16 },
  assetRow: { justifyContent: 'space-between', marginBottom: 8 },
  assetChip: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  assetChipText: { fontSize: 15, fontWeight: '600' },
});
