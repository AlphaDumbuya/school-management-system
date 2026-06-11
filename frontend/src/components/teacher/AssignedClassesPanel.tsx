/**
 * Assigned Classes Panel Component
 * Displays teacher's assigned classes with quick actions
 * Phase 13: Teacher Dashboard
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Search, ChevronRight, Users, BookOpen } from 'lucide-react';

export interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  level: string;
  studentCount: number;
  status: 'active' | 'completed' | 'scheduled';
  section: string;
  room: string;
  schedule: string;
}

interface AssignedClassesPanelProps {
  classes: ClassInfo[];
  onSelectClass: (classId: string) => void;
  onGradeEntry: (classId: string) => void;
  onMarkAttendance: (classId: string) => void;
  isLoading?: boolean;
}

export const AssignedClassesPanel: React.FC<AssignedClassesPanelProps> = ({
  classes,
  onSelectClass,
  onGradeEntry,
  onMarkAttendance,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'scheduled'>('all');
  const [filteredClasses, setFilteredClasses] = useState<ClassInfo[]>(classes);

  // Filter and search classes
  useEffect(() => {
    let result = classes;

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(cls => cls.status === filterStatus);
    }

    // Search by name, subject, or level
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(cls =>
        cls.name.toLowerCase().includes(term) ||
        cls.subject.toLowerCase().includes(term) ||
        cls.level.toLowerCase().includes(term)
      );
    }

    setFilteredClasses(result);
  }, [classes, searchTerm, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'scheduled':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            My Classes ({filteredClasses.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search classes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              {(['all', 'active', 'completed', 'scheduled'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    filterStatus === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Classes List */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading classes...</div>
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {classes.length === 0 ? 'No classes assigned' : 'No classes match your search'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClasses.map(cls => (
                <div
                  key={cls.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onSelectClass(cls.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{cls.name}</h3>
                          <p className="text-sm text-gray-600">{cls.subject} • {cls.level} {cls.section}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {cls.studentCount} students
                        </div>
                        <div>Room {cls.room}</div>
                        <div>{cls.schedule}</div>
                      </div>

                      <div className="flex gap-2">
                        <Badge className={getStatusColor(cls.status)}>
                          {cls.status.charAt(0).toUpperCase() + cls.status.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onGradeEntry(cls.id);
                        }}
                        title="Enter grades for this class"
                      >
                        Grades
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAttendance(cls.id);
                        }}
                        title="Mark attendance"
                      >
                        Attendance
                      </Button>
                      <ChevronRight className="w-5 h-5 text-gray-400 self-center" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{classes.filter(c => c.status === 'active').length}</p>
              <p className="text-sm text-gray-600">Active Classes</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {classes.reduce((sum, c) => sum + c.studentCount, 0)}
              </p>
              <p className="text-sm text-gray-600">Total Students</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {classes.filter(c => c.status === 'scheduled').length}
              </p>
              <p className="text-sm text-gray-600">Scheduled</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AssignedClassesPanel;
