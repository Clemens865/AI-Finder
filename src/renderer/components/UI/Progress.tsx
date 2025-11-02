import { HTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
}

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = 'md',
      color = 'primary',
      showLabel = false,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeStyles = {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    };

    const colorStyles = {
      primary: 'bg-primary-600',
      secondary: 'bg-secondary-600',
      success: 'bg-green-600',
      warning: 'bg-yellow-600',
      danger: 'bg-red-600',
    };

    return (
      <div className="w-full" ref={ref} {...props}>
        {showLabel && (
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progress
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {percentage.toFixed(0)}%
            </span>
          </div>
        )}
        <div
          className={clsx(
            'w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden',
            sizeStyles[size],
            className
          )}
        >
          <div
            className={clsx(
              'h-full transition-all duration-300 ease-in-out rounded-full',
              colorStyles[color]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';
