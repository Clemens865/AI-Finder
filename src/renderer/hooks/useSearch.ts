import { useCallback } from 'react';
import { useMatchStore } from '@store/matchStore';
import { useNotificationStore } from '@store/notificationStore';
import { MatchResult } from '@types/index';

export const useSearch = () => {
  const { setMatches, setIsSearching, setSearchProgress } = useMatchStore();
  const { addNotification } = useNotificationStore();

  const search = useCallback(
    async (query: string) => {
      try {
        setIsSearching(true);
        setSearchProgress(0);

        // In production, this would call the search backend
        // For now, simulate search
        for (let i = 0; i <= 100; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          setSearchProgress(i);
        }

        const mockResults: MatchResult[] = [
          {
            file: '/src/index.ts',
            matches: [
              {
                line: 10,
                column: 5,
                text: 'export function search()',
                context: 'export function search(query: string) { ... }',
                score: 0.95,
              },
            ],
            totalScore: 0.95,
            preview: 'export function search(query: string) { ... }',
          },
        ];

        setMatches(mockResults);

        addNotification({
          type: 'success',
          title: 'Search Complete',
          message: `Found ${mockResults.length} matches`,
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Search Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setIsSearching(false);
      }
    },
    [setMatches, setIsSearching, setSearchProgress, addNotification]
  );

  return {
    search,
  };
};
