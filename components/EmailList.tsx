import React from 'react';
import { Email, EmailCategory, LastTenAnalysis } from '../types';

interface EmailListProps {
  emails: Email[];
  onSelectEmail: (email: Email) => void;
  strictMode: boolean;
  setStrictMode: (val: boolean) => void;
  isProcessing: boolean;
  onToggleSidebar: () => void;
  onCompose: () => void;
  hiddenByAge: number;
  hiddenByNoise: number;
  isPreAnalyzing: boolean;
  lastTenAnalysis: LastTenAnalysis | null;
  activeAccountEmail: string;
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  onSelectEmail,
  strictMode,
  setStrictMode,
  isProcessing,
  onToggleSidebar,
  onCompose,
  hiddenByAge,
  hiddenByNoise,
  isPreAnalyzing,
  lastTenAnalysis,
  activeAccountEmail,
}) => {
  const filteredEmails = emails.filter((email) => {
    if (!strictMode) return true;
    return (
      email.category === EmailCategory.IMPORTANT ||
      email.category === EmailCategory.TEMPORARY_IMPORTANT
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111111] relative">
      <div className="px-4 py-3 sticky top-0 z-20 bg-[#111111]/95 backdrop-blur-md">
        <div className="flex items-center bg-[#2b2c2f] rounded-full px-2 pr-4 h-12 shadow-sm transition-colors hover:bg-[#303134]">
          <button onClick={onToggleSidebar} className="p-3 text-gray-200 rounded-full hover:bg-gray-600/20">
            <span className="material-symbols-rounded">menu</span>
          </button>

          <input
            type="text"
            placeholder="Search in mail"
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-200 placeholder-gray-400 text-[16px] px-2"
          />

          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium text-sm border border-purple-400">
            T
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 px-1 gap-2">
          <div>
            <h2 className="text-[#c4c7c5] text-[11px] font-medium uppercase tracking-widest pl-1">All inboxes</h2>
            <p className="text-[11px] text-[#8e918f] mt-1 pl-1 truncate max-w-[220px]">{activeAccountEmail || 'No account selected'}</p>
          </div>

          <button
            onClick={() => setStrictMode(!strictMode)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
              strictMode
                ? 'bg-[#004a77] border-[#004a77] text-[#c2e7ff]'
                : 'bg-transparent border-[#444746] text-[#c4c7c5]'
            }`}
          >
            <span className="material-symbols-rounded text-[16px]">{strictMode ? 'check' : 'filter_list'}</span>
            Strict Mode
          </button>
        </div>

        <div className="mt-2 px-1 flex flex-wrap gap-2">
          <span className="text-[11px] px-2 py-1 rounded-md bg-[#1e1f20] border border-[#444746]/50 text-[#c4c7c5]">
            Hidden by 7-day rule: {hiddenByAge}
          </span>
          <span className="text-[11px] px-2 py-1 rounded-md bg-[#1e1f20] border border-[#444746]/50 text-[#c4c7c5]">
            Hidden noise: {hiddenByNoise}
          </span>
          <span className="text-[11px] px-2 py-1 rounded-md bg-[#1e1f20] border border-[#444746]/50 text-[#a8c7fa]">
            {isPreAnalyzing ? 'Analyzing latest 10...' : 'Latest 10 analyzed'}
          </span>
        </div>

        {lastTenAnalysis && lastTenAnalysis.hotActions.length > 0 && (
          <div className="mt-2 px-1 flex flex-wrap gap-2">
            {lastTenAnalysis.hotActions.slice(0, 3).map((action, idx) => (
              <span key={`${action.type}-${action.value}-${idx}`} className="text-[11px] px-2 py-1 rounded-full bg-[#2b2c2f] text-[#c2e7ff] border border-[#444746]/50">
                {action.label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-24 px-1">
        {isProcessing ? (
          <div className="px-3 pt-4 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((line) => (
              <div key={line} className="bg-[#1e1f20] border border-[#444746]/30 rounded-2xl p-4">
                <div className="h-3 w-1/4 bg-[#444746] rounded mb-3"></div>
                <div className="h-3 w-2/3 bg-[#444746] rounded mb-2"></div>
                <div className="h-3 w-1/2 bg-[#444746] rounded"></div>
              </div>
            ))}
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-[#c4c7c5]">
            <span className="material-symbols-rounded text-6xl mb-4 opacity-20">inbox</span>
            <p>Nothing in strict mode.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredEmails.map((email, index) => {
              const initial = email.senderName.charAt(0).toUpperCase();
              const colors = ['bg-pink-700', 'bg-teal-700', 'bg-slate-600', 'bg-indigo-700', 'bg-emerald-700', 'bg-orange-700'];
              const numericId = Number.parseInt(email.id, 10);
              const colorClass = colors[Number.isNaN(numericId) ? index % colors.length : numericId % colors.length] || 'bg-blue-700';

              const isUnread = !email.isRead;

              return (
                <div
                  key={email.id}
                  onClick={() => onSelectEmail(email)}
                  className={`flex items-start gap-4 p-3 rounded-2xl cursor-pointer transition-colors active:bg-[#303134] md:hover:bg-[#1f1f1f] ${isUnread ? 'bg-[#1e1f20]' : ''}`}
                >
                  <div className={`w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center text-white font-medium text-lg ${colorClass} mt-1`}>
                    {email.logoUrl && !email.logoUrl.includes('random') ? (
                      <img src={email.logoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      initial
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className={`text-[16px] truncate ${isUnread ? 'font-bold text-[#e3e3e3]' : 'font-medium text-[#c4c7c5]'}`}>
                        {email.senderName}
                      </h3>
                      <span className={`text-xs ml-2 whitespace-nowrap ${isUnread ? 'text-[#e3e3e3] font-medium' : 'text-[#8e918f]'}`}>
                        {new Date(email.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className={`text-sm truncate leading-snug mb-0.5 ${isUnread ? 'font-bold text-[#e3e3e3]' : 'font-medium text-[#e3e3e3]'}`}>
                      {email.subject}
                    </h4>

                    <div className="flex justify-between items-start">
                      <p className={`text-sm line-clamp-2 leading-snug flex-1 ${isUnread ? 'text-[#c4c7c5]' : 'text-[#8e918f]'}`}>
                        {email.snippet}
                      </p>
                      <button className="text-[#8e918f] ml-2 mt-0.5">
                        <span className="material-symbols-rounded text-[20px]">star_border</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={onCompose}
        className="fixed right-4 bottom-24 md:absolute md:bottom-8 md:right-8 z-30 bg-[#c2e7ff] hover:bg-[#b0d8f5] text-[#001d35] h-14 min-w-[56px] px-4 rounded-2xl shadow-xl flex items-center gap-3 transition-all active:scale-95 group"
      >
        <span className="material-symbols-rounded text-2xl">edit</span>
        <span className="font-medium text-[15px] hidden group-hover:block md:block">Compose</span>
      </button>
    </div>
  );
};

export default EmailList;
