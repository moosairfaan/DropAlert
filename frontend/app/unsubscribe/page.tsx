import Link from "next/link";
import { redirect } from "next/navigation";

import {
  ensureSubscriberSchema,
  unsubscribeByToken,
} from "@/lib/subscribers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ token?: string; status?: string }>;
};

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const token = (params.token || "").trim();
  const status = (params.status || "").trim();

  if (token && !status) {
    await ensureSubscriberSchema();
    const ok = await unsubscribeByToken(token);
    redirect(ok ? "/unsubscribe?status=confirmed" : "/unsubscribe?status=invalid");
  }

  const confirmed = status === "confirmed";
  const invalid = status === "invalid";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fff8f0] px-4 py-16 text-black">
      <div className="max-w-md border-4 border-black bg-white p-8 text-center shadow-pop-lg">
        {confirmed ? (
          <>
            <p className="font-sans text-xs font-extrabold uppercase tracking-[0.2em] text-[#ff2d6f]">
              DropAlert
            </p>
            <h1 className="mt-3 font-serif text-3xl font-bold italic">
              You&apos;ve been unsubscribed
            </h1>
            <p className="mt-4 font-sans text-sm font-medium leading-relaxed text-neutral-700">
              You won&apos;t receive any more drop alert emails from DropAlert.
              Changed your mind? You can always sign up again on the homepage.
            </p>
          </>
        ) : invalid ? (
          <>
            <h1 className="font-serif text-2xl font-bold italic">
              Link not valid
            </h1>
            <p className="mt-4 font-sans text-sm font-medium text-neutral-700">
              This unsubscribe link is invalid or already used. If you still get
              emails, contact support or try subscribing again to refresh your
              preferences.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-2xl font-bold italic">Unsubscribe</h1>
            <p className="mt-4 font-sans text-sm font-medium text-neutral-700">
              Use the unsubscribe link in your DropAlert email to manage your
              subscription.
            </p>
          </>
        )}

        <Link
          href="/"
          className="mt-8 inline-block border-4 border-black bg-[#2d5bff] px-6 py-3 font-extrabold uppercase tracking-wide text-white shadow-pop-sm transition hover:bg-[#2449d4]"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
