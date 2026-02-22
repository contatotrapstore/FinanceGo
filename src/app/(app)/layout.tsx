import { AppLayout } from "@/components/layout/app-layout";

export const dynamic = "force-dynamic";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}