import { useMatchStore } from '@store/matchStore';
import { Card, Badge } from '@components/UI';
import { FileText, MapPin, Award } from 'lucide-react';

export const MatchDetail = () => {
  const { selectedMatch } = useMatchStore();

  if (!selectedMatch) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        Select a match to view details
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4">
      <Card padding="md">
        {/* File Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
          <FileText className="w-6 h-6 text-primary-500" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {selectedMatch.file}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="primary" size="sm">
                <Award className="w-3 h-3 mr-1 inline" />
                Score: {selectedMatch.totalScore.toFixed(2)}
              </Badge>
              <Badge variant="info" size="sm">
                {selectedMatch.matches.length} matches
              </Badge>
            </div>
          </div>
        </div>

        {/* Matches List */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">
            Match Details
          </h4>

          {selectedMatch.matches.map((match, index) => (
            <Card
              key={index}
              variant="outlined"
              padding="sm"
              className="bg-gray-50 dark:bg-gray-800/50"
            >
              {/* Location */}
              <div className="flex items-center gap-2 mb-2 text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4" />
                <span>
                  Line {match.line}, Column {match.column}
                </span>
                <Badge variant="success" size="sm">
                  {match.score.toFixed(1)}
                </Badge>
              </div>

              {/* Matched Text */}
              <div className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                <code className="text-sm font-mono text-gray-800 dark:text-gray-200">
                  {match.text}
                </code>
              </div>

              {/* Context */}
              {match.context && (
                <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
                  {match.context}
                </div>
              )}
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
