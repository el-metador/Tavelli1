import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailView from './components/EmailView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import PricingModal from './components/PricingModal';
import ComposeModal from './components/ComposeModal';
import {
  Account,
  AppSettings,
  AuthenticatedUser,
  Email,
  EmailCategory,
  LastTenAnalysis,
  PlanType,
  UserPlan,
} from './types';
import * as api from './services/api';
import { analyzeLatestTenEmails } from './services/gemini';
import {
  getSupabaseUser,
  isSupabaseConfigured,
  onSupabaseAuthStateChange,
  signInWithGoogle,
  signOutSupabase,
} from './services/supabase';

const AuthScreen: React.FC<{
  isLoading: boolean;
  error: string | null;
  supabaseConfigured: boolean;
  onSignIn: () => Promise<void>;
}> = ({ isLoading, error, supabaseConfigured, onSignIn }) => (
  <div className="min-h-screen w-full bg-[#111111] text-[#e3e3e3] flex items-center justify-center p-6">
    <div className="w-full max-w-md bg-[#1e1f20] border border-[#444746]/60 rounded-3xl p-7 shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
        <span className="material-symbols-rounded text-[#a8c7fa]">shield_lock</span>
        <h1 className="text-xl font-semibold">Tavelli Secure Login</h1>
      </div>
      <p className="text-sm text-[#c4c7c5] mb-6">
        Вход в Tavelli выполняется через Supabase Auth с Google аккаунтом.
      </p>

      {!supabaseConfigured && (
        <div className="mb-4 rounded-xl border border-[#7f1d1d] bg-[#2a1111] text-[#fecaca] text-xs px-3 py-2">
          Supabase не сконфигурирован. Заполните `REACT_APP_SUPABASE_URL` и
          `REACT_APP_SUPABASE_ANON_KEY` в `.env.local`.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-[#7f1d1d] bg-[#2a1111] text-[#fecaca] text-xs px-3 py-2">
          {error}
        </div>
      )}

      <button
        onClick={onSignIn}
        disabled={!supabaseConfigured || isLoading}
        className="w-full py-3 rounded-full bg-[#a8c7fa] text-[#062e6f] font-bold text-sm hover:bg-[#8ab4f8] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Redirecting...' : 'Continue with Google'}
      </button>
    </div>
  </div>
);

const App: React.FC = () => {
  const supabaseConfigured = isSupabaseConfigured();

  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authActionLoading, setAuthActionLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentPlan, setCurrentPlan] = useState<UserPlan>(api.getPlanConfig('FREE'));
  const [activeTab, setActiveTab] = useState<'primary' | 'inbox'>('inbox');
  const [activeView, setActiveView] = useState<'mail' | 'history' | 'settings'>('mail');

  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [strictMode, setStrictMode] = useState(false);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [emails, setEmails] = useState<Email[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string>('');

  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [hiddenByAge, setHiddenByAge] = useState(0);
  const [hiddenByNoise, setHiddenByNoise] = useState(0);

  const [lastTenAnalysis, setLastTenAnalysis] = useState<LastTenAnalysis | null>(null);
  const [isPreAnalyzing, setIsPreAnalyzing] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === activeAccountId) || null,
    [accounts, activeAccountId]
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      if (!supabaseConfigured) {
        setAuthLoading(false);
        return;
      }

      try {
        const user = await getSupabaseUser();
        if (!cancelled) setAuthUser(user);
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : 'Failed to load auth session');
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    const unsubscribe = onSupabaseAuthStateChange((_event, _session, user) => {
      if (cancelled) return;
      setAuthUser(user);
      setAuthLoading(false);
      setAuthError(null);
    });

    bootstrapAuth();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [supabaseConfigured]);

  useEffect(() => {
    const initSettings = async () => {
      const data = await api.getSettings();
      setSettings(data);
      setStrictMode(data.strictNoiseFilter);
    };
    initSettings();
  }, []);

  useEffect(() => {
    if (!settings) return;
    if (settings.strictNoiseFilter === strictMode) return;

    const next = { ...settings, strictNoiseFilter: strictMode };
    setSettings(next);
    api.saveSettings(next);
  }, [settings, strictMode]);

  useEffect(() => {
    const fetchAccounts = async () => {
      const data = await api.getAccounts(currentPlan.type);
      setAccounts(data);
      setActiveAccountId((prev) => {
        if (prev && data.some((account) => account.id === prev)) return prev;
        return data[0]?.id || '';
      });
    };
    fetchAccounts();
  }, [currentPlan.type]);

  useEffect(() => {
    if (!activeAccountId) {
      setEmails([]);
      setHiddenByAge(0);
      setHiddenByNoise(0);
      return;
    }

    const fetchSnapshot = async () => {
      setIsProcessing(true);
      try {
        const tab = activeTab === 'primary' ? 'primary' : 'inbox';
        const snapshot = await api.getInboxSnapshot(
          activeAccountId,
          strictMode,
          tab,
          currentPlan.type
        );
        setEmails(snapshot.emails);
        setHiddenByAge(snapshot.hiddenByAge);
        setHiddenByNoise(snapshot.hiddenByNoise);

        setSelectedEmail((prev) => {
          if (!prev) return prev;
          const next = snapshot.emails.find((item) => item.id === prev.id);
          return next || null;
        });
      } catch (error) {
        console.error('Error loading inbox', error);
      } finally {
        setIsProcessing(false);
      }
    };

    fetchSnapshot();
  }, [activeAccountId, activeTab, strictMode, currentPlan.type]);

  useEffect(() => {
    if (!activeAccountId) return;
    api.watchInbox(activeAccountId, currentPlan.type).catch((error) => {
      console.error('Failed to register inbox watch', error);
    });
  }, [activeAccountId, currentPlan.type]);

  useEffect(() => {
    if (!activeAccountId) return;

    const runAutoAnalyze = async () => {
      if (!settings?.autoAnalyzeOnOpen) {
        setLastTenAnalysis(null);
        return;
      }

      setIsPreAnalyzing(true);
      try {
        const cached = await api.getLastTenAnalysis(activeAccountId);
        if (cached) {
          setLastTenAnalysis(cached);
        }

        const recent = await api.getRecentTenEmails(activeAccountId, currentPlan.type);
        const report = await analyzeLatestTenEmails(
          recent,
          activeAccountId,
          settings.aiProvider,
          currentPlan.type
        );
        setLastTenAnalysis(report);
        await api.saveLastTenAnalysis(report);

        await api.addHistoryItem({
          actionType: 'analysis',
          description: `Analyzed ${report.analyzedEmailIds.length} recent emails and prepared ${report.hotActions.length} hot actions.`,
          targetEmail: activeAccount?.email || 'Active inbox',
          aiStyle: settings.aiStyle,
        });
      } catch (error) {
        console.error('Failed to analyze last ten emails', error);
      } finally {
        setIsPreAnalyzing(false);
      }
    };

    runAutoAnalyze();
  }, [
    activeAccountId,
    settings?.autoAnalyzeOnOpen,
    settings?.aiProvider,
    settings?.aiStyle,
    activeAccount?.email,
    currentPlan.type,
  ]);

  const handleSelectPlan = (type: PlanType) => {
    setCurrentPlan(api.getPlanConfig(type));
  };

  const handleSettingsUpdated = useCallback((next: AppSettings) => {
    setSettings(next);
    setStrictMode(next.strictNoiseFilter);
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    setAuthActionLoading(true);
    setAuthError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setAuthError(error.message);
      setAuthActionLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setAuthActionLoading(true);
    setAuthError(null);
    const { error } = await signOutSupabase();
    if (error) {
      setAuthError(error.message);
    }
    setSelectedEmail(null);
    setAuthActionLoading(false);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full bg-[#111111] text-[#e3e3e3] flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-[#c4c7c5]">
          <span className="material-symbols-rounded animate-spin text-[#a8c7fa]">progress_activity</span>
          Checking login session...
        </div>
      </div>
    );
  }

  if (supabaseConfigured && !authUser) {
    return (
      <AuthScreen
        isLoading={authActionLoading}
        error={authError}
        supabaseConfigured={supabaseConfigured}
        onSignIn={handleGoogleSignIn}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#111111] overflow-hidden text-[#e3e3e3]">
      <Sidebar
        currentPlan={currentPlan}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPricing={() => setIsPricingOpen(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        primaryCount={emails.filter((email) => email.category === EmailCategory.IMPORTANT || email.category === EmailCategory.TEMPORARY_IMPORTANT).length}
        inboxCount={emails.length}
        activeAccountName={activeAccount?.name || 'Mailbox'}
      />

      <main className="flex-1 flex flex-col md:flex-row h-full relative">
        <div className={`flex-1 md:flex md:max-w-md lg:max-w-lg transition-all duration-300 ${selectedEmail ? 'hidden md:flex' : 'flex'}`}>
          {activeView === 'mail' && (
            <EmailList
              emails={emails}
              onSelectEmail={setSelectedEmail}
              strictMode={strictMode}
              setStrictMode={setStrictMode}
              isProcessing={isProcessing}
              onToggleSidebar={() => setIsSidebarOpen(true)}
              onCompose={() => setIsComposeOpen(true)}
              hiddenByAge={hiddenByAge}
              hiddenByNoise={hiddenByNoise}
              isPreAnalyzing={isPreAnalyzing}
              lastTenAnalysis={lastTenAnalysis}
              activeAccountEmail={activeAccount?.email || ''}
            />
          )}

          {activeView === 'history' && <HistoryView />}

          {activeView === 'settings' && (
            <SettingsView
              currentPlan={currentPlan}
              activeAccountId={activeAccountId}
              onOpenPricing={() => setIsPricingOpen(true)}
              onSettingsUpdated={handleSettingsUpdated}
              onAccountSwitch={setActiveAccountId}
              authUser={authUser}
              authError={authError}
              authActionLoading={authActionLoading}
              supabaseConfigured={supabaseConfigured}
              onGoogleSignIn={handleGoogleSignIn}
              onSignOut={handleSignOut}
            />
          )}
        </div>

        <div className={`flex-[2] bg-[#111111] md:bg-transparent transition-all duration-300 ${selectedEmail ? 'flex fixed inset-0 z-40 md:static' : 'hidden md:flex'}`}>
          {selectedEmail ? (
            <EmailView
              email={selectedEmail}
              onBack={() => setSelectedEmail(null)}
              aiProvider={settings?.aiProvider || 'gemini'}
              customPrompt={settings?.customPrompt || ''}
              planType={currentPlan.type}
              autoSignature={Boolean(settings?.autoSignature && currentPlan.limits.autoSignature)}
              autoDate={Boolean(settings?.autoDate && currentPlan.limits.autoDate)}
              autoLogo={Boolean(settings?.autoLogo && currentPlan.limits.autoLogo)}
              logoUrl={settings?.logoUrl || null}
              onTrackAction={async (action, details) => {
                await api.addHistoryItem({
                  actionType: action,
                  description: details,
                  targetEmail: selectedEmail.subject,
                  aiStyle: settings?.aiStyle,
                });
              }}
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full text-gray-500">
              <span className="material-symbols-rounded text-8xl mb-4 text-[#444746]">mark_email_unread</span>
              <p className="text-lg font-medium text-[#444746]">Select an email to view AI insights</p>
            </div>
          )}
        </div>
      </main>

      {!selectedEmail && (
        <div className="h-20 bg-[#1e1f20] flex items-start pt-2 justify-around fixed bottom-0 left-0 right-0 md:hidden z-30 border-t border-[#444746]/50 backdrop-blur-md">
          <div
            className={`flex flex-col items-center w-20 cursor-pointer group transition-opacity ${activeView === 'mail' ? 'opacity-100' : 'opacity-60'}`}
            onClick={() => setActiveView('mail')}
          >
            <div className={`px-5 py-1 rounded-full mb-1 transition-all ${activeView === 'mail' ? 'bg-[#004a77] scale-100' : 'scale-95'}`}>
              <span className={`material-symbols-rounded text-[24px] ${activeView === 'mail' ? 'text-[#c2e7ff] filled-icon' : 'text-[#c4c7c5]'}`}>mail</span>
            </div>
            <span className={`text-[12px] font-medium ${activeView === 'mail' ? 'text-[#e3e3e3] font-bold' : 'text-[#c4c7c5]'}`}>Почта</span>
            {emails.length > 0 && (
              <span className="absolute top-2 ml-6 bg-[#b3261e] text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full border border-[#1e1f20]">
                {emails.filter((email) => !email.isRead).length}
              </span>
            )}
          </div>

          <div
            className={`flex flex-col items-center w-20 cursor-pointer group transition-opacity ${activeView === 'history' ? 'opacity-100' : 'opacity-60'}`}
            onClick={() => setActiveView('history')}
          >
            <div className={`px-5 py-1 rounded-full mb-1 transition-all ${activeView === 'history' ? 'bg-[#004a77] scale-100' : 'scale-95'}`}>
              <span className={`material-symbols-rounded text-[24px] ${activeView === 'history' ? 'text-[#c2e7ff] filled-icon' : 'text-[#c4c7c5]'}`}>history</span>
            </div>
            <span className={`text-[12px] font-medium ${activeView === 'history' ? 'text-[#e3e3e3] font-bold' : 'text-[#c4c7c5]'}`}>История</span>
          </div>

          <div
            className={`flex flex-col items-center w-20 cursor-pointer group transition-opacity ${activeView === 'settings' ? 'opacity-100' : 'opacity-60'}`}
            onClick={() => setActiveView('settings')}
          >
            <div className={`px-5 py-1 rounded-full mb-1 transition-all ${activeView === 'settings' ? 'bg-[#004a77] scale-100' : 'scale-95'}`}>
              <span className={`material-symbols-rounded text-[24px] ${activeView === 'settings' ? 'text-[#c2e7ff] filled-icon' : 'text-[#c4c7c5]'}`}>settings</span>
            </div>
            <span className={`text-[12px] font-medium ${activeView === 'settings' ? 'text-[#e3e3e3] font-bold' : 'text-[#c4c7c5]'}`}>Настройки</span>
          </div>
        </div>
      )}

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        onSelectPlan={handleSelectPlan}
        currentPlanType={currentPlan.type}
      />

      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        aiProvider={settings?.aiProvider || 'gemini'}
        autoSignature={Boolean(settings?.autoSignature && currentPlan.limits.autoSignature)}
        autoDate={Boolean(settings?.autoDate && currentPlan.limits.autoDate)}
        activeAccountId={activeAccountId}
        planType={currentPlan.type}
      />
    </div>
  );
};

export default App;
