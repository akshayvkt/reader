'use client';

interface BookCoverProps {
  coverUrl: string | null;
  title: string;
  size?: 'small' | 'large';
}

// Generate a consistent color from title string
function generateColor(title: string): string {
  const colors = [
    '#8B7355', // warm brown
    '#6B8E8E', // sage teal
    '#9B8AA5', // dusty purple
    '#A68B6A', // camel
    '#7A8B7A', // olive green
    '#8B7B7B', // mauve
    '#6B7B8B', // slate blue
    '#8B8B6B', // khaki
  ];

  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

export default function BookCover({ coverUrl, title, size = 'small' }: BookCoverProps) {
  const aspectRatio = '2 / 3'; // Standard book ratio
  const width = size === 'large' ? '168px' : '144px';
  const fontSize = size === 'large' ? '16px' : '13px';
  const padding = size === 'large' ? '20px' : '14px';

  if (coverUrl) {
    return (
      <div
        style={{
          width,
          aspectRatio,
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: '4px',
        }}
      />
    );
  }

  // Placeholder cover with title
  const bgColor = generateColor(title);

  return (
    <div
      className="flex items-end"
      style={{
        width,
        aspectRatio,
        background: bgColor,
        borderRadius: '4px',
        padding,
      }}
    >
      <p
        className="font-medium leading-tight"
        style={{
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize,
          fontFamily: 'var(--font-libre-baskerville)',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {title}
      </p>
    </div>
  );
}
