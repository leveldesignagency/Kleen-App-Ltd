import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
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
    <div className="flex min-h-screen flex-col">
      <Navbar user={user ? { email: user.email ?? "" } : null} />
      <main className="flex-1 pt-[5.25rem]">{children}</main>
      <Footer user={user ? { email: user.email ?? "" } : null} />
    </div>
  );
}
