/**
 * Child Fee Status Component
 * Displays child's fee details and payment status for parents
 * Phase 13.3: Parent Portal
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { AlertCircle, Download } from 'lucide-react';

interface Fee {
  type: string;
  amount: number;
  paid: number;
  status: 'paid' | 'pending' | 'overdue';
  dueDate?: string;
}

interface ChildFeeStatusProps {
  childName: string;
  fees: Fee[];
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
  isLoading?: boolean;
}

export const ChildFeeStatus: React.FC<ChildFeeStatusProps> = ({
  childName,
  fees,
  totalAmount,
  totalPaid,
  totalOutstanding,
  isLoading = false,
}) => {
  const paidPercentage = (totalPaid / totalAmount) * 100;
  const hasOverdue = fees.some(f => f.status === 'overdue');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      {/* Overdue Alert */}
      {hasOverdue && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-900">Overdue Payment Alert</p>
            <p className="text-sm text-red-800">There are overdue fees. Please make payment as soon as possible.</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 mb-1">Total Fees</p>
            <p className="text-2xl font-bold text-gray-900">Le{totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 mb-1">Paid</p>
            <p className="text-2xl font-bold text-green-600">Le{totalPaid.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 mb-1">Outstanding</p>
            <p className="text-2xl font-bold text-orange-600">Le{totalOutstanding.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 mb-1">Payment %</p>
            <p className="text-2xl font-bold text-blue-600">{Math.round(paidPercentage)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overall Payment Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Total Payment Status</p>
            <p className="text-sm font-semibold text-gray-900">{Math.round(paidPercentage)}%</p>
          </div>
          <div className="bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                paidPercentage === 100 ? 'bg-green-600' :
                paidPercentage >= 70 ? 'bg-blue-600' :
                'bg-orange-600'
              }`}
              style={{ width: `${paidPercentage}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fee Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fee Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fees.map((fee, idx) => (
            <div key={idx} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{fee.type}</p>
                  <p className="text-sm text-gray-600">
                    Le{fee.paid.toLocaleString()} / Le{fee.amount.toLocaleString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(fee.status)}`}>
                  {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    fee.status === 'paid' ? 'bg-green-600' :
                    fee.status === 'overdue' ? 'bg-red-600' :
                    'bg-yellow-600'
                  }`}
                  style={{ width: `${(fee.paid / fee.amount) * 100}%` }}
                />
              </div>

              {/* Due Date */}
              {fee.dueDate && fee.status !== 'paid' && (
                <p className="text-xs text-gray-600 mt-2">Due: {fee.dueDate}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <span>Tuition Fee (Term 1)</span>
              <span className="font-semibold">Le50,000</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <span>Transport Fee (Term 1)</span>
              <span className="font-semibold">Le10,000</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <span>Library Fee (Term 1)</span>
              <span className="font-semibold">Le2,000</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
              <span>Activities Fee (Pending)</span>
              <span className="font-semibold text-orange-600">Le5,000</span>
            </div>
          </div>

          <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Download Fee Statement</span>
          </button>
        </CardContent>
      </Card>

      {/* Payment Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payment Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-gray-600">
          <p><strong className="text-gray-900">Payment Methods:</strong> Bank Transfer, Credit/Debit Card, Cash</p>
          <p><strong className="text-gray-900">Account Name:</strong> School Management System</p>
          <p><strong className="text-gray-900">Account Number:</strong> 1234567890</p>
          <p><strong className="text-gray-900">IFSC Code:</strong> SBIN0001234</p>
          <p><strong className="text-gray-900">Late Fee:</strong> 2% per month on overdue amount</p>
          <p><strong className="text-gray-900">Support:</strong> finance@school.edu / 9876543210</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChildFeeStatus;
