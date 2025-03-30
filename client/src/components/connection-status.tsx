import React from 'react';
import { useSocketManager } from '@/hooks/use-socket-manager';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConnectionStatusProps {
  showTooltip?: boolean;
  variant?: 'badge' | 'indicator' | 'minimal';
  className?: string;
}

/**
 * Component to display the current socket connection status
 * Can be used across different pages for consistent status indication
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showTooltip = true,
  variant = 'badge',
  className = '',
}) => {
  // Get connection status from socket manager
  const { connected, connecting } = useSocketManager();
  
  // Determine status text and colors
  const status = connected ? 'connected' : connecting ? 'connecting' : 'disconnected';
  
  const getBgColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-100';
      case 'connecting': return 'bg-yellow-100';
      case 'disconnected': return 'bg-red-100';
    }
  };
  
  const getTextColor = () => {
    switch (status) {
      case 'connected': return 'text-green-800';
      case 'connecting': return 'text-yellow-800';
      case 'disconnected': return 'text-red-800';
    }
  };
  
  const getDotColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
    }
  };
  
  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
    }
  };
  
  // Tooltip content
  const tooltipContent = (
    <div className="text-center">
      <div className="font-bold">Server Connection</div>
      <div>{getStatusText()}</div>
      {!connected && (
        <div className="text-xs mt-1">
          {connecting 
            ? 'Attempting to connect to the game server...'
            : 'Connection to the game server has been lost. Trying to reconnect...'}
        </div>
      )}
    </div>
  );
  
  // Render different variants
  const renderContent = () => {
    switch (variant) {
      case 'badge':
        return (
          <Badge 
            variant={status === 'connected' ? 'default' : status === 'connecting' ? 'outline' : 'destructive'}
            className={`${getBgColor()} ${getTextColor()} ${className}`}
          >
            <div className={`w-2 h-2 rounded-full mr-2 ${getDotColor()}`}></div>
            {getStatusText()}
          </Badge>
        );
      
      case 'indicator':
        return (
          <div className={`inline-flex items-center px-2 py-1 rounded-full ${getBgColor()} ${getTextColor()} text-sm ${className}`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${getDotColor()}`}></div>
            {getStatusText()}
          </div>
        );
      
      case 'minimal':
        return (
          <div className={`inline-flex items-center ${className}`}>
            <div className={`w-2 h-2 rounded-full ${getDotColor()}`}></div>
          </div>
        );
    }
  };
  
  // Wrap in tooltip if needed
  return showTooltip ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {renderContent()}
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    renderContent()
  );
};