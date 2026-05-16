import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Product from '@/models/Product';
import Supplier from '@/models/Supplier';
import Order from '@/models/Order';
import Waste from '@/models/Waste';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { message, model } = await req.json();

    const products = await Product.find({});
    const inventoryContext = products.map(p => `${p.name}: ${p.quantity}`).join(', ');

    const systemPrompt = `
      Eres el Asistente de Inventario para "Stock Atelier". 
      Tu objetivo es leer las instrucciones del usuario y convertirlas a acciones estructuradas.
      El inventario actual es: ${inventoryContext.length > 0 ? inventoryContext : 'vacío'}.
      Nunca permitas restar inventario si un producto no existe o bajará de 0.

      Dispones de las siguientes acciones permitidas (genera un bloque JSON al final):

      1. Crear producto (o añadir/restar inventario genérico):
      \`\`\`json
      { "action": "update", "product": "nombre", "change": cantidad_positiva_o_negativa }
      \`\`\`
      
      2. Crear Proveedor (cuando te mencionen un distribuidor, marca o proveedor):
      \`\`\`json
      { "action": "create_supplier", "name": "nombre" }
      \`\`\`

      3. Pedido a proveedor (sumará stock automáticamente e insertará registro):
      \`\`\`json
      { "action": "order", "product": "nombre", "supplier": "nombre", "quantity": cantidad }
      \`\`\`

      4. Registrar desecho (restará stock por caducidad/rotura):
      \`\`\`json
      { "action": "waste", "product": "nombre", "quantity": cantidad, "reason": "caducidad o rotura" }
      \`\`\`
      
      Si la operación es un error lógico (ej: restar algo que no existe), responde amablemente que es imposible y NO emitas el JSON.
    `;

    // Mantenemos las opciones del profesor en el frontend,
    // pero si llegan los IDs que dan 404 en NVIDIA, los redirigimos a modelos funcionales.
    let modelName = model || 'meta/llama-3.1-8b-instruct'; 

    if (modelName === 'google/gemma-2-9b-it') {
      modelName = 'meta/llama-3.1-8b-instruct'; 
    } else if (modelName === 'meta/llama3-70b-instruct') {
      modelName = 'meta/llama-3.1-8b-instruct';
    }

    const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 500,
      })
    });

    if (!nvidiaResponse.ok) {
      const errText = await nvidiaResponse.text();
      throw new Error(`NVIDIA API HTTP ${nvidiaResponse.status}: ${errText}`);
    }

    const chatCompletion = await nvidiaResponse.json();
    const aiMessage = chatCompletion.choices?.[0]?.message?.content || 'Sin respuesta';
    let updated = false;

    const jsonMatch = aiMessage.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const actionData = JSON.parse(jsonMatch[1]);
        
        if (actionData.action === 'create_supplier') {
          await Supplier.findOneAndUpdate({ name: actionData.name }, { name: actionData.name }, { upsert: true });
          updated = true;
        } else if (actionData.action === 'order') {
          await Order.create({ supplierName: actionData.supplier, productName: actionData.product, quantity: actionData.quantity });
          const product = await Product.findOne({ name: { $regex: new RegExp('^' + actionData.product + '$', 'i') } });
          if (product) { product.quantity += actionData.quantity; await product.save(); } else { await Product.create({ name: actionData.product, quantity: actionData.quantity }); }
          await Supplier.findOneAndUpdate({ name: actionData.supplier }, { name: actionData.supplier }, { upsert: true });
          updated = true;
        } else if (actionData.action === 'waste') {
          const product = await Product.findOne({ name: { $regex: new RegExp('^' + actionData.product + '$', 'i') } });
          if (product && product.quantity >= actionData.quantity) {
            await Waste.create({ productName: actionData.product, quantity: actionData.quantity, reason: actionData.reason || 'Caducidad' });
            product.quantity -= actionData.quantity;
            await product.save();
            updated = true;
          }
        } else if (actionData.action === 'update' || actionData.action === 'create') {
          const product = await Product.findOne({ name: { $regex: new RegExp('^' + actionData.product + '$', 'i') } });
          if (product && actionData.change) {
            if (product.quantity + actionData.change >= 0) {
              product.quantity += actionData.change;
              await product.save();
              updated = true;
            }
          } else if (!product && (actionData.quantity > 0 || actionData.change > 0)) {
            await Product.create({ name: actionData.product, quantity: actionData.quantity || actionData.change });
            updated = true;
          }
        }
      } catch (e) {
        console.error("Error procesando action JSON", e);
      }
    }

    return NextResponse.json({ reply: aiMessage, updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
    try {
        await dbConnect();
        const products = await Product.find({});
        return NextResponse.json(products);
    } catch(err) {
        return NextResponse.json([], {status: 500});
    }
}
