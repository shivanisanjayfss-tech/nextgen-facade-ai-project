import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/Skeleton";

export default function MaterialLoading() {
  return (
    <AppLayout>
      <PageContainer size="md">
        <Skeleton className="mb-4 h-6 w-24 rounded-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-2 h-6 w-1/3" />
        <Skeleton className="mt-6 h-24 w-full" />
        <Skeleton className="mt-8 h-64 w-full rounded-2xl" />
      </PageContainer>
    </AppLayout>
  );
}
