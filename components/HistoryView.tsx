import React, { useEffect, useState } from 'react';
import { HistoryItem } from '../types';
import * as api from '../services/api';

const HistoryView: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const data = await api.getHistory();
      setHistoryItems(data);
      setLoading(false);
    };
    fetchHistory();
  }, []);

  if (loading) {
    return <div className="p-4 text-[#8e918f]">Loading history...</div>;
  }

  if (historyItems.length === 0) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#111111] items-center justify-center text-[#8e918f]">
         <span className="material-symbols-rounded text-6xl mb-4 opacity-20">history</span>
         <p>No AI actions recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111111] overflow-y-auto pb-24">
      <div className="px-4 py-4 sticky top-0 z-10 bg-[#111111]/95 backdrop-blur-md border-b border-[#444746]/50">
        <h2 className="text-xl font-bold text-[#e3e3e3]">AI History</h2>
        <p className="text-xs text-[#8e918f]">Recent automated actions</p>
      </div>

      <div className="divide-y divide-[#444746]/30">
        {historyItems.map((item) => (
          <div key={item.id} className="p-4 hover:bg-[#1e1f20] transition-colors cursor-pointer group">
            <div className="flex gap-4">
              {/* Timeline / Avatar Column */}
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg ${
                   item.actionType === 'reply' ? 'bg-gradient-to-br from-blue-600 to-blue-800' : 
                   item.actionType === 'action' ? 'bg-gradient-to-br from-green-600 to-green-800' : 
                   item.actionType === 'analysis' ? 'bg-gradient-to-br from-indigo-600 to-indigo-800' :
                   'bg-gradient-to-br from-purple-600 to-purple-800'
                 }`}>
                   <span className="material-symbols-rounded text-lg">
                     {item.actionType === 'reply' ? 'send' : item.actionType === 'action' ? 'bolt' : item.actionType === 'analysis' ? 'analytics' : 'summarize'}
                   </span>
                 </div>
                 <div className="w-0.5 h-full bg-[#444746]/30 mt-2 rounded-full group-last:hidden"></div>
              </div>

              {/* Content Column */}
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between mb-1">
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-[#e3e3e3] text-[15px]">Tavelli AI</span>
                     <span className="material-symbols-rounded text-blue-400 text-[14px] filled-icon">verified</span>
                     <span className="text-[#8e918f] text-sm">@ai_assistant</span>
                     <span className="text-[#8e918f] text-sm">·</span>
                     <span className="text-[#8e918f] text-sm hover:underline">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                   </div>
                   <button className="text-[#8e918f] hover:bg-[#a8c7fa]/10 p-1.5 rounded-full transition-colors">
                     <span className="material-symbols-rounded text-[18px]">more_horiz</span>
                   </button>
                </div>

                <p className="text-[#e3e3e3] text-[15px] leading-relaxed whitespace-pre-wrap mb-2">
                  {item.description}
                </p>

                {/* Card Embed for Context */}
                <div className="border border-[#444746]/50 rounded-xl p-3 bg-[#111111] mt-2 hover:border-[#444746] transition-colors">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-rounded text-sm text-[#8e918f]">mail</span>
                      <span className="text-sm font-medium text-[#c4c7c5]">{item.targetEmail}</span>
                   </div>
                   {item.aiStyle && (
                     <span className="inline-block bg-[#2b2c2f] text-[#a8c7fa] text-xs px-2 py-0.5 rounded border border-[#444746] mt-1">
                        Style: {item.aiStyle}
                     </span>
                   )}
                </div>

              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryView;
