import React, { useEffect, useState } from 'react';
import { Account, AppSettings, AuthenticatedUser, UserPlan } from '../types';
import * as api from '../services/api';

interface SettingsViewProps {
  currentPlan: UserPlan;
  activeAccountId: string;
  onOpenPricing: () => void;
  onSettingsUpdated: (settings: AppSettings) => void;
  onAccountSwitch: (accountId: string) => void;
  authUser: AuthenticatedUser | null;
  authError: string | null;
  authActionLoading: boolean;
  supabaseConfigured: boolean;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  currentPlan,
  activeAccountId,
  onOpenPricing,
  onSettingsUpdated,
  onAccountSwitch,
  authUser,
  authError,
  authActionLoading,
  supabaseConfigured,
  onGoogleSignIn,
  onSignOut,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [gmailConfigured, setGmailConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const [accData, setModel, gmailStatus] = await Promise.all([
        api.getAccounts(currentPlan.type),
        api.getSettings(),
        api.getGmailOAuthStatus(),
      ]);

      const patchedAccounts = accData.map((account) => ({
        ...account,
        isActive: account.id === activeAccountId,
      }));

      if (!patchedAccounts.some((account) => account.isActive) && patchedAccounts[0]) {
        patchedAccounts[0].isActive = true;
        onAccountSwitch(patchedAccounts[0].id);
      }

      setAccounts(patchedAccounts);
      setSettings(setModel);
      setGmailConfigured(Boolean(gmailStatus.configured));
      onSettingsUpdated(setModel);
      setLoading(false);
    };

