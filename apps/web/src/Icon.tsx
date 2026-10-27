const shapes = {
  list: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m7 8 1 1 2-2M13 8h4m-10 8 1 1 2-2m3 1h4" />
    </>
  ),
  "arrow-left": <path d="m12 5-7 7 7 7M5 12h15" />,
  "arrow-right": <path d="m12 5 7 7-7 7M4 12h15" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="m16 3 5 5L9 20l-6 1 1-6ZM13 6l5 5" />,
  upload: <path d="M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4" />,
  download: <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />,
  send: <path d="m22 2-7 20-4-9-9-4ZM22 2 11 13" />,
  check: <path d="m5 12 4 4L19 6" />,
  cancel: <path d="m6 6 12 12M6 18 18 6" />,
  feedback: (
    <>
      <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-5 4V6a2 2 0 0 1 2-2Z" />
      <path d="M7 9h10M7 13h6" />
    </>
  ),
  refresh: <path d="M20 7v5h-5M4 17v-5h5M5.5 7a7 7 0 0 1 12-2L20 8M4 16l2.5 3a7 7 0 0 0 12-2" />,
  reset: <path d="M3 4v6h6M3.5 10a9 9 0 1 1 1 7" />,
  power: <path d="M12 2v10M6 5a9 9 0 1 0 12 0" />,
  unlock: (
    <>
      <rect x="4" y="10" width="16" height="12" rx="2" />
      <path d="M8 10V6a4 4 0 0 1 8 0M12 15v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5h4" />
    </>
  ),
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 20a2 2 0 0 0 4 0" />,
  external: (
    <path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
  ),
  // GitHub's mark: https://github.githubassets.com/favicons/favicon.svg
  github: (
    <path
      fill="currentColor"
      stroke="none"
      d="M16 0C7.16 0 0 7.16 0 16C0 23.08 4.58 29.06 10.94 31.18C11.74 31.32 12.04 30.84 12.04 30.42C12.04 30.04 12.02 28.78 12.02 27.44C8 28.18 6.96 26.46 6.64 25.56C6.46 25.1 5.68 23.68 5 23.3C4.44 23 3.64 22.26 4.98 22.24C6.24 22.22 7.14 23.4 7.44 23.88C8.88 26.3 11.18 25.62 12.1 25.2C12.24 24.16 12.66 23.46 13.12 23.06C9.56 22.66 5.84 21.28 5.84 15.16C5.84 13.42 6.46 11.98 7.48 10.86C7.32 10.46 6.76 8.82 7.64 6.62C7.64 6.62 8.98 6.2 12.04 8.26C13.32 7.9 14.68 7.72 16.04 7.72C17.4 7.72 18.76 7.9 20.04 8.26C23.1 6.18 24.44 6.62 24.44 6.62C25.32 8.82 24.76 10.46 24.6 10.86C25.62 11.98 26.24 13.4 26.24 15.16C26.24 21.3 22.5 22.66 18.94 23.06C19.52 23.56 20.02 24.52 20.02 26.02C20.02 28.16 20 29.88 20 30.42C20 30.84 20.3 31.34 21.1 31.18C27.42 29.06 32 23.06 32 16C32 7.16 24.84 0 16 0V0Z"
    />
  ),
};

// Icons supplement visible labels without adding duplicate screen reader names.
export function Icon({ name }: { name: keyof typeof shapes }) {
  return (
    <svg
      className="icon"
      width="16"
      height="16"
      viewBox={name === "github" ? "0 0 32 32" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}
