import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';

export const ComingSoonPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = location.pathname.split('/').pop()?.replace('-', ' ').toUpperCase() || 'PAGE';

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="mb-4">
            <div className="text-6xl mb-4">🚀</div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Coming Soon</h1>
          <p className="text-xl text-gray-600 mb-8">
            The <span className="font-semibold">{pageTitle}</span> page is under development.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default ComingSoonPage;
