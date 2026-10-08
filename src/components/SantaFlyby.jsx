import './SantaFlyby.css';

export default function SantaFlyby() {
  return (
    <div className="santa-flyby" aria-hidden="true">
      <svg
        className="santa-flyby-silhouette"
        viewBox="0 0 220 82"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        aria-hidden="true"
      >
        <g fill="currentColor">
          {/* Reindeer pair, pulled forward toward the right */}
          <path d="M153 39c-5-5-8-10-8-15 0-2 1-4 3-5 0 3 1 5 3 7 0-5 2-9 5-11-1 5 0 9 2 12l5 2-2 4-7-2c-1 3 0 6 3 9l-4 2Z" />
          <path d="M177 37c-4-4-6-8-6-12 0-2 1-4 3-5 0 3 1 5 3 7 0-4 2-8 4-9-1 4 0 8 2 10l5 2-2 4-6-2c-1 3 0 5 2 7l-4 2Z" />
          <path d="M153 38c-5-4-10-4-15-1l-4 4 8 2 8-1 6 4 4-2-3-6Z" />
          <path d="M177 37c-5-3-9-2-13 1l-3 4 7 1 8-2 5 3 3-2-3-5Z" />
          <path d="m142 41-6-2-2 2 5 4 6-1Zm21 0-5-1-2 2 5 3 5-1Z" />
          <path d="m144 45-1 7h2l3-7Zm8-1 2 6h2l-1-7Zm17 0-1 7h2l3-7Zm8-1 2 6h2l-1-7Z" />
          {/* Fine reins */}
          <path d="M157 40c5 1 9 1 14 0l8-2 1 1-9 4-14-1Z" />
          {/* Sleigh runner and body */}
          <path d="M13 61c17 2 37 2 57-1 11-2 18-6 22-12h23c11 0 19-3 25-9l3 3c-5 9-15 13-28 14H96c-4 8-13 12-26 14-20 3-41 2-58 0l-1-3c17 2 37 2 55 0 10-1 16-4 19-8-20 3-43 3-72 0Z" />
          <path d="M25 38h52c5 0 9 3 10 8l3 8H29l-7-9c-3-4-1-7 3-7Zm4 4 4 8h49l-2-5c-1-2-3-3-6-3H29Z" />
          <path d="M36 36c1-5 4-8 9-8 4 0 7 3 8 8h-5c-1-2-2-3-4-3s-3 1-4 3Zm26 0c1-5 4-8 9-8 4 0 7 3 8 8h-5c-1-2-2-3-4-3s-3 1-4 3Z" />
          {/* Santa in the sleigh */}
          <path d="M50 37c0-5 4-9 9-9s8 4 8 9v6H50Z" />
          <path d="M49 30c2-6 6-9 11-9 5 0 9 4 10 9l-4-2-3 2-4-2-4 2-3-2Z" />
          <path d="M51 29c-4-1-5-5-2-7 1 3 3 4 6 4Zm17 0c4-1 5-5 2-7-1 3-3 4-6 4Z" />
          <path d="M51 37h16v3H51z" />
          {/* Gift sack */}
          <path d="M79 34c4-5 10-5 14 0l-2 13H79l-2-8Z" />
        </g>
        <path d="M149 42c10 1 21-1 30-5M85 56h31" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
