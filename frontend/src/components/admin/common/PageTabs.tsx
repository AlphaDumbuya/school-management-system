import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface PageTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export const PageTabs: React.FC<PageTabsProps> = ({ tabs, activeTab, onChange }) => (
  <div
    role="tablist"
    aria-label="Page tabs"
    className="flex flex-wrap gap-2 mb-6 p-1.5 bg-slate-100 rounded-2xl"
  >
    {tabs.map((tab) => {
      const isActive = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          role="tab"
          aria-selected={isActive}
          aria-controls={`tabpanel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={[
            'flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap flex-shrink-0 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
            isActive
              ? 'bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white font-semibold shadow-md shadow-blue-500/30'
              : 'text-gray-600 hover:text-blue-700 hover:bg-white/70',
          ].join(' ')}
        >
          {tab.icon}
          {tab.label}
        </button>
      );
    })}
  </div>
);

export default PageTabs;
