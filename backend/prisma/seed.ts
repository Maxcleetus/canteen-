import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rit.edu' },
    update: {},
    create: {
      email: 'admin@rit.edu',
      name: 'Canteen Admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create Student
  const studentPassword = await bcrypt.hash('student123', 10);
  const student = await prisma.user.upsert({
    where: { email: 'student@rit.edu' },
    update: {},
    create: {
      email: 'student@rit.edu',
      name: 'John Doe',
      password: studentPassword,
      role: 'STUDENT',
    },
  });

  // Create Categories & Items
  const mealsCat = await prisma.category.upsert({
    where: { name: 'Meals' },
    update: {},
    create: { name: 'Meals' }
  });

  const snacksCat = await prisma.category.upsert({
    where: { name: 'Snacks' },
    update: {},
    create: { name: 'Snacks' }
  });

  const bevCat = await prisma.category.upsert({
    where: { name: 'Beverages' },
    update: {},
    create: { name: 'Beverages' }
  });

  // Items
  const items = [
    { name: 'South Indian Meals', price: 60, image: 'https://images.unsplash.com/photo-1626779815774-8b090a19ea83?auto=format&fit=crop&q=80&w=400&h=300', stock: 50, categoryId: mealsCat.id },
    { name: 'Chicken Biryani', price: 120, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=400&h=300', stock: 20, status: 'LOW_STOCK', categoryId: mealsCat.id },
    { name: 'Masala Dosa', price: 40, image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b0?auto=format&fit=crop&q=80&w=400&h=300', stock: 100, categoryId: mealsCat.id },
    { name: 'Veg Samosa', price: 15, image: 'https://images.unsplash.com/photo-1601050690597-df0568a70950?auto=format&fit=crop&q=80&w=400&h=300', stock: 80, categoryId: snacksCat.id },
    { name: 'Tea', price: 10, image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=400&h=300', stock: 200, categoryId: bevCat.id },
  ];

  for (const item of items) {
    await prisma.menuItem.create({ data: item });
  }

  console.log('Seeding complete! Default Admin: admin@rit.edu (admin123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
