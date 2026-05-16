import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Product from '@/models/Product';
import Supplier from '@/models/Supplier';
import Order from '@/models/Order';
import Waste from '@/models/Waste';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbConnect();
    const [products, suppliers, orders, wastes] = await Promise.all([
      Product.find({}),
      Supplier.find({}),
      Order.find({}),
      Waste.find({})
    ]);

    return NextResponse.json({
      products,
      suppliers,
      orders,
      wastes
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}