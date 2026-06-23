import { useEffect } from 'react';
import { useAppSelector } from '@/store/hooks';
import { selectBranding, selectFeatures } from '@/features/auth/authSlice';

/**
 * Apply the tenant's white-label accent colour (Platinum) by overriding the
 * `--primary`/`--ring` CSS variables on the document root. Removing them falls
 * back to the default theme. Only the accent is themed; foreground stays light.
 */
export function useBrandingTheme() {
  const branding = useAppSelector(selectBranding);
  const features = useAppSelector(selectFeatures);
  const color = features.whiteLabeling ? branding?.primaryColor : undefined;

  useEffect(() => {
    const root = document.documentElement;
    if (color) {
      root.style.setProperty('--primary', color);
      root.style.setProperty('--ring', color);
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
    }
    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
    };
  }, [color]);
}
