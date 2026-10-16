import nasheedLogo from './images/logo_nasheed_1792083522907.jpg';
import loveChillLogo from './images/logo_love_chill_1792083523142.jpg';
import jtecMusicLogo from './images/logo_jtec_music_1792083523229.jpg';

export const PROJECT_LOGOS: Record<string, string> = {
  nasheed: nasheedLogo,
  'love-chill': loveChillLogo,
  'jtec-music': jtecMusicLogo,
};

export function resolveProjectLogo(projectId: string, fallbackLogo?: string): string {
  if (PROJECT_LOGOS[projectId]) {
    return PROJECT_LOGOS[projectId];
  }
  if (fallbackLogo) {
    // If it's a relative path from public or an absolute URL, return as-is
    return fallbackLogo;
  }
  return '';
}
