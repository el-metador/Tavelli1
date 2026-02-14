import React, { useEffect, useMemo, useState } from 'react';
import { AIActionButton, AIAnalysisResult, AIProvider, Email, PlanType } from '../types';
import { analyzeEmail, generateDraft } from '../services/gemini';

interface EmailViewProps {
  email: Email;
  onBack: () => void;
  aiProvider: AIProvider;
  customPrompt: string;
  planType: PlanType;
  autoSignature: boolean;
  autoDate: boolean;
  autoLogo: boolean;
  logoUrl: string | null;
  onTrackAction: (action: 'reply' | 'summary' | 'action', details: string) => Promise<void> | void;
}

const Icons = {
  Sparkles: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  ),
  Copy: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  ),
  Check: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  Link: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  ),
  Summarize: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  ),
  Draft: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  ),
};

const HotActionButton: React.FC<{
  btn: AIActionButton;
  onClick: (btn: AIActionButton) => Promise<void>;
}> = ({ btn, onClick }) => {
  const [isPressed, setIsPressed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handlePress = async () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);

    if (status !== 'idle') return;

    setStatus('loading');
    await onClick(btn);

    if (btn.type === 'copy_code') {
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setStatus('idle');
    }
  };

  let Icon = Icons.Sparkles;
  if (status === 'success') Icon = Icons.Check;
  else if (btn.type === 'copy_code') Icon = Icons.Copy;
  else if (btn.type === 'verify_link') Icon = Icons.Link;
  else if (btn.type === 'summarize') Icon = Icons.Summarize;
  else if (btn.type === 'draft_reply' || btn.type === 'appeal_reply') Icon = Icons.Draft;

  const springStyle = {
    transform: isPressed ? 'scale(0.92)' : 'scale(1)',
    transition:
      'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background-color 0.2s ease, color 0.2s ease',
  };

  const baseClasses =
    'relative flex items-center justify-center gap-2.5 px-5 py-3 rounded-[18px] text-[15px] font-semibold select-none cursor-pointer overflow-hidden';
  const colorClasses = btn.primary
    ? status === 'success'
      ? 'bg-green-500 text-white border border-transparent'
      : 'bg-[#a8c7fa] text-[#062e6f] border border-transparent hover:bg-[#8ab4f8]'
    : 'bg-[#2b2c2f]/80 backdrop-blur-md border border-[#5e5e5e]/50 text-[#e3e3e3] hover:bg-[#37393d]';

  return (
    <button style={springStyle} onClick={handlePress} className={`${baseClasses} ${colorClasses}`}>
      <span className={`transition-all duration-300 ${status === 'loading' ? 'animate-spin' : ''}`}>
        {status === 'loading' && btn.type !== 'copy_code' ? (
          <svg className="animate-spin -ml-1 mr-0 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <Icon />
        )}
      </span>
      <span>{status === 'success' ? 'Copied!' : btn.label}</span>
    </button>
  );
};

