/**
 * Schedule Viewer Component
 * Displays student's weekly schedule and upcoming classes
 * Phase 13.2: Student Portal
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Clock, MapPin, User } from 'lucide-react';

interface ClassSession {
  subject: string;
  teacher: string;
  time: string;
  room: string;
  day?: string;
}

interface ScheduleViewerProps {
  classes: ClassSession[];
  isLoading?: boolean;
}

export const ScheduleViewer: React.FC<ScheduleViewerProps> = ({
  classes,
  isLoading = false,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Class Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {classes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No scheduled classes</p>
            </div>
          ) : (
            classes.map((cls, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition"
              >
                <div className="flex-1">
                  <p className="font-semibold text-lg text-gray-900">{cls.subject}</p>
                  
                  <div className="mt-3 space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="w-4 h-4" />
                      <span>{cls.teacher}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{cls.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>Room {cls.room}</span>
                    </div>
                  </div>
                </div>

                {cls.day && (
                  <div className="ml-4 text-right">
                    <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                      {cls.day}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Additional Information */}
        {classes.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-2">Schedule Information</p>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• Check your class schedule regularly</li>
              <li>• Arrive 5 minutes before class time</li>
              <li>• Contact your teacher if you have schedule conflicts</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScheduleViewer;
