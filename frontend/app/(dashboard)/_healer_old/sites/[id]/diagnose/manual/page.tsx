import { ManualDiagnosisPage } from '@/components/healer/ManualDiagnosisPage';

export default async function SiteManualDiagnosisPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  return <ManualDiagnosisPage siteId={id} />;
}
