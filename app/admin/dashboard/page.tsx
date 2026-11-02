import { getMenuWithStock, getTodayOrders } from "@/lib/data";
import { getCakeCapacityWindow, getCakeOrdersForWindow } from "@/lib/cake";
import { StockEditor } from "@/components/admin/StockEditor";
import { OrdersQueue } from "@/components/admin/OrdersQueue";
import { CakeQueue } from "@/components/admin/CakeQueue";
import { adminLogout } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [menu, orders, cakeWindow, cakeOrdersMap] = await Promise.all([
    getMenuWithStock(),
    getTodayOrders(),
    getCakeCapacityWindow(),
    getCakeOrdersForWindow(),
  ]);
  const cakeOrdersByDate = Object.fromEntries(cakeOrdersMap);
  const shopWhatsapp = process.env.SHOP_WHATSAPP ?? "77051234567";

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-16">
      <header className="flex items-center justify-between gap-2.5 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[11px] bg-accent text-accent-ink flex items-center justify-center font-display font-bold text-[15px]">J</div>
          <div>
            <div className="font-display font-semibold text-[15px]">Бэк-офис</div>
            <div className="text-[10.5px] text-fg-muted">Выдача, доставка, остатки, торты</div>
          </div>
        </div>
        <form action={adminLogout}>
          <button type="submit" className="text-[11.5px] text-fg-muted underline underline-offset-2">
            Выйти
          </button>
        </form>
      </header>

      <section className="mt-5">
        <h2 className="font-display text-[15px] mb-2.5">Остатки на сегодня</h2>
        <StockEditor menu={menu} />
      </section>

      <section className="mt-5">
        <h2 className="font-display text-[15px] mb-2.5">Заказы — сегодня</h2>
        <OrdersQueue orders={orders} shopWhatsapp={shopWhatsapp} />
      </section>

      <section className="mt-5">
        <h2 className="font-display text-[15px] mb-2.5">Торты по дням</h2>
        <CakeQueue window={cakeWindow} ordersByDate={cakeOrdersByDate} />
      </section>
    </div>
  );
}
