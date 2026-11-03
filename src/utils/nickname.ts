// Strict Korean fixed names specified by user
export const FIXED_NAMES = [
  '붐', '로스', '문호', '모노', '폰테', '디렉', '젠티', '채나',
  '벡스', '파필리온', '스타릿', '아티', '키', '토이엇', '세이지', '플로라',
  '퀵사', '하윤', '딜리', '멜라니', '링', '폰'
] as const;

// Curated colorful Korean adjective prefixes fitting the Angel vs Devil cartoon fantasy theme
export const ADJECTIVE_PREFIXES = [
  '용감한', '졸린', '수상한', '명랑한', '불길한',
  '날쌘', '신비로운', '엉뚱한', '화려한', '당당한',
  '조용한', '짜릿한', '빛나는', '어둠의', '불꽃의',
  '새벽의', '황혼의', '장난꾸러기', '눈부신', '침착한',
  '열정적인', '날렵한', '달콤한', '차가운', '뜨거운',
  '빛의', '심연의', '유쾌한', '호기심많은', '신속한'
] as const;

export function generateRandomNickname(): string {
  const prefix = ADJECTIVE_PREFIXES[Math.floor(Math.random() * ADJECTIVE_PREFIXES.length)];
  const name = FIXED_NAMES[Math.floor(Math.random() * FIXED_NAMES.length)];
  return `${prefix} ${name}`;
}
