import { useMatchStore } from '@store/matchStore';
import { Card, Badge } from '@components/UI';
import { FileText, Hash } from 'lucide-react';
import clsx from 'clsx';

export const MatchList = () => {
  const { matches, selectedMatch, selectMatch } = useMatchStore();

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-4 space-y-2">
      {matches.map((match, index) => (
        <Card
          key={index}
          padding="sm"
          className={clsx(
            'cursor-pointer transition-all hover:shadow-md',
            {
              'border-primary-500 bg-primary-50 dark:bg-primary-900/20': selectedMatch === match,
            }
          )}
          onClick={() => selectMatch(match)}
        >
          {/* File Name */}
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate flex-1">
              {match.file}
            </span>
            <Badge variant="primary" size="sm">
              {match.totalScore.toFixed(1)}
            </Badge>
          </div>

          {/* Match Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              <span>{match.matches.length} matches</span>
            </div>
          </div>

          {/* Preview */}
          {match.preview && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
              {match.preview}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
