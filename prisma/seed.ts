import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cakeOrder.deleteMany();
  await prisma.dailyStock.deleteMany();
  await prisma.capacityOverride.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.branch.deleteMany();

  const [bereke, kairbekova, gogolya] = await Promise.all([
    prisma.branch.create({
      data: { name: "Береке, 77", address: "ул. Береке, 77, Костанай", openTime: "09:00", closeTime: "22:00" },
    }),
    prisma.branch.create({
      data: { name: "Каирбекова, 385/2", address: "ул. Каирбекова, 385/2, Костанай", openTime: "09:00", closeTime: "22:00" },
    }),
    prisma.branch.create({
      data: { name: "Гоголя, 98", address: "ул. Гоголя, 98, Костанай", openTime: "09:00", closeTime: "22:00" },
    }),
  ]);
  void kairbekova;
  void gogolya;

  const menu = [
    { slug: "croissant", name: "Круассан классический", category: "Выпечка", priceCents: 120000, imagePath: "/images/menu/croissant.svg", defaultStock: 20, sortOrder: 1 },
    { slug: "cinnabon", name: "Синнабон", category: "Выпечка", priceCents: 160000, imagePath: "/images/menu/cinnabon.svg", defaultStock: 15, sortOrder: 2 },
    { slug: "pie", name: "Кусок пирога, ассорти", category: "Пироги", priceCents: 180000, imagePath: "/images/menu/pie.svg", defaultStock: 15, sortOrder: 3 },
    { slug: "cupcake", name: "Капкейк", category: "Кондитерские изделия", priceCents: 140000, imagePath: "/images/menu/cupcake.svg", defaultStock: 18, sortOrder: 4 },
    { slug: "cheesecake", name: "Чизкейк, кусок", category: "Кондитерские изделия", priceCents: 220000, imagePath: "/images/menu/cheesecake.svg", defaultStock: 10, sortOrder: 5 },
    { slug: "bowl-salmon", name: "Боул с лососем", category: "Боулы", priceCents: 320000, imagePath: "/images/menu/bowl-salmon.svg", defaultStock: 12, sortOrder: 6 },
    { slug: "bowl-berry", name: "Боул ягодный", category: "Боулы", priceCents: 260000, imagePath: "/images/menu/bowl-berry.svg", defaultStock: 12, sortOrder: 7 },
    { slug: "cappuccino", name: "Капучино 300 мл", category: "Напитки", priceCents: 140000, imagePath: "/images/menu/cappuccino.svg", trackStock: false, sortOrder: 8 },
    { slug: "latte", name: "Латте 300 мл", category: "Напитки", priceCents: 150000, imagePath: "/images/menu/latte.svg", trackStock: false, sortOrder: 9 },
  ];

  for (const item of menu) {
    await prisma.menuItem.create({
      data: {
        slug: item.slug,
        name: item.name,
        category: item.category,
        priceCents: item.priceCents,
        imagePath: item.imagePath,
        defaultStock: item.defaultStock ?? 0,
        trackStock: item.trackStock ?? true,
        sortOrder: item.sortOrder,
      },
    });
  }

  console.log("Seeded:", { branches: 3, menuItems: menu.length, mainBranch: bereke.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
