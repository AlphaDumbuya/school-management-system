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
    className="flex overflow-x-auto border-b border-gray-200 -mb-px mb-6"
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
            'flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap flex-shrink-0 border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
            isActive
              ? 'border-blue-600 text-blue-600 font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300',
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
