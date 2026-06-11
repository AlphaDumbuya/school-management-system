/**
 * Grade Viewer Component
 * Display student grades with analytics and trends
 * Phase 13: Student Portal
 */

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface GradeRecord {
  id: string;
  subject: string;
  marks: number;
  maxMarks: number;
  grade: string;
  term: string;
  date: string;
}

interface GradeViewerProps {
  grades: GradeRecord[];
  isLoading?: boolean;
}

export const GradeViewer: React.FC<GradeViewerProps> = ({
  grades,
  isLoading = false,
}) => {
  // Calculate statistics
  const stats = useMemo(() => {
    if (grades.length === 0) {
      return {
        gpa: 0,
        average: 0,
        highest: 0,
        lowest: 0,
        totalSubjects: 0,
      };
    }

    const averageMarks = grades.reduce((sum, g) => sum + g.marks, 0) / grades.length;
    const highest = Math.max(...grades.map(g => g.marks));
    const lowest = Math.min(...grades.map(g => g.marks));

    // Simple GPA calculation (4.0 scale)
    const gpa = (averageMarks / 100) * 4;

    return {
      gpa: parseFloat(gpa.toFixed(2)),
      average: parseFloat(averageMarks.toFixed(2)),
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

  // Get grade color
  const getGradeColor = (marks: number) => {
    if (marks >= 90) return 'bg-green-100 text-green-800';
    if (marks >= 80) return 'bg-blue-100 text-blue-800';
    if (marks >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Get trend
  const getTrend = (subject: string) => {
    const subjectGrades = grades.filter(g => g.subject === subject).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (subjectGrades.length < 2) return null;

    const latest = subjectGrades[subjectGrades.length - 1].marks;
    const previous = subjectGrades[subjectGrades.length - 2].marks;
    const diff = latest - previous;

    return { diff, isUp: diff > 0 };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">Loading grades...</div>
        </CardContent>
      </Card>
    );
  }

  if (grades.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">No grades available yet</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">GPA</p>
              <p className="text-3xl font-bold text-blue-600">{stats.gpa}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Average</p>
              <p className="text-3xl font-bold text-green-600">{stats.average}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Highest</p>
              <p className="text-3xl font-bold text-purple-600">{stats.highest}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Subjects</p>
              <p className="text-3xl font-bold text-orange-600">{stats.totalSubjects}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grades by Term */}
      {Object.entries(gradesByTerm).map(([term, termGrades]) => (
        <Card key={term}>
          <CardHeader>
            <CardTitle>{term}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {termGrades.map(grade => {
                const trend = getTrend(grade.subject);
                return (
                  <div key={grade.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-semibold text-lg">{grade.subject}</p>
                        {trend && (
                          <div className={`flex items-center gap-1 text-sm font-medium ${
                            trend.isUp ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {trend.isUp ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : (
                              <TrendingDown className="w-4 h-4" />
                            )}
                            {Math.abs(trend.diff > 0 ? trend.diff : -trend.diff)} pts
                          </div>
                        )}
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-green-600"
                          style={{ width: `${(grade.marks / grade.maxMarks) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <p className="text-sm text-gray-600 mb-1">
                        {grade.marks}/{grade.maxMarks}
                      </p>
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${getGradeColor(grade.marks)}`}>
                        {grade.grade}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Grade Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Grade Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['A+/A (90-100)', 'B (80-89)', 'C (70-79)', 'D (60-69)', 'F (<60)'].map((range, idx) => {
              const min = [90, 80, 70, 60, 0][idx];
              const max = [100, 89, 79, 69, 59][idx];
              const count = grades.filter(g => g.marks >= min && g.marks <= max).length;
              const percentage = (count / grades.length) * 100;

              return (
                <div key={range} className="flex items-center gap-4">
                  <div className="w-20 text-sm font-medium">{range}</div>
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-green-600 to-blue-600"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-12 text-right text-sm font-medium">{count}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GradeViewer;
