import React from 'react';

const paths = {
  products: <><path d="m3 7 9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10M7 5l10 5"/></>,
  plus: <path d="M12 4v16M4 12h16"/>,
  edit: <><path d="m15 4 5 5M4 20l4-1L21 6l-5-5L3 14z"/></>,
  cloud: <path d="M7 18h11a4 4 0 0 0 .2-8A6.5 6.5 0 0 0 6 8.5 4.8 4.8 0 0 0 1 13.3 4.8 4.8 0 0 0 7 18Z"/>,
  overview: <><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>,
  apps: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  list: <><path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></>,
  verification: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
  subscriptions: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 15h4"/></>,
  gifts: <><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M2 9h20M12 9c-4-1-5-6-2-6 2 0 2 3 2 6Zm0 0c4-1 5-6 2-6-2 0-2 3-2 6Z"/></>,
  appearance: <><circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none"/></>,
  logs: <><path d="M8 5h13M8 12h13M8 19h13"/><circle cx="3" cy="5" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="19" r="1"/></>,
  preferences: <><path d="M3 6h18M3 18h18M3 12h18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/></>,
  external: <><path d="M14 3h7v7M21 3l-9 9M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
  left: <path d="m14 6-6 6 6 6"/>, right: <path d="m10 6 6 6-6 6"/>,
  search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>, check: <path d="m5 12 4 4L19 6"/>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  refresh: <><path d="M20 7V3l-3 3a8 8 0 1 0 2 12M20 3h-5"/></>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  star: <path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9Z"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4"/></>,
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
  logout: <><path d="M9 3H3v18h6m0-9h12m-4-4 4 4-4 4"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/></>,
};

export default function Icon({ name = 'apps', size = 18, className = '', ...props }) {
  return <svg className={`cloud-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name] || paths.apps}</svg>;
}
