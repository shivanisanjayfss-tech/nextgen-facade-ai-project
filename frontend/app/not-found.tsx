import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/layout/PageContainer";

export default function NotFound() {
  return (
    <AppLayout>
      <PageContainer size="md">
        <div className="flex flex-col items-center py-24 text-center">
          <p className="text-6xl font-bold text-white/10">404</p>
          <h1 className="mt-4 text-2xl font-semibold text-white">Page not found</h1>
          <p className="mt-2 text-sm text-white/40">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link href="/" className="mt-8">
            <Button variant="primary">Back to Home</Button>
          </Link>
        </div>
      </PageContainer>
    </AppLayout>
  );
}
