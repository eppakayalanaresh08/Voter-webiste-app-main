import OnboardingMobileHero from '@/components/content/onboarding-mobile-hero';
import { getPublicFieldContent } from '@/lib/field-content';
import { splitBannersForDisplay } from '@/lib/field-content-shared';

export default async function OnboardingPage() {
  const content = await getPublicFieldContent();
  const display = splitBannersForDisplay(content.banners);

  return <OnboardingMobileHero banners={display.onboarding} />;
}
