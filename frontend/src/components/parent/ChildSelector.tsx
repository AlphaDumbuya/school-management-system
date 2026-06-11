/**
 * Child Selector Component
 * Allows parents to select and switch between their children
 * Phase 13.3: Parent Portal
 */

import React, { useState } from 'react';
import { Card, CardContent } from '@components/ui/card';
import { ChevronDown, Plus } from 'lucide-react';

interface Child {
  id: string;
  name: string;
  class: string;
  gpa: number;
  attendance: number;
  outstandingFees: number;
}

interface ChildSelectorProps {
  children: Child[];
  selectedChildId: string;
  onChildSelect: (childId: string) => void;
  compact?: boolean;
}

export const ChildSelector: React.FC<ChildSelectorProps> = ({
  children,
  selectedChildId,
  onChildSelect,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedChild = children.find(c => c.id === selectedChildId);

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg flex items-center justify-between hover:bg-gray-50"
        >
          <span className="font-medium text-gray-900">
            {selectedChild?.name || 'Select Child'}
          </span>
          <ChevronDown className={`w-5 h-5 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-10">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => {
                  onChildSelect(child.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition ${
                  child.id === selectedChildId ? 'bg-blue-50' : ''
                }`}
              >
                <p className="font-semibold text-gray-900">{child.name}</p>
                <p className="text-sm text-gray-600">{child.class}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full card mode
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Your Children</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map(child => (
          <Card
            key={child.id}
            className={`cursor-pointer transition border-2 ${
              child.id === selectedChildId
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onChildSelect(child.id)}
          >
            <CardContent className="pt-4">
              <p className="font-semibold text-lg text-gray-900">{child.name}</p>
              <p className="text-sm text-gray-600 mb-3">{child.class}</p>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-xs text-gray-600">GPA</p>
                  <p className="font-bold text-blue-600">{child.gpa}</p>
                </div>
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-xs text-gray-600">Attendance</p>
                  <p className="font-bold text-green-600">{child.attendance}%</p>
                </div>
                <div className="p-2 bg-white rounded-lg">
                  <p className="text-xs text-gray-600">Outstanding</p>
                  <p className="font-bold text-orange-600">₹{child.outstandingFees}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Child Button */}
        <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 cursor-pointer transition">
          <CardContent className="pt-4 flex flex-col items-center justify-center h-full">
            <Plus className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-600">Add Child</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ChildSelector;
