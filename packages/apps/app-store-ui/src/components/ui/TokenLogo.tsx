import React, { useState } from 'react';

interface TokenLogoProps {
  token: {
    symbol: string;
    logo_url?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const TokenLogo: React.FC<TokenLogoProps> = ({
  token,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const logo_url = token.logo_url;
  const fallbackText = token.symbol.slice(0, 2).toUpperCase();

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold overflow-hidden ${className}`}>
      {logo_url && !imageError ? (
        <img
          src={logo_url}
          alt={`${token.symbol} logo`}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span>{fallbackText}</span>
      )}
    </div>
  );
};
