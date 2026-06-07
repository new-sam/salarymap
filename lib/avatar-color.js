// Hash a seed (email or name) to one of N preset palettes.
// Used for candidate avatars across the company ATS.
const AVATAR_PALETTES = [
  { bg: 'bg-primary-100', text: 'text-primary-800' },
  { bg: 'bg-blue-100',    text: 'text-blue-800'    },
  { bg: 'bg-violet-100',  text: 'text-violet-800'  },
  { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { bg: 'bg-amber-100',   text: 'text-amber-800'   },
  { bg: 'bg-pink-100',    text: 'text-pink-800'    },
  { bg: 'bg-sky-100',     text: 'text-sky-800'     },
  { bg: 'bg-rose-100',    text: 'text-rose-800'    },
];

export function avatarColorFor(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}

export function initialOf(name = '') {
  const s = name.trim();
  if (!s) return '?';
  // Korean — first character is enough
  if (/[가-힣]/.test(s[0])) return s[0];
  // English — first letter of first word, plus first letter of last word if available
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return s[0].toUpperCase();
}
