/**
 * Accountant Dashboard Page
 * Financial management and transaction tracking for accountants
 * Phase 13: Specialized Dashboards
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { MainLayout } from '@components/layout/MainLayout';
import { AlertCircle, TrendingUp, DollarSign, FileText, PhoneIcon, Mail, Download, Filter } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';

// Mock data
const mockTransactions = [
  { id: '1', studentName: 'Mohamed Kamara', class: '10th Grade A', type: 'Tuition', amount: 50000, date: 'Today', status: 'paid' },
  { id: '2', studentName: 'Fatmata Sesay', class: '8th Grade B', type: 'Transport', amount: 10000, date: 'Yesterday', status: 'paid' },
  { id: '3', studentName: 'Ibrahim Koroma', class: '9th Grade A', type: 'Activities', amount: 5000, date: '2 days ago', status: 'pending' },
  { id: '4', studentName: 'Aminata Bangura', class: '7th Grade C', type: 'Library', amount: 2000, date: '3 days ago', status: 'paid' },
  { id: '5', studentName: 'Abdul Conteh', class: '10th Grade B', type: 'Tuition', amount: 50000, date: '5 days ago', status: 'pending' },
];

const mockOutstandingFees = [
  { id: '1', studentName: 'Ibrahim Koroma', class: '9th Grade A', totalDue: 15000, daysOverdue: 5, parentPhone: '+232-76-123456', parentEmail: 'parent1@example.com' },
  { id: '2', studentName: 'Abdul Conteh', class: '10th Grade B', totalDue: 50000, daysOverdue: 10, parentPhone: '+232-77-234567', parentEmail: 'parent2@example.com' },
  { id: '3', studentName: 'Hawa Turay', class: '8th Grade A', totalDue: 7000, daysOverdue: 2, parentPhone: '+232-78-345678', parentEmail: 'parent3@example.com' },
  { id: '4', studentName: 'Mariama Fofanah', class: '9th Grade B', totalDue: 12000, daysOverdue: 15, parentPhone: '+232-30-456789', parentEmail: 'parent4@example.com' },
];

type TabType = 'overview' | 'transactions' | 'outstanding';

export const Phase13AccountantDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set());

  // Calculate KPIs
  const totalRevenue = mockTransactions
    .filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const pendingAmount = mockTransactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const collectionRate = (totalRevenue / (totalRevenue + pendingAmount)) * 100;
  
  const totalOutstanding = mockOutstandingFees.reduce((sum, f) => sum + f.totalDue, 0);

  const sendReminder = (parentId: string) => {
    const newSent = new Set(reminderSent);
    newSent.add(parentId);
    setReminderSent(newSent);
    setTimeout(() => {
      const updated = new Set(reminderSent);
      updated.delete(parentId);
      setReminderSent(updated);
    }, 2000);
  };

  const sendBulkReminders = () => {
    const allIds = mockOutstandingFees.map(f => f.id).join(',');
    setReminderSent(new Set([allIds]));
    setTimeout(() => {
      setReminderSent(new Set());
    }, 2000);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Welcome hero */}
        <WelcomeHero
          firstName={user?.firstName ?? (user as any)?.first_name}
          role="accountant"
          roleLabel="Accountant"
          subtitle="Financial management and revenue tracking."
          actions={
            <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/20 flex items-center gap-2 text-sm px-3 py-1.5 flex-shrink-0">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Report</span>
              <span className="sm:hidden">Export</span>
            </Button>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Revenue</p>
                  <p className="text-3xl font-bold text-blue-600">Le{(totalRevenue / 100000).toFixed(1)}L</p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Pending Amount</p>
                  <p className="text-3xl font-bold text-orange-600">Le{(pendingAmount / 1000).toFixed(0)}K</p>
                </div>
                <AlertCircle className="w-10 h-10 text-orange-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Collection Rate</p>
                  <p className="text-3xl font-bold text-green-600">{collectionRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="w-10 h-10 text-green-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Outstanding Fees</p>
                  <p className="text-3xl font-bold text-red-600">Le{(totalOutstanding / 100000).toFixed(2)}L</p>
                </div>
                <DollarSign className="w-10 h-10 text-red-100" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Outstanding Fees Alert */}
        {totalOutstanding > 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">High Outstanding Amount</p>
                <p className="text-sm text-red-800">
                  Le{totalOutstanding.toLocaleString()} in outstanding fees from {mockOutstandingFees.length} students.
                </p>
              </div>
            </div>
            <Button
              onClick={sendBulkReminders}
              disabled={reminderSent.size > 0}
              className="bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              {reminderSent.size > 0 ? 'Reminders Sent' : 'Send Reminders'}
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4 overflow-x-auto">
            {(['overview', 'transactions', 'outstanding'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'overview' && '📊 Overview'}
                {tab === 'transactions' && '💳 Transactions'}
                {tab === 'outstanding' && '⚠️ Outstanding'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Financial Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Financial Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Collected</p>
                      <p className="text-2xl font-bold text-green-600">Le{(totalRevenue / 100000).toFixed(1)}L</p>
                      <p className="text-xs text-gray-600 mt-2">From {mockTransactions.filter(t => t.status === 'paid').length} payments</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Pending Collection</p>
                      <p className="text-2xl font-bold text-orange-600">Le{(pendingAmount / 1000).toFixed(0)}K</p>
                      <p className="text-xs text-gray-600 mt-2">From {mockTransactions.filter(t => t.status === 'pending').length} students</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Collection Efficiency</p>
                      <p className="text-2xl font-bold text-blue-600">{collectionRate.toFixed(1)}%</p>
                      <p className="text-xs text-gray-600 mt-2">On target</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Transactions */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockTransactions.slice(0, 5).map((tx, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-semibold text-gray-900">{tx.studentName}</p>
                          <p className="text-sm text-gray-600">{tx.class} • {tx.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">Le{tx.amount.toLocaleString()}</p>
                          <span className={`text-xs font-medium ${
                            tx.status === 'paid' ? 'text-green-600' : 'text-orange-600'
                          }`}>
                            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Transactions</CardTitle>
                  <Button variant="outline" className="text-gray-700 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockTransactions.map(tx => (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTransaction(selectedTransaction === tx.id ? null : tx.id)}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{tx.studentName}</p>
                          <p className="text-sm text-gray-600">{tx.class} • {tx.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-gray-900">Le{tx.amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-600 mb-1">{tx.date}</p>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            tx.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                          </span>
                        </div>
                      </div>

                      {selectedTransaction === tx.id && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Generate Receipt
                          </Button>
                          <Button variant="outline" className="w-full" size="sm">
                            Mark as Completed
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Outstanding Fees Tab */}
          {activeTab === 'outstanding' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Outstanding Fees</CardTitle>
                  <Button
                    onClick={sendBulkReminders}
                    disabled={reminderSent.size > 0}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm"
                  >
                    {reminderSent.size > 0 ? 'Reminders Sent' : 'Send All Reminders'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockOutstandingFees.map(fee => (
                    <div key={fee.id} className="p-4 border rounded-lg hover:bg-orange-50 transition">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">{fee.studentName}</p>
                          <p className="text-sm text-gray-600">{fee.class}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-red-600">Le{fee.totalDue.toLocaleString()}</p>
                          <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium mt-1">
                            {fee.daysOverdue} days overdue
                          </span>
                        </div>
                      </div>

                      {/* Parent Contact Info */}
                      <div className="bg-gray-50 p-3 rounded mb-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-700 mb-1">
                          <PhoneIcon className="w-4 h-4" />
                          <span>{fee.parentPhone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Mail className="w-4 h-4" />
                          <span>{fee.parentEmail}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => sendReminder(fee.id)}
                          disabled={reminderSent.has(fee.id)}
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          {reminderSent.has(fee.id) ? '✓ Sent' : 'Send Reminder'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                        >
                          Generate Invoice
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Financial Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Total Students</span>
                <span className="font-bold text-gray-900">250</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Students with Pending Fees</span>
                <span className="font-bold text-orange-600">{mockOutstandingFees.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Average Outstanding per Student</span>
                <span className="font-bold text-red-600">Le{Math.round(totalOutstanding / mockOutstandingFees.length).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span>Collection Efficiency Target</span>
                <span className="font-bold text-green-600">95%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Phase13AccountantDashboard;
