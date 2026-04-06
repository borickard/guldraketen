"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function KalkylatorRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const v = searchParams.get("v");
    const h = searchParams.get("h");
    const url = searchParams.get("url");

    const params = new URLSearchParams();
    if (v) params.set("v", v);
    if (h) params.set("h", h);
    if (url) params.set("url", url);

    const qs = params.toString();
    window.location.replace(`/${qs ? `?${qs}` : ""}#kalkylator`);
  }, [searchParams]);

  return null;
}

export default function Page() {
  return (
    <Suspense>
      <KalkylatorRedirect />
    </Suspense>
  );
}
