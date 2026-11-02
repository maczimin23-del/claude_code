import { hasValidAdminSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await hasValidAdminSession()) redirect("/admin/dashboard");

  return (
    <div className="max-w-[340px] mx-auto mt-16 text-center grid gap-3.5 px-4">
      <h1 className="font-display text-xl">Бэк-офис Jam Bakery</h1>
      <p className="text-fg-muted text-[13px]">
        Не связан ссылками с клиентской страницей — открыт только тому, кто знает этот адрес и код.
      </p>
      <AdminLoginForm />
    </div>
  );
}
