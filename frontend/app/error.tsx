"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { PageContainer } from "@/components/layout/PageContainer";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <AppLayout>
      <PageContainer size="md">
        <ErrorMessage
          title="Something went wrong"
          message={error.message || "An unexpected error occurred."}
          onRetry={reset}
        />
      </PageContainer>
    </AppLayout>
  );
}
