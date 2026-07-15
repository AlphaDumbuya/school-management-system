import React, { useState } from 'react';

export interface AvatarItem {
  src?: string;
  name: string;
}

export interface AvatarGroupProps {
  avatars: AvatarItem[];
  max?: number;
  size?: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface SingleAvatarProps {
  avatar: AvatarItem;
  size: number;
  marginLeft: number;
}

const SingleAvatar: React.FC<SingleAvatarProps> = ({ avatar, size, marginLeft }) => {
  const [hasError, setHasError] = useState(false);
  const showInitials = !avatar.src || hasError;

  return (
    <div
      style={{ width: size, height: size, marginLeft }}
      className="rounded-full ring-2 ring-white overflow-hidden flex-shrink-0 bg-gray-200 flex items-center justify-center"
    >
      {showInitials ? (
        <span className="text-xs font-medium text-gray-600 select-none">
          {getInitials(avatar.name)}
        </span>
      ) : (
        <img
          src={avatar.src}
          alt={avatar.name}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 5,
  size = 32,
}) => {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;

  return (
    <div className="flex items-center">
      {visible.map((avatar, index) => (
        <SingleAvatar
          key={`${avatar.name}-${index}`}
          avatar={avatar}
          size={size}
          marginLeft={index > 0 ? -8 : 0}
        />
      ))}
      {overflow > 0 && (
        <div
          style={{ width: size, height: size, marginLeft: -8 }}
          className="rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center flex-shrink-0"
        >
          <span className="text-xs font-medium text-gray-600">+{overflow}</span>
        </div>
      )}
    </div>
  );
};

export default AvatarGroup;
