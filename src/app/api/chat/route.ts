import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import dbConnect from '@/lib/mongoose';
import Product from '@/models/Product';

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || 'fake-key',
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

// Mock inicial si no hay base de datos conectada correctamente para testing
const MOCK_DB = false;

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { message, model } = await req.json();

    // Fetch existing inventory state to give as context to the AI
    const products = await Product.find({});
    const inventoryContext = products.map(p => `${p.name}: ${p.quantity}`).join(', ');

    const systemPrompt = `
      Eres el Asistente de Inventario para "Stock Atelier". 
      Tu objetivo es leer las instrucciones del usuario (sumar, restar, crear o consultar) y responder sobre el stock.
      El inventario actual es: ${inventoryContext.length > 0 ? inventoryContext : 'vacío'}.
      
      Si el usuario pide realizar una modificación (añadir/quitar stock, crear producto), hazlo devolviendo formato JSON al final de tu mensaje en un bloque de código como este:
      \`\`\`json
      { "action": "update", "product": "nombre", "change": cantidad_positiva_o_negativa }
      \`\`\`
      o para crear:
      \`\`\`json
      { "action": "create", "product": "nombre", "quantity": cantidad }
      \`\`\`
      Si es sólo consulta, responde amistosamente sin el JSON.
    `;

    const modelName = model || 'google/gemma-4-31b-it'; 

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

    // Procesar JSON si existe en la respuesta para actualizar la BD real
    const jsonMatch = aiMessage.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const actionData = JSON.parse(jsonMatch[1]);
        if (actionData.action === 'create' || actionData.action === 'update') {
          const product = await Product.findOne({ name: { $regex: new RegExp('^' + actionData.product + '$', 'i') } });
          if (product && actionData.action === 'update') {
            product.quantity += actionData.change;
            if (product.quantity < 0) product.quantity = 0;
            await product.save();
          } else if (!product && actionData.action === 'create') {
            await Product.create({ name: actionData.product, quantity: actionData.quantity || 0 });
          } else if (!product && actionData.action === 'update') {
            // crear igual
            await Product.create({ name: actionData.product, quantity: Math.max(0, actionData.change) });
          }
          updated = true;
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
