// Exact Santa Radio website palette (src/index.css)
export const brand = {
  navy: '#1B4332', navyDark: '#081e17', navyMid: '#123326',
  gold: '#D4AF37', goldLight: '#e6ce86', goldDark: '#b89537',
  red: '#9B111E', redBright: '#b62332', redDark: '#7c101a',
  cream: '#FFF8E7', offWhite: '#f3eddc', muted: '#bcc9bd',
  glass: '#152c2180', goldLine: '#D4AF3766', goldHair: '#D4AF3733',
};

export const fonts = {
  display: 'Cinzel_400Regular', displayMedium: 'Cinzel_500Medium',
  body: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold',
};

const colors = {
  light: {
    text: brand.cream, tint: brand.gold,
    background: brand.navyDark, foreground: brand.cream,
    card: brand.navyMid, cardForeground: brand.cream,
    primary: brand.red, primaryForeground: brand.cream,
    secondary: brand.navy, secondaryForeground: brand.cream,
    muted: brand.navyMid, mutedForeground: brand.muted,
    accent: brand.gold, accentForeground: brand.navyDark,
    destructive: brand.redBright, destructiveForeground: brand.cream,
    border: brand.goldLine, input: brand.goldLine,
  },
  radius: 18,
};

export default colors;
