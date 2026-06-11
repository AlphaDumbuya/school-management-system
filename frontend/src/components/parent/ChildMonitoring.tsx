/**
 * Child Monitoring Component
 * Displays child's grades, attendance, and schedule for parent monitoring
 * Phase 13.3: Parent Portal
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { AlertCircle, TrendingUp, TrendingDown, Clock, User } from 'lucide-react';

interface Grade {
  subject: string;
  marks: number;
  maxMarks: number;
  trend: 'up' | 'down' | 'stable';
}

interface ScheduleItem {
  subject: string;
  teacher: string;
  time: string;
  room: string;
}

interface ChildMonitoringProps {
  childName: string;
  grades: Grade[];
  attendance: number;
  schedule: ScheduleItem[];
  isLoading?: boolean;
}

type TabType = 'grades' | 'attendance' | 'schedule';

export const ChildMonitoring: React.FC<ChildMonitoringProps> = ({
  childName,
  grades,
  attendance,
  schedule,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('grades');

  const isAtRisk = attendance < 80;

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        {(['grades', 'attendance', 'schedule'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium border-b-2 transition ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Grades Tab */}
      {activeTab === 'grades' && (
        <Card>
          <CardHeader>
            <CardTitle>{childName}'s Grades</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {grades.map((grade, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-lg">{grade.subject}</p>
                    <p className="text-sm text-gray-600">
                      {grade.marks}/{grade.maxMarks}
                    </p>
                  </div>
                  <div className="text-right">
                    {grade.trend === 'up' && (
                      <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <TrendingUp className="w-4 h-4" />
                        Improving
                      </div>
                    )}
                    {grade.trend === 'down' && (
                      <div className="flex items-center gap-1 text-red-600 text-sm font-medium">
                        <TrendingDown className="w-4 h-4" />
                        Declining
                      </div>
                    )}
                    {grade.trend === 'stable' && (
                      <div className="text-gray-600 text-sm font-medium">Stable</div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      grade.marks >= 80 ? 'bg-green-600' :
                      grade.marks >= 70 ? 'bg-yellow-600' :
                      'bg-red-600'
                    }`}
                    style={{ width: `${(grade.marks / grade.maxMarks) * 100}%` }}
                  />
                </div>
              </div>
            ))}

            {/* Parent Insights */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-semibold text-blue-900 mb-2">💡 Parent Insights</p>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• {childName} is performing well in most subjects</li>
                <li>• Focus areas: Review performance trends regularly</li>
                <li>• Encourage participation in class discussions</li>
                <li>• Schedule regular study sessions</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <Card>
          <CardHeader>
            <CardTitle>{childName}'s Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Attendance Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-600">Attendance %</p>
                <p className="text-2xl font-bold text-green-600">{attendance}%</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-600">Status</p>
                <p className={`text-sm font-bold ${
                  attendance >= 80 ? 'text-blue-600' : 'text-orange-600'
                }`}>
                  {attendance >= 80 ? 'Good' : 'At Risk'}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600">Target</p>
                <p className="text-2xl font-bold text-purple-600">80%</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Overall Attendance Progress</p>
                <p className="text-sm font-semibold text-gray-900">{attendance}%</p>
              </div>
              <div className="bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    attendance >= 80 ? 'bg-green-600' :
                    attendance >= 70 ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{ width: `${Math.min(attendance, 100)}%` }}
                />
              </div>
            </div>

            {/* At-Risk Alert */}
            {isAtRisk && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-yellow-900">Attendance Below Target</p>
                  <p className="text-sm text-yellow-800">
                    {childName}'s attendance is below 80%. Please encourage regular attendance.
                  </p>
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="font-semibold text-blue-900 mb-2">📋 Recommendations</p>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Ensure child attends school regularly</li>
                <li>• Communicate with school if absences are expected</li>
                <li>• Monitor attendance weekly</li>
                {isAtRisk && <li>• Schedule meeting with class teacher</li>}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <Card>
          <CardHeader>
            <CardTitle>{childName}'s Weekly Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {schedule.map((item, idx) => (
                <div key={idx} className="p-4 border rounded-lg hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-lg text-gray-900">{item.subject}</p>
                      
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <User className="w-4 h-4" />
                          <span>{item.teacher}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{item.time}</span>
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                        Room {item.room}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ChildMonitoring;
