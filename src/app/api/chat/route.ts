import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Product from '@/models/Product';
import Supplier from '@/models/Supplier';
import Order from '@/models/Order';
import Waste from '@/models/Waste';

export const maxDuration = 60; // Extiende el límite de tiempo de Vercel a 60 segundos para evitar Timeouts con NVIDIA

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { message, model } = await req.json();

    const products = await Product.find({});
    const inventoryContext = products.map(p => `${p.name}: ${p.quantity}`).join(', ');

    const systemPrompt = `
      Eres el Asistente de Inventario para "Stock Atelier". Eres un robot eficiente, directo y nada hablador.
      Inventario actual: ${inventoryContext.length > 0 ? inventoryContext : 'vacío'}.

      REGLAS DE NEGOCIO MUY IMPORTANTES:
      - Hacer un "Pedido a proveedor" o "Llega mercancía" significa COMPRAR, por lo tanto tienes que SUMAR stock. Jamás bloquees un pedido diciendo que "no hay stock", ¡justamente estamos pidiendo para que haya!
      - "Tirar", "merma" o "rotura" significa RESTAR stock. Solo cancela si se intenta tirar más unidades de las que hay disponibles.
      - Para consultas de stock, di el número exacto y termina. No generes JSON.

      FORMATO DE RESPUESTA ESTRICTO:
      No hagas preguntas al usuario. Ejecuta la orden. 
      Responde SOLO con una frase ultra corta de confirmación ("Pedido realizado", "Stock actualizado", etc.), y debajo, OBLIGATORIAMENTE el siguiente bloque JSON según corresponda. Si te falta algún dato (como la marca), invéntalo o pon "Genérico".

      ACCIONES JSON (Elige 1):

      - Pedido a proveedor:
      \`\`\`json
      { "action": "order", "product": "nombre", "supplier": "marca o Genérico", "quantity": numero_entero }
      \`\`\`

      - Añadir/Restar stock sin proveedor:
      \`\`\`json
      { "action": "update", "product": "nombre", "change": cantidad_positiva_o_negativa }
      \`\`\`

      - Tirar/Merma (restar stock):
      \`\`\`json
      { "action": "waste", "product": "nombre", "quantity": numero_entero, "reason": "motivo" }
      \`\`\`
    `;

    const modelName = model; 
    let aiMessage = 'Sin respuesta';

    // 1. OPENAI (GPT)
    if (modelName === 'gpt-4o-mini') {
      const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        })
      });
      if (!gptRes.ok) throw new Error(`OpenAI HTTP ${gptRes.status}: ${await gptRes.text()}`);
      const gptJson = await gptRes.json();
      aiMessage = gptJson.choices?.[0]?.message?.content || 'Sin respuesta';
    } 
    
    // 2. ANTHROPIC (CLAUDE)
    else if (modelName === 'claude-3-haiku-20240307') {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }]
        })
      });
      if (!claudeRes.ok) throw new Error(`Anthropic HTTP ${claudeRes.status}: ${await claudeRes.text()}`);
      const claudeJson = await claudeRes.json();
      aiMessage = claudeJson.content?.[0]?.text || 'Sin respuesta';
    }
    
    // 3. GOOGLE (GEMINI)
    else if (modelName === 'gemini-1.5-flash') {
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: message }] }]
        })
      });
      if (!geminiRes.ok) throw new Error(`Gemini HTTP ${geminiRes.status}: ${await geminiRes.text()}`);
      const geminiJson = await geminiRes.json();
      aiMessage = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
    } else {
      throw new Error(`Modelo no soportado o desconocido: ${modelName}`);
    }

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
