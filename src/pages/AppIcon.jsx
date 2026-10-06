const paths = {
  microphone: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4Z" /></>,
  sound: <><path d="m11 5-6 4H2v6h3l6 4ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>,
  message: <path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3ZM7 8h10M7 12h6" />,
  gift: <><path d="M3 8h18v4H3ZM5 12v9h14v-9M12 8v13" /><path d="M12 8H8a3 3 0 1 1 3-4l1 4Zm0 0h4a3 3 0 1 0-3-4l-1 4Z" /></>,
  radio: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="m6 7 12-5M7 11h10M17 15v3" /><circle cx="8" cy="16" r="2" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
  share: <><circle cx="18" cy="4" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="20" r="3" /><path d="m9 10 6-4M9 14l6 4" /></>,
  users: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  camera: <><path d="m8 4-2 3H3v14h18V7h-3l-2-3Z" /><circle cx="12" cy="13" r="4" /></>,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 14a4 4 0 0 0 8 0M8 8v1M16 8v1" /></>,
  shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" /><path d="m8 12 3 3 5-6" /></>,
  phone: <path d="m7 3 3 5-3 3a16 16 0 0 0 6 6l3-3 5 3c0 3-2 5-5 4A20 20 0 0 1 3 8C2 5 4 3 7 3Z" />,
  key: <><circle cx="8" cy="8" r="5" /><path d="m12 12 9 9M16 16l3-3M19 19l3-3" /></>,
  game: <><path d="M7 7h10c3 0 4 3 5 10 0 3-3 4-5 1l-2-2H9l-2 2c-2 3-5 2-5-1C3 10 4 7 7 7Z" /><path d="M5 11h6M8 8v6M16 11h.01M19 13h.01" /></>,
  trophy: <><path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 15v6M8 21h8" /></>,
  pie: <><path d="M3 10h18l-2 10H5ZM3 10a9 9 0 0 1 18 0M8 5l2 3M14 5l2 3M8 14h8" /></>,
  link: <><path d="m9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" /></>,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
};

export default function AppIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name] || paths.gift}
    </svg>
  );
}
