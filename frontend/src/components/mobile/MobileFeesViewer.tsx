/**
 * Mobile Fees Viewer - Phase 20
 * Touch-friendly fee display with payment tracking
 * Shows dues, payment history, and quick payment options
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { AlertCircle, CheckCircle, Clock, CreditCard, Download, Eye, EyeOff } from 'lucide-react';

interface FeeRecord {
  id: string;
  feeType: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'paid' | 'pending' | 'overdue';
  term: string;
  paymentMethod?: string;
  transactionId?: string;
}

interface MobileFeeViewerProps {
  fees: FeeRecord[];
  isLoading?: boolean;
  onPay?: (feeId: string) => void;
  onDownloadReceipt?: (feeId: string) => void;
}

export const MobileFeesViewer: React.FC<MobileFeeViewerProps> = ({
  fees,
  isLoading = false,
  onPay,
  onDownloadReceipt,
}) => {
  const [showAmount, setShowAmount] = React.useState(true);

  // Calculate statistics
  const stats = useMemo(() => {
    if (fees.length === 0) {
      return { totalDue: 0, totalPaid: 0, totalOverdue: 0, pendingCount: 0 };
    }

    const totalPaid = fees
      .filter(f => f.status === 'paid')
      .reduce((sum, f) => sum + f.amount, 0);

    const totalDue = fees
      .filter(f => f.status === 'pending')
      .reduce((sum, f) => sum + f.amount, 0);

    const totalOverdue = fees
      .filter(f => f.status === 'overdue')
      .reduce((sum, f) => sum + f.amount, 0);

    const pendingCount = fees.filter(f => f.status === 'pending' || f.status === 'overdue')
      .length;

    return { totalDue, totalPaid, totalOverdue, pendingCount };
  }, [fees]);

  // Group fees by term
  const feesByTerm = useMemo(() => {
    const grouped: Record<string, FeeRecord[]> = {};
    fees.forEach(fee => {
      if (!grouped[fee.term]) {
        grouped[fee.term] = [];
      }
      grouped[fee.term].push(fee);
    });
    return grouped;
  }, [fees]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-l-4 border-green-600';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-600';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-l-4 border-red-600';
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-200 animate-spin mb-3">
            <div className="w-6 h-6 rounded-full border-3 border-blue-400 border-t-blue-600" />
          </div>
          <p className="text-sm text-gray-600 font-medium">Loading fees...</p>
        </div>
      </div>
    );
  }

  if (fees.length === 0) {
    return (
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No fees available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Summary Cards */}
      <div className="space-y-3">
        {/* Total Balance Card */}
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 shadow-md">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Outstanding Balance</p>
                <p className={`text-3xl font-bold ${stats.totalDue + stats.totalOverdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {showAmount ? formatCurrency(stats.totalDue + stats.totalOverdue) : '••••'}
                </p>
              </div>
              <button
                onClick={() => setShowAmount(!showAmount)}
                className="p-2 rounded-lg hover:bg-gray-200 transition"
              >
                {showAmount ? (
                  <EyeOff className="w-5 h-5 text-gray-600" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="shadow-sm">
            <CardContent className="pt-3">
              <p className="text-xs text-gray-600 mb-1">Paid</p>
              <p className="text-xl font-bold text-green-600">
                {showAmount ? formatCurrency(stats.totalPaid).replace('$', '') : '••••'}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="pt-3">
              <p className="text-xs text-gray-600 mb-1">Pending</p>
              <p className="text-xl font-bold text-yellow-600">{stats.pendingCount}</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="pt-3">
              <p className="text-xs text-gray-600 mb-1">Overdue</p>
              <p className="text-xl font-bold text-red-600">
                {fees.filter(f => f.status === 'overdue').length}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Alert for Overdue Fees */}
      {stats.totalOverdue > 0 && (
        <Card className="bg-red-50 border border-red-200 shadow-md">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800 text-sm">Overdue Payment</p>
                <p className="text-xs text-red-700 mt-1">
                  You have {formatCurrency(stats.totalOverdue)} overdue. Please pay immediately.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fees by Term */}
      {Object.entries(feesByTerm).map(([term, termFees]) => (
        <Card key={term} className="shadow-md overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{term}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {termFees.map(fee => (
              <div key={fee.id} className={`p-3 rounded-lg ${getStatusColor(fee.status)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2 flex-1">
                    {getStatusIcon(fee.status)}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{fee.feeType}</p>
                      <p className="text-xs opacity-75">Due: {formatDate(fee.dueDate)}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold ml-2">
                    {showAmount ? formatCurrency(fee.amount) : '••••'}
                  </p>
                </div>

                {/* Fee Details */}
                {fee.status === 'paid' && fee.paidDate && (
                  <p className="text-xs opacity-75 mb-2">
                    Paid: {formatDate(fee.paidDate)}
                    {fee.paymentMethod && ` via ${fee.paymentMethod}`}
                  </p>
                )}

                {/* Action Buttons */}
                {fee.status !== 'paid' && (
                  <div className="flex gap-2 mt-2">
                    {onPay && (
                      <button
                        onClick={() => onPay(fee.id)}
                        className="flex-1 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition active:scale-95"
                      >
                        <CreditCard className="w-3 h-3 inline mr-1" />
                        Pay
                      </button>
                    )}
                  </div>
                )}

                {fee.status === 'paid' && onDownloadReceipt && (
                  <button
                    onClick={() => onDownloadReceipt(fee.id)}
                    className="w-full py-2 border border-current text-xs font-medium rounded hover:opacity-75 transition flex items-center justify-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Receipt
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MobileFeesViewer;
