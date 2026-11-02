import { Header } from "@/components/Header";
import { NavTabs } from "@/components/NavTabs";
import { CakeOrderFlow } from "@/components/CakeOrderFlow";
import { getBranches } from "@/lib/data";
import { getCakeCapacityWindow } from "@/lib/cake";

export const dynamic = "force-dynamic";

export default async function CakePage() {
  const [branches, window] = await Promise.all([getBranches(), getCakeCapacityWindow()]);

  return (
    <div className="mx-auto w-full max-w-[460px] px-4 flex-1 pb-10">
      <Header />
      <NavTabs />
      <CakeOrderFlow branches={branches} window={window} shopWhatsapp={process.env.SHOP_WHATSAPP ?? "77051234567"} />
    </div>
  );
}