const EmailView: React.FC<EmailViewProps> = ({
  email,
  onBack,
  aiProvider,
  customPrompt,
  planType,
  autoSignature,
  autoDate,
  autoLogo,
  logoUrl,
  onTrackAction,
}) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState('');

  const automationEnabled = useMemo(
    () => planType === 'ENTERPRISE' && (autoSignature || autoDate || autoLogo),
    [planType, autoSignature, autoDate, autoLogo]
  );

  const applyEnterpriseAutomation = (text: string): string => {
    if (!automationEnabled) return text;

    const parts = [text.trim()];

    if (autoDate) {
      parts.push(`Date: ${new Date().toLocaleDateString()}`);
    }

    if (autoSignature) {
      parts.push('Best regards,\nSent via Tavelli Enterprise AI');
    }

    if (autoLogo && logoUrl) {
      parts.push(`[Company logo] ${logoUrl}`);
    }

    return parts.join('\n\n');
  };

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setAnalysis(null);
    setDrafting(null);
    setGeneratedText('');

    analyzeEmail(email, {
      provider: aiProvider,
      customPrompt,
      planType,
      accountId: email.accountId || 'default',
    })
      .then((result) => {
        if (cancelled) return;
        setAnalysis(result);
      })
      .catch((error) => {
        console.error('Analyze error', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email, aiProvider, customPrompt, planType]);

  const handleAction = async (btn: AIActionButton) => {
    if (btn.type === 'copy_code') {
      try {
        await navigator.clipboard.writeText(btn.value);
        await onTrackAction('action', `Copied verification code ${btn.value}`);
      } catch {
        await onTrackAction('action', `Copy failed for code ${btn.value}`);
      }
      return;
    }

    if (btn.type === 'verify_link') {
      window.open(btn.value, '_blank', 'noopener,noreferrer');
      await onTrackAction('action', `Opened verification link: ${btn.value}`);
      return;
    }

    if (btn.type === 'summarize') {
      setDrafting('summary');
      setGeneratedText(analysis?.summary || 'No summary available.');
      await onTrackAction('summary', 'Generated quick summary in composer');
      return;
    }

    if (btn.type === 'draft_reply' || btn.type === 'appeal_reply') {
      setDrafting(btn.value);
      setGeneratedText('AI is writing...');

      const tone = btn.value;
      const text = await generateDraft(email, tone, aiProvider, planType);
      setGeneratedText(applyEnterpriseAutomation(text));
      await onTrackAction('reply', `Generated draft with tone: ${tone}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111111] md:rounded-2xl md:ml-2 md:my-2 md:border md:border-[#444746] relative text-[#e3e3e3] overflow-hidden">
      <div className="h-16 flex items-center px-2 gap-2 bg-[#111111] sticky top-0 z-10 border-b border-[#444746]/50">
        <button onClick={onBack} className="p-3 rounded-full hover:bg-[#2b2c2f] text-[#e3e3e3] active:bg-[#303134]">
          <span className="material-symbols-rounded">arrow_back</span>
        </button>
        <div className="flex-1"></div>
        <button className="p-3 text-[#c4c7c5] hover:bg-[#2b2c2f] rounded-full" title="Archive">
          <span className="material-symbols-rounded">archive</span>
        </button>
        <button className="p-3 text-[#c4c7c5] hover:bg-[#2b2c2f] rounded-full" title="Delete">
          <span className="material-symbols-rounded">delete</span>
        </button>
        <button className="p-3 text-[#c4c7c5] hover:bg-[#2b2c2f] rounded-full" title="Mark Unread">
          <span className="material-symbols-rounded">mail</span>
        </button>
        <button className="p-3 text-[#c4c7c5] hover:bg-[#2b2c2f] rounded-full" title="More">
          <span className="material-symbols-rounded">more_vert</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-32">
        <div className="mb-6 flex justify-between items-start gap-4">
          <h1 className="text-[22px] md:text-2xl font-normal text-[#e3e3e3] leading-snug flex-1">
            {email.subject}
            <span className="inline-block ml-2 align-middle bg-[#2b2c2f] text-xs px-2 py-0.5 rounded text-[#c4c7c5]">Inbox</span>
          </h1>
          <button className="text-[#c4c7c5] mt-1">
            <span className="material-symbols-rounded">star_border</span>
          </button>
        </div>

        <div className="flex items-start gap-3 mb-8 cursor-pointer group">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-blue-700 text-lg">{email.senderName.charAt(0)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-baseline gap-0 md:gap-2">
              <span className="font-bold text-[#e3e3e3] text-base truncate">{email.senderName}</span>
              <span className="text-sm text-[#c4c7c5] truncate">&lt;{email.senderEmail}&gt;</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-[#c4c7c5] mt-0.5">
              <span>to me</span>
              <span className="material-symbols-rounded text-[16px]">expand_more</span>
            </div>
          </div>
          <div className="text-sm text-[#c4c7c5] whitespace-nowrap">{new Date(email.date).toLocaleDateString()}</div>
        </div>

        <div className="mb-8 rounded-[24px] bg-[#1e1f20] border border-[#444746]/50 overflow-hidden shadow-xl">
          <div className="p-5 bg-gradient-to-br from-[#1e1f20] via-[#1e1f20] to-[#25272b]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {loading ? (
                  <span className="material-symbols-rounded text-[#a8c7fa] animate-spin">progress_activity</span>
                ) : (
                  <Icons.Sparkles />
                )}
                <span className="text-[13px] font-bold text-[#a8c7fa] uppercase tracking-widest">Tavelli AI</span>
              </div>
              <span className="text-[11px] text-[#8e918f] uppercase">{aiProvider}</span>
            </div>

            {loading ? (
              <div className="space-y-3 max-w-sm animate-pulse">
                <div className="h-3 bg-[#444746] rounded w-full"></div>
                <div className="h-3 bg-[#444746] rounded w-2/3"></div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <p className="text-[#e3e3e3] mb-6 text-[16px] leading-relaxed font-light tracking-wide">{analysis?.summary}</p>

                <div className="flex flex-wrap gap-3">
                  {analysis?.actionButtons.map((btn, idx) => (
                    <HotActionButton key={idx} btn={btn} onClick={handleAction} />
                  ))}
                </div>

                {analysis?.replyOptions && analysis.replyOptions.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {analysis.replyOptions.map((option, idx) => (
                      <button
                        key={`${option}-${idx}`}
                        onClick={async () => {
                          setDrafting('manual');
                          const text = await generateDraft(
                            email,
                            idx === 0 ? 'polite_appeal' : 'clarify_reason',
                            aiProvider,
                            planType
                          );
                          setGeneratedText(applyEnterpriseAutomation(text));
                          await onTrackAction('reply', `Generated quick option: ${option}`);
                        }}
                        className="text-xs px-3 py-2 rounded-full bg-[#2b2c2f] border border-[#444746] text-[#c4c7c5] hover:bg-[#303134]"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#111111] text-[#e3e3e3]">
          <div
            className="prose prose-invert max-w-none prose-p:text-[#e3e3e3] prose-a:text-[#a8c7fa] prose-headings:text-[#e3e3e3] text-[15px] leading-relaxed font-light"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />
        </div>

        {drafting && (
          <div className="mt-8 border-t border-[#444746] pt-6 animate-fade-in-up">
            <h3 className="text-sm font-medium text-[#c4c7c5] mb-4 flex items-center gap-2">
              <Icons.Draft />
              AI Draft ({drafting === 'polite_appeal' ? 'Polite appeal' : drafting === 'clarify_reason' ? 'Clarify reason' : drafting === 'summary' ? 'Summary' : 'Standard'})
            </h3>
            <div className="bg-[#1e1f20] rounded-2xl p-4 border border-[#444746] focus-within:border-[#a8c7fa] transition-colors">
              <textarea
                className="w-full bg-transparent border-none focus:ring-0 text-[#e3e3e3] min-h-[120px] resize-none placeholder-[#8e918f]"
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                placeholder="Compose your reply..."
              ></textarea>
              <div className="flex justify-end gap-3 mt-2">
                <button
                  onClick={() => setDrafting(null)}
                  className="px-4 py-2 text-[#c4c7c5] font-medium hover:bg-[#303134] rounded-full text-sm transition-colors"
                >
                  Discard
                </button>
                <button className="px-6 py-2 bg-[#a8c7fa] text-[#062e6f] font-bold rounded-full hover:bg-[#8ab4f8] flex items-center gap-2 text-sm shadow-lg shadow-blue-900/20">
                  <span className="material-symbols-rounded text-[18px]">send</span>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!drafting && (
        <div className="absolute bottom-0 left-0 right-0 bg-[#1e1f20] border-t border-[#444746] p-3 px-4 flex items-center gap-3 md:rounded-b-2xl backdrop-blur-md bg-opacity-95">
          <button
            className="flex-1 bg-[#111111] hover:bg-[#303134] border border-[#444746] rounded-full py-3 text-sm text-[#c4c7c5] flex items-center gap-3 px-4 transition-colors text-left group"
            onClick={async () => {
              setDrafting('manual');
              const text = await generateDraft(email, 'manual', aiProvider, planType);
              setGeneratedText(applyEnterpriseAutomation(text));
              await onTrackAction('reply', 'Generated manual quick draft');
            }}
          >
            <span className="material-symbols-rounded text-[20px] group-hover:text-[#a8c7fa] transition-colors">reply</span>
            Reply
          </button>
          <button className="flex-1 bg-[#111111] hover:bg-[#303134] border border-[#444746] rounded-full py-3 text-sm text-[#c4c7c5] flex items-center gap-3 px-4 transition-colors text-left group">
            <span className="material-symbols-rounded text-[20px] group-hover:text-[#a8c7fa] transition-colors">reply_all</span>
            Reply all
          </button>
          <button className="bg-[#111111] hover:bg-[#303134] border border-[#444746] rounded-full p-3 text-[#c4c7c5] flex items-center justify-center transition-colors group">
            <span className="material-symbols-rounded text-[20px] group-hover:text-[#a8c7fa] transition-colors">forward</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default EmailView;
