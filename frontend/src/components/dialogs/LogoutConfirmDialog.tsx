/**
 * Logout Confirmation Dialog
 * Professional modal for confirming user logout
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { FaExclamationTriangle, FaSignOutAlt, FaTimes } from 'react-icons/fa';
import clsx from 'clsx';

interface LogoutConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const LogoutConfirmDialog: React.FC<LogoutConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full transform transition-all duration-300 animate-in">
        {/* Close Button */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          title="Close"
        >
          <FaTimes className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-100 rounded-full flex items-center justify-center">
              <FaExclamationTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-red-600" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-lg sm:text-xl font-bold text-center text-gray-900 mb-2">
            Confirm Logout
          </h2>

          {/* Description */}
          <p className="text-sm sm:text-base text-center text-gray-600 mb-6">
            Are you sure you want to log out? You'll need to log in again to access your account.
          </p>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-6">
            <p className="text-xs sm:text-sm text-blue-800">
              <span className="font-semibold">Tip:</span> Your session data is securely stored. You can safely log in again from any device.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 sm:gap-4">
            {/* Cancel Button */}
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-4 py-2 sm:py-3 bg-gray-200 text-gray-900 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              Cancel
            </button>

            {/* Confirm Button */}
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={clsx(
                'flex-1 px-4 py-2 sm:py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base',
                isLoading
                  ? 'bg-red-400 text-white cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              )}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging out...
                </>
              ) : (
                <>
                  <FaSignOutAlt className="w-4 h-4" />
                  Yes, Logout
                </>
              )}
            </button>
          </div>

          {/* Footer Info */}
          <p className="text-xs text-center text-gray-500 mt-4">
            For security, you'll be logged out from all devices if you don't use your account for 30 days.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LogoutConfirmDialog;
