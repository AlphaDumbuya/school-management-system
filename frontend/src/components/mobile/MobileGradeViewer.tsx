/**
 * Mobile Grade Viewer - Phase 20
 * Touch-friendly grade viewing with mobile-optimized layout
 * Supports offline caching and quick actions
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { ChevronDown, Download, Share2, TrendingUp, TrendingDown } from 'lucide-react';

interface GradeRecord {
  id: string;
  subject: string;
  marks: number;
  maxMarks: number;
  grade: string;
  term: string;
  date: string;
  teacher?: string;
}

interface MobileGradeViewerProps {
  grades: GradeRecord[];
  isLoading?: boolean;
  onExport?: () => void;
}

export const MobileGradeViewer: React.FC<MobileGradeViewerProps> = ({
  grades,
  isLoading = false,
  onExport,
}) => {
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);

  // Calculate statistics
  const stats = useMemo(() => {
    if (grades.length === 0) {
      return { average: 0, highest: 0, lowest: 0, totalSubjects: 0 };
    }

    const averageMarks = grades.reduce((sum, g) => sum + g.marks, 0) / grades.length;
    const highest = Math.max(...grades.map(g => g.marks));
    const lowest = Math.min(...grades.map(g => g.marks));

    return {
      average: parseFloat(averageMarks.toFixed(1)),
      highest,
      lowest,
      totalSubjects: grades.length,
    };
  }, [grades]);

  // Group grades by term
  const gradesByTerm = useMemo(() => {
    const grouped: Record<string, GradeRecord[]> = {};
    grades.forEach(grade => {
      if (!grouped[grade.term]) {
        grouped[grade.term] = [];
      }
      grouped[grade.term].push(grade);
    });
    return grouped;
  }, [grades]);

  const getGradeColor = (marks: number): string => {
    if (marks >= 90) return 'bg-green-100 text-green-800 border-l-4 border-green-600';
    if (marks >= 80) return 'bg-blue-100 text-blue-800 border-l-4 border-blue-600';
    if (marks >= 70) return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-600';
    if (marks >= 60) return 'bg-orange-100 text-orange-800 border-l-4 border-orange-600';
    return 'bg-red-100 text-red-800 border-l-4 border-red-600';
  };

  const getTrend = (subject: string) => {
    const subjectGrades = grades
      .filter(g => g.subject === subject)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (subjectGrades.length < 2) return null;

    const latest = subjectGrades[subjectGrades.length - 1].marks;
    const previous = subjectGrades[subjectGrades.length - 2].marks;
    const diff = latest - previous;

    return { diff, isUp: diff > 0 };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-200 animate-spin mb-3">
            <div className="w-6 h-6 rounded-full border-3 border-blue-400 border-t-blue-600" />
          </div>
          <p className="text-sm text-gray-600 font-medium">Loading grades...</p>
        </div>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-gray-500 font-medium">No grades available yet</p>
            <p className="text-xs text-gray-400 mt-2">Check back later for updates</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-md">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 font-medium mb-1">Average</p>
            <p className="text-2xl font-bold text-blue-600">{stats.average}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-600 font-medium mb-1">Highest</p>
            <p className="text-2xl font-bold text-green-600">{stats.highest}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {onExport && (
          <button
            onClick={onExport}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
        <button
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      {/* Grades by Term - Accordion Style */}
      {Object.entries(gradesByTerm).map(([term, termGrades]) => (
        <Card key={term} className="shadow-md overflow-hidden">
          <button
            onClick={() => setExpandedTerm(expandedTerm === term ? null : term)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition active:bg-gray-100"
          >
            <div className="text-left">
              <p className="font-semibold text-gray-800">{term}</p>
              <p className="text-xs text-gray-500">{termGrades.length} subjects</p>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-gray-600 transition ${
                expandedTerm === term ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedTerm === term && (
            <CardContent className="space-y-2 border-t">
              {termGrades.map(grade => {
                const trend = getTrend(grade.subject);
                const percentage = (grade.marks / grade.maxMarks) * 100;

                return (
                  <div
                    key={grade.id}
                    className={`p-3 rounded-lg ${getGradeColor(grade.marks)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{grade.subject}</p>
                        {grade.teacher && (
                          <p className="text-xs opacity-75 mt-0.5">{grade.teacher}</p>
                        )}
                      </div>
                      <span className="text-lg font-bold">{grade.grade}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-2">
                      <div className="bg-white bg-opacity-30 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-white transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Marks and Trend */}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium">
                        {grade.marks}/{grade.maxMarks}
                      </p>
                      {trend && (
                        <div
                          className={`flex items-center gap-1 text-xs font-medium ${
                            trend.isUp ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {trend.isUp ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {Math.abs(trend.diff)} pts
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
};

export default MobileGradeViewer;
