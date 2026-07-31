import { ClientWaterfall } from "../../components/ClientWaterfall";

export default async function ClientWaterfallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientWaterfall id={id} />;
}
