import { useState } from 'react';
import { useSettingsStore } from '@store/settingsStore';
import { Input, Button, Badge, Card } from '@components/UI';
import { Settings as SettingsIcon, Moon, Sun, Monitor, Bell, X } from 'lucide-react';

export const Settings = () => {
  const {
    theme,
    apiKey,
    maxResults,
    searchDepth,
    fileTypes,
    excludePatterns,
    notifications,
    setTheme,
    setApiKey,
    updateSettings,
    addFileType,
    removeFileType,
    addExcludePattern,
    removeExcludePattern,
    toggleNotifications,
  } = useSettingsStore();

  const [newFileType, setNewFileType] = useState('');
  const [newPattern, setNewPattern] = useState('');

  const handleAddFileType = () => {
    if (newFileType.trim()) {
      addFileType(newFileType.trim());
      setNewFileType('');
    }
  };

  const handleAddPattern = () => {
    if (newPattern.trim()) {
      addExcludePattern(newPattern.trim());
      setNewPattern('');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto scrollbar-thin">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          Settings
        </h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Theme Settings */}
        <Card padding="md">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Appearance
          </h3>
          <div className="flex gap-2">
            {[
              { value: 'light', icon: Sun, label: 'Light' },
              { value: 'dark', icon: Moon, label: 'Dark' },
              { value: 'auto', icon: Monitor, label: 'Auto' },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value as any)}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  theme === value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* API Key */}
        <Card padding="md">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            API Configuration
          </h3>
          <Input
            type="password"
            label="Anthropic API Key"
            value={apiKey || ''}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            helperText="Your API key is stored locally and never sent to our servers"
          />
        </Card>

        {/* Search Settings */}
        <Card padding="md">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Search Configuration
          </h3>
          <div className="space-y-4">
            <Input
              type="number"
              label="Max Results"
              value={maxResults}
              onChange={(e) => updateSettings({ maxResults: parseInt(e.target.value) })}
              min={1}
              max={1000}
            />
            <Input
              type="number"
              label="Search Depth"
              value={searchDepth}
              onChange={(e) => updateSettings({ searchDepth: parseInt(e.target.value) })}
              min={1}
              max={10}
              helperText="Maximum directory depth to search"
            />
          </div>
        </Card>

        {/* File Types */}
        <Card padding="md">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            File Types
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder=".ts, .js, etc."
              value={newFileType}
              onChange={(e) => setNewFileType(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFileType()}
            />
            <Button onClick={handleAddFileType} size="sm">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {fileTypes.map((type) => (
              <Badge key={type} variant="primary" className="pr-1">
                {type}
                <button
                  onClick={() => removeFileType(type)}
                  className="ml-2 hover:text-primary-900 dark:hover:text-primary-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </Card>

        {/* Exclude Patterns */}
        <Card padding="md">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Exclude Patterns
          </h3>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="node_modules, dist, etc."
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPattern()}
            />
            <Button onClick={handleAddPattern} size="sm">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {excludePatterns.map((pattern) => (
              <Badge key={pattern} variant="warning" className="pr-1">
                {pattern}
                <button
                  onClick={() => removeExcludePattern(pattern)}
                  className="ml-2 hover:text-yellow-900 dark:hover:text-yellow-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </Card>

        {/* Notifications */}
        <Card padding="md">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">
            Notifications
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Enable notifications
              </span>
            </div>
            <button
              onClick={toggleNotifications}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications.enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
