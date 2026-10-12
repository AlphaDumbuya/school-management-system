/**
 * Draws the profile pictures used by the public demo school
 * (frontend/public/demo-avatars/*.svg). Small flat illustrations, so the demo
 * looks alive without using any real child's photo. Re-run to regenerate:
 *
 *   node frontend/scripts/generate-demo-avatars.cjs
 *
 * Files: s-b01..s-b16 (schoolboys), s-g01..s-g16 (schoolgirls),
 *        a-m01..a-m08 (men), a-f01..a-f08 (women).
 */
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '../public/demo-avatars');
fs.mkdirSync(OUT, { recursive: true });

const SKIN = [
  { base: '#8d5524', shade: '#76451c' }, { base: '#6f4018', shade: '#5a3213' }, { base: '#a0693a', shade: '#85552d' },
  { base: '#5c3317', shade: '#49290f' }, { base: '#7a4a24', shade: '#633b1b' }, { base: '#4a2c14', shade: '#3a200d' },
  { base: '#b07a4a', shade: '#966339' }, { base: '#654321', shade: '#513419' },
];
const HAIR = ['#14100e', '#1d1512', '#261a14', '#0f0c0b'];
const BG = ['#dbeafe', '#fde68a', '#d1fae5', '#fce7f3', '#e0e7ff', '#fed7aa', '#cffafe', '#ede9fe'];
const TUNIC = ['#1d4ed8', '#1e3a8a', '#0f766e', '#7f1d1d'];
const SUIT = ['#1f2937', '#374151', '#1e3a8a', '#44403c'];
const BLOUSE = ['#be185d', '#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#9f1239'];

const pickN = (arr, i) => arr[i % arr.length];

function face(skin, mood = 0) {
  const mouth = mood % 2 === 0
    ? `<path d="M55 71 Q64 79 73 71" fill="none" stroke="#5b1f1f" stroke-width="2.2" stroke-linecap="round"/>`
    : `<path d="M54 70 Q64 82 74 70 Q64 74 54 70Z" fill="#7a2b2b"/><path d="M57 71.5 Q64 75 71 71.5" fill="#fff" opacity=".9"/>`;
  return `
  <ellipse cx="64" cy="58" rx="23" ry="27" fill="${skin.base}"/>
  <circle cx="41.5" cy="60" r="5" fill="${skin.base}"/><circle cx="86.5" cy="60" r="5" fill="${skin.base}"/>
  <ellipse cx="53" cy="58" rx="2.7" ry="3.2" fill="#1a1110"/><ellipse cx="75" cy="58" rx="2.7" ry="3.2" fill="#1a1110"/>
  <circle cx="53.9" cy="57" r=".9" fill="#fff"/><circle cx="75.9" cy="57" r=".9" fill="#fff"/>
  <path d="M47.5 50 Q53 47 58.5 50" fill="none" stroke="#1a1110" stroke-width="2" stroke-linecap="round"/>
  <path d="M69.5 50 Q75 47 80.5 50" fill="none" stroke="#1a1110" stroke-width="2" stroke-linecap="round"/>
  <path d="M62.5 62 Q64 67 66 63" fill="none" stroke="${skin.shade}" stroke-width="1.8" stroke-linecap="round"/>
  ${mouth}`;
}

function hairBack(style, hair) {
  switch (style) {
    case 'afro': return `<ellipse cx="64" cy="42" rx="31" ry="26" fill="${hair}"/>`;
    case 'braids': return `<rect x="36" y="46" width="9" height="52" rx="4.5" fill="${hair}"/><rect x="83" y="46" width="9" height="52" rx="4.5" fill="${hair}"/>
      <g stroke="#00000033" stroke-width="1"><path d="M36 60h9M36 70h9M36 80h9M36 90h9M83 60h9M83 70h9M83 80h9M83 90h9"/></g>`;
    case 'long': return `<path d="M34 54 C32 90 40 100 46 100 L82 100 C88 100 96 90 94 54 Z" fill="${hair}"/>`;
    case 'puffs': return `<circle cx="40" cy="34" r="12" fill="${hair}"/><circle cx="88" cy="34" r="12" fill="${hair}"/>`;
    case 'bun': return `<circle cx="64" cy="22" r="11" fill="${hair}"/>`;
    default: return '';
  }
}

