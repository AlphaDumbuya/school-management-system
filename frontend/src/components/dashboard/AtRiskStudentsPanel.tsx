import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';

export interface AtRiskStudent {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  riskFactors: string[];
  attendanceRate: number;
  averageGrade: number;
  severity: 'high' | 'medium' | 'low';
}

export interface AtRiskStudentsPanelProps {
  students: AtRiskStudent[];
  onStudentClick?: (student: AtRiskStudent) => void;
}

const severityColors = {
  high: { bg: 'bg-red-100', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-600' },
  medium: { bg: 'bg-amber-100', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-600' },
  low: { bg: 'bg-blue-100', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-600' },
};

const SeverityBadge: React.FC<{ severity: 'high' | 'medium' | 'low' }> = ({ severity }) => {
  const colors = severityColors[severity];
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-semibold text-white ${colors.badge}`}
    >
      {severity.toUpperCase()}
    </span>
  );
};

export const AtRiskStudentsPanel: React.FC<AtRiskStudentsPanelProps> = ({
  students,
  onStudentClick,
}) => {
  if (students.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Students at Risk</h3>
        <div className="text-center py-8">
          <p className="text-gray-500">No students at risk</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="text-red-500" size={20} />
        <h3 className="text-lg font-semibold text-gray-800">Students at Risk ({students.length})</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 px-4 font-semibold text-gray-700">Name</th>
              <th className="text-left py-2 px-4 font-semibold text-gray-700">Roll No.</th>
              <th className="text-left py-2 px-4 font-semibold text-gray-700">Class</th>
              <th className="text-left py-2 px-4 font-semibold text-gray-700">Risk Factors</th>
              <th className="text-center py-2 px-4 font-semibold text-gray-700">Attendance</th>
              <th className="text-center py-2 px-4 font-semibold text-gray-700">Grade</th>
              <th className="text-center py-2 px-4 font-semibold text-gray-700">Severity</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const colors = severityColors[student.severity];
              return (
                <tr
                  key={student.id}
                  onClick={() => onStudentClick?.(student)}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${colors.bg}`}
                >
                  <td className="py-3 px-4 font-medium">{student.name}</td>
                  <td className="py-3 px-4 text-gray-600">{student.rollNumber}</td>
                  <td className="py-3 px-4 text-gray-600">{student.className}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1 flex-wrap">
                      {student.riskFactors.map((factor) => (
                        <span
                          key={factor}
                          className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium"
                        >
                          {factor}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={student.attendanceRate < 75 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                      {student.attendanceRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={student.averageGrade < 40 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                      {student.averageGrade.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <SeverityBadge severity={student.severity} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AtRiskStudentsPanel;
