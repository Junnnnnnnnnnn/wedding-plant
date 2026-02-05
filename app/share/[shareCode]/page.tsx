import { redirect } from "next/navigation";

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  const { shareCode } = await params;
  if (!shareCode?.trim()) {
    redirect("/main");
  }
  redirect(`/main?share=${encodeURIComponent(shareCode.trim())}`);
}
