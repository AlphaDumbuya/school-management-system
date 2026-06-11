/**
 * Records Download Component
 * Allows students to download academic records, fee statements, and attendance reports
 * Phase 13.2: Student Portal
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { FileText, Download, Clock, Check } from 'lucide-react';

interface DocumentRecord {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  status: 'available' | 'generating' | 'requested';
}

interface RecordsDownloadProps {
  isLoading?: boolean;
}

export const RecordsDownload: React.FC<RecordsDownloadProps> = ({ isLoading = false }) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(new Set());

  const documents: DocumentRecord[] = [
    {
      id: 'academic',
      name: 'Academic Record',
      description: 'Complete academic record including grades, GPA, and achievements',
      icon: <FileText className="w-8 h-8" />,
      color: 'bg-blue-50 border-blue-200',
      status: 'available',
    },
    {
      id: 'fee-statement',
      name: 'Fee Statement',
      description: 'Detailed fee statement with payment history and outstanding balance',
      icon: <FileText className="w-8 h-8" />,
      color: 'bg-green-50 border-green-200',
      status: 'available',
    },
    {
      id: 'attendance',
      name: 'Attendance Report',
      description: 'Attendance record with day-wise marking and percentage',
      icon: <FileText className="w-8 h-8" />,
      color: 'bg-purple-50 border-purple-200',
      status: 'available',
    },
    {
      id: 'certificates',
      name: 'Academic Certificates',
      description: 'Digital certificates for completed terms and achievements',
      icon: <FileText className="w-8 h-8" />,
      color: 'bg-yellow-50 border-yellow-200',
      status: 'available',
    },
  ];

  const handleDownload = async (documentId: string) => {
    setDownloadingId(documentId);
    
    // Simulate download delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setDownloadingId(null);
    setDownloadedFiles(prev => new Set([...prev, documentId]));

    // Simulate actual download (in real app, would trigger file download)
    const doc = documents.find(d => d.id === documentId);
    console.log(`Downloading ${doc?.name}...`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'generating':
        return <Clock className="w-4 h-4 text-yellow-600 animate-spin" />;
      case 'requested':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle>Download Your Records</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-sm">
            Download your official academic records, fee statements, and other important documents in PDF format.
            All documents are digitally signed and can be used for admission to other institutions.
          </p>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map(doc => (
          <div
            key={doc.id}
            className={`p-4 border rounded-lg ${doc.color} transition-all hover:shadow-md`}
          >
            {/* Icon and Title */}
            <div className="flex items-start justify-between mb-3">
              <div className="text-blue-600">{doc.icon}</div>
              <div className="flex items-center gap-1">
                {getStatusIcon(doc.status)}
                <span className="text-xs font-medium text-gray-600 capitalize">{doc.status}</span>
              </div>
            </div>

            {/* Content */}
            <h3 className="font-semibold text-gray-900 mb-1">{doc.name}</h3>
            <p className="text-sm text-gray-600 mb-4">{doc.description}</p>

            {/* Download Button */}
            <Button
              onClick={() => handleDownload(doc.id)}
              disabled={downloadingId === doc.id || isLoading}
              className={`w-full flex items-center justify-center gap-2 ${
                downloadedFiles.has(doc.id)
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {downloadingId === doc.id ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Downloading...
                </>
              ) : downloadedFiles.has(doc.id) ? (
                <>
                  <Check className="w-4 h-4" />
                  Downloaded
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        ))}
      </div>

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Important Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-semibold text-gray-900 mb-1">Document Validity</p>
            <p className="text-gray-600">All documents are valid for 6 months from the date of generation.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Multiple Downloads</p>
            <p className="text-gray-600">You can download the same document multiple times. Each download generates a new timestamp.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Technical Support</p>
            <p className="text-gray-600">If you face any issues downloading documents, please contact support@school.edu</p>
          </div>
        </CardContent>
      </Card>

      {/* Download History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Downloads</CardTitle>
        </CardHeader>
        <CardContent>
          {downloadedFiles.size === 0 ? (
            <p className="text-gray-500 text-sm">No downloads yet. Start downloading your records above.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {Array.from(downloadedFiles).map(fileId => {
                const doc = documents.find(d => d.id === fileId);
                return (
                  <div key={fileId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-gray-700">{doc?.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">Just now</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecordsDownload;
