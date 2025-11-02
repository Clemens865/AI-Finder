import { useLoadingStore } from '@store/loadingStore';
import { Spinner, Progress } from '@components/UI';

export const LoadingOverlay = () => {
  const { message, progress } = useLoadingStore();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-8 shadow-2xl max-w-md w-full mx-4">
        <div className="flex flex-col items-center">
          <Spinner size="xl" color="primary" />

          {message && (
            <p className="mt-4 text-lg font-medium text-gray-900 dark:text-white text-center">
              {message}
            </p>
          )}

          {progress !== undefined && (
            <div className="w-full mt-6">
              <Progress value={progress} showLabel color="primary" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
