import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const DEFAULT_CURRENCY = 'ILS';

const CURRENCY_META = {
  ILS: { locale: 'he-IL', symbol: '₪' },
  USD: { locale: 'en-US', symbol: '$' }
};

const StoreSettingsContext = createContext({
  currency: DEFAULT_CURRENCY,
  currencySymbol: CURRENCY_META[DEFAULT_CURRENCY].symbol,
  formatPrice: (value) => `₪${Number(value || 0)}`
});

export function StoreSettingsProvider({ children }) {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await api.get('/settings/store');
        const nextCurrency = String(data?.currency || DEFAULT_CURRENCY).trim().toUpperCase();
        if (mounted && CURRENCY_META[nextCurrency]) {
          setCurrency(nextCurrency);
        }
      } catch {
        if (mounted) setCurrency(DEFAULT_CURRENCY);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(() => {
    const meta = CURRENCY_META[currency] || CURRENCY_META[DEFAULT_CURRENCY];
    return {
      currency,
      currencySymbol: meta.symbol,
      formatPrice: (amount) => {
        const numeric = Number(amount);
        if (!Number.isFinite(numeric)) return `${meta.symbol}0`;
        return new Intl.NumberFormat(meta.locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(numeric);
      }
    };
  }, [currency]);

  return (
    <StoreSettingsContext.Provider value={value}>
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings() {
  return useContext(StoreSettingsContext);
}
