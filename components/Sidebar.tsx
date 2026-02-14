import React from 'react';
import { UserPlan } from '../types';

interface SidebarProps {
  currentPlan: UserPlan;
  activeTab: 'primary' | 'inbox';
  setActiveTab: (tab: 'primary' | 'inbox') => void;
  onOpenPricing: () => void;
  isOpen: boolean;
  onClose: () => void;
  primaryCount: number;
  inboxCount: number;
  activeAccountName: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentPlan,
  activeTab,
  setActiveTab,
  onOpenPricing,
  isOpen,
  onClose,
  primaryCount,
  inboxCount,
  activeAccountName,
}) => {
  const navItems: Array<{ id: 'primary' | 'inbox'; icon: string; label: string; count: number }> = [
    { id: 'primary', icon: 'inbox', label: 'Общий', count: primaryCount },
    { id: 'inbox', icon: 'all_inbox', label: 'Все', count: inboxCount },
  ];

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      ></div>

      <div
        className={`fixed inset-y-0 left-0 z-50 w-[300px] bg-[#1e1f20] text-[#e3e3e3] transform transition-transform duration-300 cubic-bezier(0.2, 0, 0, 1) md:translate-x-0 md:static md:flex md:flex-col md:w-64 border-r border-[#111111] shadow-2xl md:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-5 min-h-[64px]">
          <div>
            <span className="text-xl font-medium text-[#e3e3e3] tracking-tight block">Tavelli</span>
            <span className="text-[10px] text-[#8e918f]">{activeAccountName}</span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-900 text-purple-200 font-bold border border-purple-700">BETA</span>
        </div>

        <div className="flex-1 py-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                onClose();
              }}
              className={`w-[95%] ml-auto rounded-l-full flex items-center justify-between px-6 py-3 mb-1 transition-all group ${
                activeTab === item.id
                  ? 'bg-[#3c4043] text-[#a8c7fa]'
                  : 'text-[#c4c7c5] hover:bg-[#2b2c2f]'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`material-symbols-rounded text-[20px] ${activeTab === item.id ? 'filled-icon' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-sm ${activeTab === item.id ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
              </div>
              {item.count > 0 && (
                <span className={`text-xs ${activeTab === item.id ? 'text-[#a8c7fa] font-bold' : 'text-[#8e918f]'}`}>
                  {item.count > 99 ? '99+' : item.count}
                </span>
              )}
            </button>
          ))}

          <div className="my-3 border-t border-[#444746]/50 mx-4"></div>

          <div className="px-6 py-2">
            <h3 className="text-xs font-medium text-[#8e918f] uppercase tracking-wider mb-3 px-2">Labels</h3>
            <button className="flex items-center gap-4 py-3 text-[#c4c7c5] w-full hover:bg-[#2b2c2f] rounded-r-full -ml-6 px-6 transition-colors">
              <span className="material-symbols-rounded text-[20px]">add</span>
              <span className="text-sm font-medium">Create new</span>
            </button>
            <button className="flex items-center gap-4 py-3 text-[#c4c7c5] w-full hover:bg-[#2b2c2f] rounded-r-full -ml-6 px-6 transition-colors">
              <span className="material-symbols-rounded text-[20px]">settings</span>
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-[#444746]/50 bg-[#1e1f20]">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8e918f]">
              Plan: <span className="text-[#e3e3e3]">{currentPlan.type}</span>
            </span>
            <button
              onClick={onOpenPricing}
              className="text-xs text-[#062e6f] bg-[#a8c7fa] hover:bg-[#8ab4f8] px-3 py-1.5 rounded-full font-bold transition-colors"
            >
              Upgrade
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
