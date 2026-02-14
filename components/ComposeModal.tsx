import React, { useState } from 'react';
import { AIProvider, PlanType } from '../types';
import { generateNewEmailDraft } from '../services/gemini';
import { sendDraft } from '../services/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiProvider: AIProvider;
  autoSignature: boolean;
  autoDate: boolean;
  activeAccountId: string;
  planType: PlanType;
}

const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  aiProvider,
  autoSignature,
  autoDate,
  activeAccountId,
  planType,
}) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isAiMode, setIsAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isOpen) return null;

  const applyAutomation = (text: string): string => {
    const extras: string[] = [];
    if (autoDate) extras.push(`Date: ${new Date().toLocaleDateString()}`);
    if (autoSignature) extras.push('Best regards,\nSent with Tavelli');

    if (extras.length === 0) return text;
    return `${text.trim()}\n\n${extras.join('\n\n')}`;
  };

  const handleAiDraft = async () => {
    if (!aiPrompt.trim()) return;

    setIsGenerating(true);
    const draft = await generateNewEmailDraft(
      aiPrompt,
      aiProvider,
      planType,
      activeAccountId || 'default'
    );
    setSubject(draft.subject);
    setBody(applyAutomation(draft.body));
    setIsGenerating(false);
    setIsAiMode(false);
  };

  const handleSend = async () => {
    await sendDraft(
      activeAccountId,
      {
        to,
        subject,
        body,
      },
      planType
    );
    alert(`Sent email to ${to || 'recipient'} with provider ${aiProvider}`);
    onClose();
  };

  if (isMinimized) {
    return (
      <div
        className="fixed bottom-0 right-10 z-50 w-64 bg-[#1e1f20] rounded-t-lg border border-[#444746] shadow-2xl cursor-pointer"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center justify-between px-4 py-2 bg-[#2b2c2f] rounded-t-lg">
          <span className="text-sm font-medium text-[#e3e3e3] truncate">{subject || 'New Message'}</span>
          <div className="flex gap-2">
            <button className="text-[#c4c7c5]"><span className="material-symbols-rounded text-[18px]">open_in_full</span></button>
            <button
              className="text-[#c4c7c5]"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
            >
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end sm:px-6 sm:pb-0 pointer-events-none">
      <div className="absolute inset-0 bg-black/40 sm:bg-transparent pointer-events-auto sm:pointer-events-none" onClick={onClose}></div>

      <div className="pointer-events-auto w-full h-full sm:h-auto sm:w-[500px] sm:max-h-[600px] bg-[#1e1f20] sm:rounded-t-xl sm:border sm:border-[#444746] sm:shadow-2xl flex flex-col transition-transform duration-300 transform translate-y-0">
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1f20] sm:bg-[#2b2c2f] sm:rounded-t-xl border-b border-[#444746]/50">
          <div className="flex items-center gap-4 sm:hidden">
            <button onClick={onClose} className="text-[#c4c7c5]">
              <span className="material-symbols-rounded">close</span>
            </button>
            <span className="text-lg font-normal text-[#e3e3e3]">Compose</span>
          </div>
          <span className="text-sm font-medium text-[#e3e3e3] hidden sm:block">New Message</span>

          <div className="flex items-center gap-3">
            <button className="text-[#c4c7c5] sm:hidden"><span className="material-symbols-rounded">attachment</span></button>
            <button onClick={handleSend} className="text-[#c4c7c5] sm:hidden">
              <span className="material-symbols-rounded text-[#a8c7fa]">send</span>
            </button>

            <button onClick={() => setIsMinimized(true)} className="text-[#c4c7c5] hidden sm:block hover:bg-[#444746] rounded-sm p-0.5"><span className="material-symbols-rounded text-[18px]">minimize</span></button>
            <button className="text-[#c4c7c5] hidden sm:block hover:bg-[#444746] rounded-sm p-0.5"><span className="material-symbols-rounded text-[18px]">open_in_full</span></button>
            <button onClick={onClose} className="text-[#c4c7c5] hidden sm:block hover:bg-[#444746] rounded-sm p-0.5"><span className="material-symbols-rounded text-[18px]">close</span></button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto bg-[#1e1f20] relative">
          {isAiMode && (
            <div className="absolute inset-0 z-10 bg-[#1e1f20]/95 backdrop-blur-sm p-6 flex flex-col justify-center animate-fade-in">
              <div className="bg-[#2b2c2f] rounded-2xl p-4 border border-[#444746] shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[#a8c7fa] flex items-center gap-2 font-medium">
                    <span className="material-symbols-rounded">auto_awesome</span>
                    Magic Draft
                  </h3>
                  <button onClick={() => setIsAiMode(false)} className="text-[#c4c7c5]">
                    <span className="material-symbols-rounded">close</span>
                  </button>
                </div>

                <textarea
                  className="w-full bg-[#111111] rounded-xl p-3 text-[#e3e3e3] text-sm border border-[#444746] focus:border-[#a8c7fa] focus:outline-none mb-2 resize-none"
                  rows={3}
                  placeholder="e.g. Ask for project deadline extension because of delayed inputs..."
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  autoFocus
                ></textarea>
                <p className="text-[11px] text-[#8e918f] mb-3">Provider: {aiProvider}</p>

                <button
                  onClick={handleAiDraft}
                  disabled={!aiPrompt || isGenerating}
                  className="w-full py-2 bg-[#a8c7fa] text-[#062e6f] font-bold rounded-full text-sm hover:bg-[#8ab4f8] disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <span className="material-symbols-rounded animate-spin text-sm">progress_activity</span>
                      Drafting...
                    </>
                  ) : (
                    'Generate Draft'
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center px-4 py-3 border-b border-[#444746]/30">
            <span className="text-[#c4c7c5] text-[15px] w-14">To</span>
            <input
              type="text"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-[#e3e3e3] p-0 text-[15px]"
            />
            <span className="material-symbols-rounded text-[#c4c7c5] text-[20px]">expand_more</span>
          </div>

          <div className="flex items-center px-4 py-3 border-b border-[#444746]/30">
            <span className="text-[#c4c7c5] text-[15px] w-14">From</span>
            <span className="flex-1 text-[#e3e3e3] text-[15px]">me</span>
            <span className="material-symbols-rounded text-[#c4c7c5] text-[20px]">expand_more</span>
          </div>

          <div className="px-4 py-3 border-b border-[#444746]/30 relative">
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-[#e3e3e3] p-0 text-[15px] placeholder-[#c4c7c5]"
            />
          </div>

          <textarea
            className="flex-1 w-full bg-transparent border-none focus:ring-0 text-[#e3e3e3] p-4 text-[15px] resize-none leading-relaxed"
            placeholder="Compose email"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          ></textarea>
        </div>

        <div className="hidden sm:flex items-center justify-between px-4 py-3 bg-[#1e1f20] border-t border-[#444746]/50">
          <div className="flex items-center gap-1">
            <button onClick={handleSend} className="bg-[#a8c7fa] text-[#062e6f] px-6 py-2 rounded-full font-medium text-sm hover:bg-[#8ab4f8] transition-colors">
              Send
            </button>
            <button className="text-[#c4c7c5] p-2 hover:bg-[#444746] rounded-full"><span className="material-symbols-rounded text-[20px]">format_color_text</span></button>
            <button className="text-[#c4c7c5] p-2 hover:bg-[#444746] rounded-full"><span className="material-symbols-rounded text-[20px]">attachment</span></button>
            <button className="text-[#c4c7c5] p-2 hover:bg-[#444746] rounded-full"><span className="material-symbols-rounded text-[20px]">link</span></button>
            <button className="text-[#c4c7c5] p-2 hover:bg-[#444746] rounded-full"><span className="material-symbols-rounded text-[20px]">mood</span></button>
            <button className="text-[#c4c7c5] p-2 hover:bg-[#444746] rounded-full"><span className="material-symbols-rounded text-[20px]">add_to_drive</span></button>
            <button className="text-[#c4c7c5] p-2 hover:bg-[#444746] rounded-full"><span className="material-symbols-rounded text-[20px]">image</span></button>
            <button className="text-[#c4c7c5] p-2 hover:bg-[#444746] rounded-full"><span className="material-symbols-rounded text-[20px]">lock_clock</span></button>

            <div className="h-6 w-px bg-[#444746] mx-1"></div>
            <button
              onClick={() => setIsAiMode(!isAiMode)}
              className={`p-2 rounded-full transition-colors ${isAiMode ? 'bg-[#a8c7fa]/20 text-[#a8c7fa]' : 'text-[#c4c7c5] hover:bg-[#444746]'}`}
              title="AI Draft"
            >
              <span className="material-symbols-rounded text-[20px]">auto_awesome</span>
            </button>
          </div>
          <button className="text-[#c4c7c5] p-2 hover:bg-[#444746] rounded-full"><span className="material-symbols-rounded text-[20px]">delete</span></button>
        </div>

        <div className="sm:hidden absolute bottom-20 right-4 z-20">
          <button
            onClick={() => setIsAiMode(!isAiMode)}
            className="bg-[#2b2c2f] border border-[#444746] text-[#a8c7fa] w-12 h-12 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <span className="material-symbols-rounded">auto_awesome</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComposeModal;
