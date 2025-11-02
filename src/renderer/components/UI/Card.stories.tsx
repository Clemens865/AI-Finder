import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardContent } from './Card';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'This is a card with default styling',
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: 'This is an outlined card',
  },
};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: 'This is an elevated card with shadow',
  },
};

export const WithHeader: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600 dark:text-gray-400">
          This card has a header and content section.
        </p>
      </CardContent>
    </Card>
  ),
};

export const NoPadding: Story = {
  args: {
    padding: 'none',
    children: <div className="p-4 bg-gray-100 dark:bg-gray-800">Custom padding content</div>,
  },
};
