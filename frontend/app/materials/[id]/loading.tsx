import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/Skeleton";

export default function MaterialLoading() {
  return (
    <AppLayout>
      <PageContainer size="lg">
        <Skeleton className="mb-8 h-4 w-72" />
        <div className="overflow-hidden rounded-3xl border border-white/[0.08]">
          <div className="grid lg:grid-cols-2">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-4 p-8">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-10 w-4/5" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-3">
                <Skeleton className="h-12 w-40 rounded-xl" />
                <Skeleton className="h-12 w-28 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
        <Skeleton className="mt-12 h-64 w-full rounded-2xl" />
        <Skeleton className="mt-8 h-48 w-full rounded-2xl" />
      </PageContainer>
    </AppLayout>
  );
}