    init();
  }, [currentPlan.type, activeAccountId, onAccountSwitch, onSettingsUpdated]);

  const handleSwitchAccount = (id: string) => {
    setAccounts(
      accounts.map((account) => ({
        ...account,
        isActive: account.id === id,
      }))
    );
    onAccountSwitch(id);
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    onSettingsUpdated(updated);
    api.saveSettings(updated);
  };

  const handleConnectGmail = async () => {
    const account = accounts.find((item) => item.isActive) || accounts[0];
    if (!account) {
      alert('Не найден аккаунт для подключения. Выйдите и войдите снова.');
      return;
    }

    const authUrl = await api.getGmailAuthUrl(account.id, currentPlan.type);
    if (authUrl) {
      window.open(authUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    alert('Could not generate Gmail auth URL. Check backend Gmail OAuth env.');
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const url = URL.createObjectURL(event.target.files[0]);
      updateSettings({ logoUrl: url });
    }
  };

  if (loading || !settings) {
    return <div className="p-4 text-[#8e918f]">Loading settings...</div>;
  }

  const accountLimit = currentPlan.limits.maxAccounts;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111111] overflow-y-auto pb-24 text-[#e3e3e3]">
      <div className="bg-[#1e1f20] pt-6 pb-4 px-4 sticky top-0 z-10 border-b border-[#444746]/50">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-xs font-medium text-[#8e918f] uppercase tracking-wider">Accounts ({accounts.length}/{accountLimit})</h2>
          <button
            onClick={handleConnectGmail}
            className="text-[11px] px-3 py-1 rounded-full border border-[#444746] text-[#c4c7c5] hover:bg-[#2b2c2f]"
          >
            {gmailConfigured ? 'Connect Gmail' : 'OAuth Setup'}
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {accounts.map((account) => (
            <div
              key={account.id}
              onClick={() => handleSwitchAccount(account.id)}
              className={`flex flex-col items-center gap-2 min-w-[72px] cursor-pointer transition-opacity ${
                account.isActive ? 'opacity-100' : 'opacity-50 hover:opacity-80'
              }`}
            >
              <div className={`relative p-0.5 rounded-full ${account.isActive ? 'bg-gradient-to-tr from-[#a8c7fa] to-purple-400' : 'bg-transparent'}`}>
                {account.avatar ? (
                  <img src={account.avatar} alt={account.name} className="w-14 h-14 rounded-full border-2 border-[#1e1f20]" />
                ) : (
                  <div className="w-14 h-14 rounded-full border-2 border-[#1e1f20] bg-gray-700 flex items-center justify-center text-xl font-bold">
                    {account.name.charAt(0)}
                  </div>
                )}
                {account.isActive && (
                  <div className="absolute bottom-0 right-0 bg-[#a8c7fa] text-[#062e6f] rounded-full p-0.5 border-2 border-[#1e1f20]">
                    <span className="material-symbols-rounded text-[14px] block">check</span>
                  </div>
                )}
              </div>
              <span className="text-xs font-medium text-center truncate w-full">{account.name}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2 min-w-[72px] cursor-pointer opacity-50 hover:opacity-80" onClick={onOpenPricing}>
            <div className="w-14 h-14 rounded-full border border-dashed border-[#8e918f] flex items-center justify-center text-[#8e918f] hover:bg-[#2b2c2f] transition-colors">
              <span className="material-symbols-rounded">add</span>
            </div>
            <span className="text-xs font-medium text-center">Upgrade</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto w-full">
        <section>
          <h3 className="text-[#a8c7fa] font-bold text-lg mb-3">Authentication</h3>
          <div className="bg-[#1e1f20] rounded-2xl p-5 border border-[#444746]/50">
            {!supabaseConfigured && (
              <p className="text-xs text-[#fca5a5] mb-3">
                Supabase env не настроен. Укажите ключи в `.env.local`.
              </p>
            )}

            {authError && (
              <p className="text-xs text-[#fca5a5] mb-3">{authError}</p>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#8e918f] uppercase tracking-wider mb-1">Session</p>
                <p className="text-sm text-[#e3e3e3]">
                  {authUser ? authUser.email : 'Not authenticated'}
                </p>
              </div>
              {authUser ? (
                <button
                  onClick={() => void onSignOut()}
                  disabled={authActionLoading}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-[#2b2c2f] border border-[#444746] text-[#c4c7c5] hover:bg-[#303134] disabled:opacity-50"
                >
                  Sign out
                </button>
              ) : (
                <button
                  onClick={() => void onGoogleSignIn()}
                  disabled={!supabaseConfigured || authActionLoading}
                  className="px-4 py-2 rounded-full text-xs font-bold bg-[#a8c7fa] text-[#062e6f] hover:bg-[#8ab4f8] disabled:opacity-50"
                >
                  Continue with Google
                </button>
              )}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[#a8c7fa] font-bold text-lg mb-3">General</h3>
          <div className="bg-[#1e1f20] rounded-2xl overflow-hidden border border-[#444746]/50">
            <div className="p-4 flex items-center justify-between border-b border-[#444746]/50">
              <div className="flex items-center gap-3">
                <span className="material-symbols-rounded text-[#c4c7c5]">language</span>
                <span>Language / Язык</span>
              </div>
              <div className="flex bg-[#111111] rounded-lg p-1">
                <button
                  onClick={() => updateSettings({ language: 'en' })}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    settings.language === 'en' ? 'bg-[#2b2c2f] text-[#e3e3e3] shadow-sm' : 'text-[#8e918f]'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => updateSettings({ language: 'ru' })}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    settings.language === 'ru' ? 'bg-[#2b2c2f] text-[#e3e3e3] shadow-sm' : 'text-[#8e918f]'
                  }`}
                >
                  RU
                </button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-between border-b border-[#444746]/50">
              <div className="flex items-center gap-3">
                <span className="material-symbols-rounded text-[#c4c7c5]">contrast</span>
                <span>Theme</span>
              </div>
              <div className="flex bg-[#111111] rounded-lg p-1">
                <button
                  onClick={() => updateSettings({ theme: 'light' })}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    settings.theme === 'light' ? 'bg-[#e3e3e3] text-black shadow-sm' : 'text-[#8e918f]'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => updateSettings({ theme: 'dark' })}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                    settings.theme === 'dark' ? 'bg-[#2b2c2f] text-[#e3e3e3] shadow-sm' : 'text-[#8e918f]'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-rounded text-[#c4c7c5]">shield</span>
                <span>Strict noise filter</span>
              </div>
              <button
                onClick={() => updateSettings({ strictNoiseFilter: !settings.strictNoiseFilter })}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                  settings.strictNoiseFilter ? 'bg-[#a8c7fa] text-[#062e6f]' : 'bg-[#111111] text-[#8e918f]'
                }`}
              >
                {settings.strictNoiseFilter ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[#a8c7fa] font-bold text-lg mb-3">Subscription</h3>
          <div className="bg-gradient-to-r from-[#2b2c2f] to-[#1e1f20] rounded-2xl p-5 border border-[#444746]/50 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#8e918f] uppercase tracking-wider mb-1">Current Plan</p>
              <h4 className="text-xl font-bold text-white">{currentPlan.type} Plan</h4>
              <p className="text-xs text-[#c4c7c5] mt-1">${currentPlan.price.toFixed(2)}/mo • up to {accountLimit} accounts</p>
            </div>
            <button
              onClick={onOpenPricing}
              className="bg-[#a8c7fa] text-[#062e6f] px-4 py-2 rounded-full text-sm font-bold hover:bg-[#8ab4f8] transition-colors"
            >
              Manage
            </button>
          </div>
        </section>

        <section>
          <h3 className="text-[#a8c7fa] font-bold text-lg mb-3">AI Intelligence</h3>
          <div className="bg-[#1e1f20] rounded-2xl p-5 border border-[#444746]/50 space-y-6">
            <div>
              <label className="text-sm text-[#c4c7c5] font-medium block mb-3">AI Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'gemini', label: 'Gemini (Main)' },
                  { id: 'groq', label: 'Groq (Text style)' },
                ].map((provider) => (
                  <button
                    key={provider.id}
                    onClick={() => updateSettings({ aiProvider: provider.id as AppSettings['aiProvider'] })}
                    className={`py-3 rounded-xl border transition-all ${
                      settings.aiProvider === provider.id
                        ? 'bg-[#004a77] border-[#004a77] text-[#c2e7ff]'
                        : 'bg-[#111111] border-[#444746] text-[#8e918f] hover:bg-[#2b2c2f]'
                    }`}
                  >
                    <span className="text-xs font-medium">{provider.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-[#c4c7c5] font-medium block mb-3">AI Personality Style</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'strict', label: 'Strict', icon: 'gavel' },
                  { id: 'human', label: 'Human-like', icon: 'face' },
                  { id: 'humor', label: 'Humorous', icon: 'sentiment_very_satisfied' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => updateSettings({ aiStyle: style.id as AppSettings['aiStyle'] })}
                    className={`flex flex-col items-center gap-2 py-3 rounded-xl border transition-all ${
                      settings.aiStyle === style.id
                        ? 'bg-[#004a77] border-[#004a77] text-[#c2e7ff]'
                        : 'bg-[#111111] border-[#444746] text-[#8e918f] hover:bg-[#2b2c2f]'
                    }`}
                  >
                    <span className="material-symbols-rounded">{style.icon}</span>
                    <span className="text-xs font-medium">{style.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  key: 'autoAnalyzeOnOpen',
                  label: 'Analyze latest 10 on open',
                  enabled: settings.autoAnalyzeOnOpen,
                  available: true,
                },
                {
                  key: 'autoReply',
                  label: 'Auto reply',
                  enabled: settings.autoReply,
                  available: currentPlan.limits.autoReply,
                },
                {
                  key: 'autoSignature',
                  label: 'Auto signature',
                  enabled: settings.autoSignature,
                  available: currentPlan.limits.autoSignature,
                },
                {
                  key: 'autoDate',
                  label: 'Auto date',
                  enabled: settings.autoDate,
                  available: currentPlan.limits.autoDate,
                },
                {
                  key: 'autoLogo',
                  label: 'Auto PNG/SVG logo',
                  enabled: settings.autoLogo,
                  available: currentPlan.limits.autoLogo,
                },
              ].map((toggle) => (
                <button
                  key={toggle.key}
                  onClick={() =>
                    toggle.available &&
                    updateSettings({
                      [toggle.key]: !toggle.enabled,
                    } as Partial<AppSettings>)
                  }
                  className={`text-left px-3 py-3 rounded-xl border text-xs transition-all ${
                    !toggle.available
                      ? 'bg-[#151617] border-[#2b2c2f] text-[#5f6368] cursor-not-allowed'
                      : toggle.enabled
                      ? 'bg-[#004a77] border-[#004a77] text-[#c2e7ff]'
                      : 'bg-[#111111] border-[#444746] text-[#c4c7c5] hover:bg-[#2b2c2f]'
                  }`}
                >
                  <div className="font-medium">{toggle.label}</div>
                  {!toggle.available && <div className="text-[10px] mt-1">Enterprise only</div>}
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm text-[#c4c7c5] font-medium block mb-2">Custom AI System Prompt</label>
              <textarea
                value={settings.customPrompt}
                onChange={(event) => updateSettings({ customPrompt: event.target.value })}
                placeholder="e.g. Keep replies brief and focused on account recovery..."
                className="w-full bg-[#111111] border border-[#444746] rounded-xl p-3 text-sm text-[#e3e3e3] focus:border-[#a8c7fa] focus:outline-none min-h-[80px]"
              ></textarea>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[#a8c7fa] font-bold text-lg mb-3">Branding</h3>
          <div className="bg-[#1e1f20] rounded-2xl p-5 border border-[#444746]/50">
            <div className="flex items-start gap-4">
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-[#444746] flex flex-col items-center justify-center cursor-pointer hover:bg-[#2b2c2f] transition-colors relative overflow-hidden">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <>
                    <span className="material-symbols-rounded text-[#8e918f]">upload</span>
                    <span className="text-[10px] text-[#8e918f] mt-1">Logo</span>
                  </>
                )}
                <input type="file" accept="image/png, image/jpeg, image/svg+xml" className="hidden" onChange={handleLogoUpload} />
              </label>

              <div className="flex-1">
                <p className="text-sm font-medium text-[#e3e3e3]">Company Logo</p>
                <p className="text-xs text-[#8e918f] mt-1 mb-3">Automatically attaches to AI drafts on Enterprise.</p>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#c4c7c5]">Position:</span>
                  <button
                    onClick={() => updateSettings({ logoPosition: 'start' })}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                      settings.logoPosition === 'start' ? 'bg-[#a8c7fa] text-[#062e6f]' : 'bg-[#111111] text-[#8e918f]'
                    }`}
                  >
                    Start
                  </button>
                  <button
                    onClick={() => updateSettings({ logoPosition: 'end' })}
                    className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                      settings.logoPosition === 'end' ? 'bg-[#a8c7fa] text-[#062e6f]' : 'bg-[#111111] text-[#8e918f]'
                    }`}
                  >
                    End
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="h-10"></div>
      </div>
    </div>
  );
};

export default SettingsView;
