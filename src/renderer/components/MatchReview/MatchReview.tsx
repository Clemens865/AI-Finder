import { useState } from 'react';
import { useMatchStore } from '@store/matchStore';
import { MatchList } from './MatchList';
import { MatchDetail } from './MatchDetail';
import { Target } from 'lucide-react';
import { Progress } from '@components/UI';

export const MatchReview = () => {
  const { matches, selectedMatch, isSearching, searchProgress } = useMatchStore();
  const [view, setView] = useState<'list' | 'detail'>('list');

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5" />
            Matches
            {matches.length > 0 && (
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({matches.length})
              </span>
            )}
          </h2>

          {matches.length > 0 && (
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 text-sm rounded ${
                  view === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
                onClick={() => setView('list')}
              >
                List
              </button>
              <button
                className={`px-3 py-1 text-sm rounded ${
                  view === 'detail'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
                onClick={() => setView('detail')}
                disabled={!selectedMatch}
              >
                Detail
              </button>
            </div>
          )}
        </div>

        {/* Search Progress */}
        {isSearching && (
          <Progress value={searchProgress} showLabel color="primary" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {matches.length === 0 && !isSearching ? (
          <div className="flex items-center justify-center h-full text-center p-4">
            <div className="max-w-md">
              <Target className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No matches yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Start a search to find matching files and content.
              </p>
            </div>
          </div>
        ) : view === 'list' ? (
          <MatchList />
        ) : (
          <MatchDetail />
        )}
      </div>
    </div>
  );
};
