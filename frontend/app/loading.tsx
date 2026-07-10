import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1120]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
