import { Skeleton } from "@/shared/components/ui/skeleton";

/** Shared farmer-route skeleton while RSC / client screens hydrate (C8). */
export default function FarmerLoading() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-3 px-4 pt-4 md:max-w-[1200px] md:px-8">
      <Skeleton className="h-10 w-2/3 rounded-xl" />
      <Skeleton className="h-8 w-full rounded-full" />
      <Skeleton className="h-36 w-full rounded-[22px]" />
      <Skeleton className="h-24 w-full rounded-[18px]" />
      <Skeleton className="h-24 w-full rounded-[18px]" />
    </div>
  );
}
