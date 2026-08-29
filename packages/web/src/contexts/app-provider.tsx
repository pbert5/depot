import { useEffect, type FC, type ReactNode } from 'react';
import { offlineStorage } from '@/data/offline-storage';
import { FactionsProvider } from './factions/context';
import { SettingsProvider } from './settings/context';
import { ToastProvider } from './toast/context';

/** Factions + Settings + Toast. Roster is mounted separately (it needs Toast). */
export const AppProvider: FC<{ children: ReactNode }> = ({ children }) => {
  useEffect(() => {
    void offlineStorage.migrateLegacyUserData();
  }, []);
  return (
    <FactionsProvider>
      <SettingsProvider>
        <ToastProvider>{children}</ToastProvider>
      </SettingsProvider>
    </FactionsProvider>
  );
};

export default AppProvider;
