/**
 * Fee Viewer Component
 * Displays student fee details, payment status, and payment history
 * Phase 13.2: Student Portal
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface FeeItem {
  type: string;
  amount: number;
  paid: number;
  status: 'paid' | 'pending' | 'overdue';
}

interface FeeViewerProps {
  fees: Record<string, FeeItem>;
  outstandingAmount: number;
  isLoading?: boolean;
}

export const FeeViewer: React.FC<FeeViewerProps> = ({
  fees,
  outstandingAmount,
  isLoading = false,
}) => {
  const hasOverdue = Object.values(fees).some(fee => fee.status === 'overdue');
  
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'overdue':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
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
            <p className="text-sm text-red-800">You have overdue fees. Please make payment as soon as possible.</p>
          </div>
        </div>
      )}

      {/* Outstanding Amount */}
      <Card className={outstandingAmount > 0 ? 'border-2 border-orange-200' : ''}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Outstanding</p>
              <p className={`text-3xl font-bold ${
                outstandingAmount === 0 ? 'text-green-600' : 'text-orange-600'
              }`}>
                ₹{outstandingAmount.toLocaleString()}
              </p>
            </div>
            {outstandingAmount === 0 ? (
              <CheckCircle className="w-10 h-10 text-green-600" />
            ) : (
              <AlertCircle className="w-10 h-10 text-orange-600" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fee Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(fees).map(([key, fee]) => (
            <div key={key} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {getStatusIcon(fee.status)}
                  <div>
                    <p className="font-semibold capitalize">{fee.type}</p>
                    <p className="text-sm text-gray-600">
                      ₹{fee.paid.toLocaleString()} / ₹{fee.amount.toLocaleString()} paid
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(fee.status)}`}>
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

              {/* Remaining Amount */}
              {fee.paid < fee.amount && (
                <p className="mt-2 text-sm text-gray-600">
                  Remaining: ₹{(fee.amount - fee.paid).toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payment Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong className="text-gray-900">Payment Methods:</strong> Online transfer, Credit/Debit Card, Cash, Cheque
            </p>
            <p>
              <strong className="text-gray-900">Payment Deadline:</strong> Within 30 days of invoice date
            </p>
            <p>
              <strong className="text-gray-900">Late Fee:</strong> 2% per month on overdue amount
            </p>
            <p>
              <strong className="text-gray-900">Contact:</strong> finance@school.edu / 9876543210
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeeViewer;