function hairFront(style, hair) {
  switch (style) {
    case 'short': return `<path d="M40 54 C38 26 90 26 88 54 C84 42 74 37 64 37 C54 37 44 42 40 54Z" fill="${hair}"/>`;
    case 'fade': return `<path d="M41 50 C41 31 87 31 87 50 C80 43 48 43 41 50Z" fill="${hair}"/>`;
    case 'afro': return `<path d="M41 52 C42 38 86 38 87 52 C80 44 48 44 41 52Z" fill="${hair}"/>`;
    case 'cornrows': return `<path d="M40 54 C38 26 90 26 88 54 C84 42 74 37 64 37 C54 37 44 42 40 54Z" fill="${hair}"/>
      <g stroke="#ffffff22" stroke-width="1.2" fill="none"><path d="M50 36 Q48 44 46 50M57 34 Q56 43 55 49M64 33 V47M71 34 Q72 43 73 49M78 36 Q80 44 82 50"/></g>`;
    case 'braids': case 'long': case 'bun': case 'puffs':
      return `<path d="M40 56 C38 26 90 26 88 56 C84 42 74 36 64 36 C54 36 44 42 40 56Z" fill="${hair}"/>`;
    default: return '';
  }
}

function wrap(bg, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Profile picture">
  <rect width="128" height="128" fill="${bg}"/>${body}
</svg>
`;
}

function student(gender, i) {
  const skin = pickN(SKIN, i * 3 + (gender === 'g' ? 1 : 0));
  const hair = pickN(HAIR, i);
  const bg = pickN(BG, i + (gender === 'g' ? 3 : 0));
  const tunic = pickN(TUNIC, i);
  const boyStyles = ['short', 'fade', 'afro', 'cornrows'];
  const girlStyles = ['braids', 'bun', 'puffs', 'long'];
  const style = gender === 'b' ? pickN(boyStyles, i) : pickN(girlStyles, i);
  const body = `
  ${hairBack(style, hair)}
  <path d="M14 128 C14 103 38 95 64 95 C90 95 114 103 114 128Z" fill="${tunic}"/>
  <rect x="55" y="80" width="18" height="20" rx="6" fill="${skin.shade}"/>
  <path d="M46 96 L64 114 L82 96 L74 93 L64 103 L54 93Z" fill="#ffffff"/>
  ${gender === 'b' ? `<path d="M60 103 L64 108 L68 103 L66 114 L64 120 L62 114Z" fill="#dc2626"/>` : `<path d="M58 99 Q64 106 70 99 L67 96 Q64 100 61 96Z" fill="#f59e0b"/>`}
  ${face(skin, i)}
  ${hairFront(style, hair)}`;
  return wrap(bg, body);
}

function adult(gender, i) {
  const skin = pickN(SKIN, i * 2 + (gender === 'f' ? 1 : 0));
  const hair = pickN(HAIR, i + 1);
  const bg = pickN(BG, i + 2);
  const maleStyles = ['fade', 'short', 'cornrows', 'afro'];
  const femaleStyles = ['bun', 'long', 'puffs', 'braids'];
  const style = gender === 'm' ? pickN(maleStyles, i) : pickN(femaleStyles, i);
  let clothes;
  if (gender === 'm') {
    const suit = pickN(SUIT, i);
    clothes = `<path d="M10 128 C10 102 36 94 64 94 C92 94 118 102 118 128Z" fill="${suit}"/>
      <path d="M48 94 L64 118 L80 94 L72 92 L64 101 L56 92Z" fill="#fff"/><path d="M61 100 L64 104 L67 100 L66.5 120 L64 126 L61.5 120Z" fill="#b91c1c"/>`;
  } else {
    const top = pickN(BLOUSE, i);
    clothes = `<path d="M10 128 C10 102 36 94 64 94 C92 94 118 102 118 128Z" fill="${top}"/>
      <path d="M50 94 Q64 112 78 94 Q64 100 50 94Z" fill="${skin.shade}"/>`;
  }
  const body = `
  ${hairBack(style, hair)}
  ${clothes}
  <rect x="55" y="80" width="18" height="20" rx="6" fill="${skin.shade}"/>
  ${face(skin, i + 1)}
  ${hairFront(style, hair)}`;
  return wrap(bg, body);
}

let n = 0;
const write = (name, svg) => { fs.writeFileSync(path.join(OUT, `${name}.svg`), svg); n++; };
for (let i = 0; i < 16; i++) { write(`s-b${String(i + 1).padStart(2, '0')}`, student('b', i)); write(`s-g${String(i + 1).padStart(2, '0')}`, student('g', i)); }
for (let i = 0; i < 8; i++) { write(`a-m${String(i + 1).padStart(2, '0')}`, adult('m', i)); write(`a-f${String(i + 1).padStart(2, '0')}`, adult('f', i)); }
console.log(`wrote ${n} avatars to ${OUT}`);
