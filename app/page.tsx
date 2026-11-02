import { Header } from "@/components/Header";
import { NavTabs } from "@/components/NavTabs";
import { OrderFlow } from "@/components/OrderFlow";
import { getBranches, getMenuWithStock, getTodayPickupCounts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [branches, menu, pickupCounts] = await Promise.all([
    getBranches(),
    getMenuWithStock(),
    getTodayPickupCounts(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[460px] px-4 flex-1">
      <Header />
      <NavTabs />
      <OrderFlow
        branches={branches}
        menu={menu}
        pickupCounts={pickupCounts}
        shopWhatsapp={process.env.SHOP_WHATSAPP ?? "77051234567"}
      />
      <footer className="pt-2.5 pb-9 text-[10.5px] text-fg-muted border-t border-border mt-4">
        Остатки, лимиты и цены задаются в бэк-офисе владельцем.
      </footer>
    </div>
  );
}
