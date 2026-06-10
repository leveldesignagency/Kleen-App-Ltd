import type { LucideIcon } from "lucide-react";

type TrustItem = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

export default function HomeTrustBar({ items }: { items: TrustItem[] }) {
  return (
    <section className="bg-white py-10 lg:py-12">
      <div className="mx-auto grid max-w-screen-2xl grid-cols-2 gap-8 lg:grid-cols-4 lg:gap-6">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex gap-3 sm:block sm:text-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 sm:mx-auto">
                <Icon className="h-5 w-5 text-brand-600" />
              </div>
              <div className="min-w-0 sm:mt-3">
                <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
