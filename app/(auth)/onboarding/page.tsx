import OnboardingMobileHero from '@/components/content/onboarding-mobile-hero';
import { getPublicFieldContent } from '@/lib/field-content';

export default async function OnboardingPage() {
  const content = await getPublicFieldContent();

  return <OnboardingMobileHero banners={content.banners.filter(b => b.title === 'Onboarding')} />;
}
