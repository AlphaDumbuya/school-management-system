/**
 * Records Access Component
 * Allows parents to access and download child's academic records
 * Phase 13.3: Parent Portal
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Download, Eye, Lock, FileText, MoreVertical } from 'lucide-react';

interface Document {
  id: string;
  name: string;
  type: 'academic' | 'financial' | 'attendance' | 'certificate';
  status: 'available' | 'generating' | 'requested';
  lastModified: string;
  size?: string;
}

interface RecordsAccessProps {
  childName: string;
  documents: Document[];
  isLoading?: boolean;
}

export const RecordsAccess: React.FC<RecordsAccessProps> = ({
  childName,
  documents,
  isLoading = false,
}) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const documentTypes = [
    { key: 'academic', label: 'Academic Records', icon: '📚', color: 'bg-blue-50' },
    { key: 'financial', label: 'Financial Records', icon: '💰', color: 'bg-green-50' },
    { key: 'attendance', label: 'Attendance Records', icon: '📅', color: 'bg-purple-50' },
    { key: 'certificate', label: 'Certificates', icon: '🏆', color: 'bg-yellow-50' },
  ];

  const filteredDocs = selectedType
    ? documents.filter(d => d.type === selectedType)
    : documents;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'generating':
        return 'bg-yellow-100 text-yellow-800';
      case 'requested':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDownload = async (docId: string) => {
    setDownloadingId(docId);
    // Simulate download
    await new Promise(resolve => setTimeout(resolve, 1500));
    setDownloadingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{childName}'s Records</h3>
        <p className="text-sm text-gray-600">Access and download your child's academic documents</p>
      </div>

      {/* Document Type Filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {documentTypes.map(type => (
          <button
            key={type.key}
            onClick={() => setSelectedType(selectedType === type.key ? null : type.key)}
            className={`p-4 rounded-lg transition border-2 ${
              selectedType === type.key
                ? 'bg-blue-50 border-blue-600'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="text-2xl mb-1">{type.icon}</p>
            <p className="text-sm font-medium text-gray-900 text-left">{type.label}</p>
            <p className="text-xs text-gray-600 mt-1">
              {documents.filter(d => d.type === type.key).length} files
            </p>
          </button>
        ))}
      </div>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <span>
                {selectedType
                  ? documentTypes.find(t => t.key === selectedType)?.label
                  : 'All Records'}
              </span>
            </div>
            {selectedType && (
              <button
                onClick={() => setSelectedType(null)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Clear Filter
              </button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No documents available</p>
              </div>
            ) : (
              filteredDocs.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-blue-50 rounded">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{doc.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(doc.status)}`}>
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                        <span className="text-xs text-gray-600">{doc.lastModified}</span>
                        {doc.size && <span className="text-xs text-gray-600">{doc.size}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDownload(doc.id)}
                      disabled={downloadingId === doc.id || doc.status !== 'available'}
                      size="sm"
                      className="text-white bg-blue-600 hover:bg-blue-700"
                    >
                      {downloadingId === doc.id ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⟳</span>
                          Downloading
                        </span>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Access History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Access History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 border-b">
              <div>
                <p className="font-medium text-gray-900">Academic Record Downloaded</p>
                <p className="text-xs text-gray-600">July 2, 2026 at 3:45 PM</p>
              </div>
              <span className="text-xs text-gray-500">By: You</span>
            </div>
            <div className="flex items-center justify-between p-2 border-b">
              <div>
                <p className="font-medium text-gray-900">Fee Statement Viewed</p>
                <p className="text-xs text-gray-600">July 1, 2026 at 10:30 AM</p>
              </div>
              <span className="text-xs text-gray-500">By: You</span>
            </div>
            <div className="flex items-center justify-between p-2">
              <div>
                <p className="font-medium text-gray-900">Attendance Report Shared</p>
                <p className="text-xs text-gray-600">June 28, 2026 at 2:15 PM</p>
              </div>
              <span className="text-xs text-gray-500">By: School Admin</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Retention Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="w-5 h-5 text-blue-600" />
            Information & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div>
            <p className="font-semibold text-gray-900 mb-1">Document Validity</p>
            <p>All documents are valid for 6 months from the date of generation.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Privacy & Security</p>
            <p>All documents are encrypted and access is logged. Only authorized parents can access these records.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Sharing Documents</p>
            <p>Documents can be shared with educational institutions or other authorized parties with parent consent.</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">Support</p>
            <p>For document-related issues, contact: support@school.edu / 9876543210</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecordsAccess;
