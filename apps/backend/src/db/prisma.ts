import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('✓ Database connected successfully');
  } catch (err) {
    console.error('Failed to connect to database:', err);
    throw err;
  }
}
