import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import MarketingSiteFrame from "@/components/marketing/MarketingSiteFrame";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <MarketingSiteFrame>
      <Navbar user={user ? { email: user.email ?? "" } : null} framed />
      <main className="flex-1 px-4 sm:px-5 lg:px-6">{children}</main>
      <Footer user={user ? { email: user.email ?? "" } : null} framed />
    </MarketingSiteFrame>
  );
}
