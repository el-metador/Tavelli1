import React from 'react';
import { PlanType } from '../types';

interface PricingViewProps {
  currentPlanType: PlanType;
  onSelectPlan: (plan: PlanType) => void;
  onBackToMail: () => void;
}

const PricingView: React.FC<PricingViewProps> = ({
  currentPlanType,
  onSelectPlan,
  onBackToMail,
}) => {
  const tiers: Array<{
    type: PlanType;
    price: string;
    period: string;
    features: string[];
    accent: string;
  }> = [
    {
      type: 'FREE',
      price: '$0',
      period: '/mo',
      features: [
        'Basic AI filtering',
        'System hide emails older than 7 days',
        '1 account',
      ],
      accent: 'border-[#444746] bg-[#1e1f20]',
    },
    {
      type: 'PRO',
      price: '$4.50',
      period: '/mo',
      features: [
        '3 linked accounts',
        'Hot actions from latest 10 emails',
        'Priority verification extraction',
        'AI draft replies',
      ],
      accent: 'border-[#0b57d0]/50 bg-[#0b57d0]/10',
    },
    {
      type: 'ENTERPRISE',
      price: '$10.00',
      period: '/mo',
      features: [
        '10 linked business accounts',
        'Deep mailbox analysis',
        'Auto-signature + auto-date',
        'Auto PNG/SVG company logo',
        'AI auto-reply controls',
      ],
      accent: 'border-[#7b61ff]/50 bg-[#7b61ff]/10',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111111] overflow-y-auto pb-24 text-[#e3e3e3]">
      <div className="bg-[#1e1f20] pt-6 pb-4 px-4 sticky top-0 z-10 border-b border-[#444746]/50">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Тарифы Tavelli</h2>
          <button
            onClick={onBackToMail}
            className="text-xs px-3 py-1.5 rounded-full border border-[#444746] text-[#c4c7c5] hover:bg-[#2b2c2f]"
          >
            К почте
          </button>
        </div>
        <p className="text-xs text-[#8e918f] mt-2">Выберите план для нужного количества аккаунтов и функций ИИ.</p>
      </div>

      <div className="p-4 space-y-4 max-w-5xl mx-auto w-full">
        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const isCurrent = currentPlanType === tier.type;
            return (
              <div
                key={tier.type}
                className={`rounded-2xl border p-5 ${tier.accent} ${
                  isCurrent ? 'ring-1 ring-[#a8c7fa]' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs tracking-widest uppercase text-[#8e918f]">{tier.type}</h3>
                  {isCurrent && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#a8c7fa] text-[#062e6f]">
                      Current
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold">{tier.price}</span>
                  <span className="text-xs text-[#8e918f]">{tier.period}</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="text-sm text-[#c4c7c5] flex items-start gap-2">
                      <span className="material-symbols-rounded text-[16px] text-[#a8c7fa] mt-0.5">check_circle</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onSelectPlan(tier.type)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    isCurrent
                      ? 'bg-[#2b2c2f] text-[#8e918f] cursor-default'
                      : 'bg-[#a8c7fa] text-[#062e6f] hover:bg-[#8ab4f8]'
                  }`}
                >
                  {isCurrent ? 'Активен' : `Выбрать ${tier.type}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PricingView;
