import React from 'react';
import { PlanType } from '../types';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: PlanType) => void;
  currentPlanType: PlanType;
}

const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  onSelectPlan,
  currentPlanType,
}) => {
  if (!isOpen) return null;

  const tiers: Array<{
    type: PlanType;
    price: string;
    period: string;
    features: string[];
    accent: {
      text: string;
      border: string;
      ring: string;
      bg: string;
      button: string;
      buttonHover: string;
      badge: string;
      icon: string;
    };
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
      accent: {
        text: 'text-gray-600',
        border: 'border-gray-300',
        ring: 'ring-gray-400',
        bg: 'bg-gray-50/30',
        button: 'bg-gray-100 text-gray-800',
        buttonHover: 'hover:bg-gray-200',
        badge: 'bg-gray-600',
        icon: 'text-gray-500',
      },
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
      accent: {
        text: 'text-blue-600',
        border: 'border-blue-500',
        ring: 'ring-blue-500',
        bg: 'bg-blue-50/30',
        button: 'bg-blue-600 text-white',
        buttonHover: 'hover:bg-blue-700',
        badge: 'bg-blue-600',
        icon: 'text-blue-500',
      },
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
      accent: {
        text: 'text-purple-600',
        border: 'border-purple-500',
        ring: 'ring-purple-500',
        bg: 'bg-purple-50/30',
        button: 'bg-purple-600 text-white',
        buttonHover: 'hover:bg-purple-700',
        badge: 'bg-purple-600',
        icon: 'text-purple-500',
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden relative z-10 flex flex-col md:flex-row">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full z-20">
          <span className="material-symbols-rounded">close</span>
        </button>

        <div className="p-8 md:p-12 w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Upgrade Tavelli</h2>
            <p className="text-gray-500">Gemini-first smart mail with Groq text style support.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {tiers.map((tier) => {
              const isCurrent = currentPlanType === tier.type;
              return (
                <div
                  key={tier.type}
                  className={`relative p-6 rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                    isCurrent
                      ? `${tier.accent.border} ring-1 ${tier.accent.ring} ${tier.accent.bg}`
                      : 'border-gray-200 hover:shadow-xl hover:border-transparent'
                  }`}
                >
                  {isCurrent && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white ${tier.accent.badge}`}>
                      CURRENT
                    </div>
                  )}
                  <div className="text-center mb-6">
                    <h3 className={`text-sm font-bold uppercase tracking-widest ${tier.accent.text} mb-2`}>{tier.type}</h3>
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">{tier.price}</span>
                      <span className="text-gray-500 text-sm">{tier.period}</span>
                    </div>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className={`material-symbols-rounded text-sm ${tier.accent.icon}`}>check_circle</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => {
                      onSelectPlan(tier.type);
                      onClose();
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
                      isCurrent ? 'bg-gray-200 text-gray-700 cursor-default' : `${tier.accent.button} ${tier.accent.buttonHover}`
                    }`}
                    disabled={isCurrent}
                  >
                    {isCurrent ? 'Active Plan' : `Choose ${tier.type}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingModal;
