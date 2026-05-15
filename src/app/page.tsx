'use client';

import { useState, useEffect } from 'react';

type Product = { _id: string; name: string; quantity: number };

export default function Home() {
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [input, setInput] = useState('');
  const [inventory, setInventory] = useState<Product[]>([]);
  const [model, setModel] = useState('google/gemma-2-9b-it'); // Gemma 4 as per api request proxy

  const models = [
    { id: 'google/gemma-4-31b-it', name: 'Gemma 4 (NVIDIA)' }, 
    { id: 'deepseek-ai/deepseek-v4-pro', name: 'DeepSeek v4 Pro (NVIDIA)' },
    { id: 'moonshotai/kimi-k2.6', name: 'Kimi k2.6 (NVIDIA)' }
  ];

  const fetchInventory = async () => {
    const res = await fetch('/api/chat');
    if (res.ok) {
        const data = await res.json();
        setInventory(data);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const sendMessage = async (presetInput?: string) => {
    const textToSend = presetInput || input;
    if (!textToSend.trim()) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: textToSend, model: model }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: `❌ Error del servidor: ${data.error || 'Algo ha fallado'}. Comprueba tus variables de entorno en Vercel.` 
      }]);
      return;
    }

    setMessages(prev => [...prev, { 
      role: 'assistant', 
      text: data.reply ? data.reply.replace(/```json[\s\S]*?```/, '') : 'Sin respuesta.'
    }]);

    if (data.updated) {
      fetchInventory();
    }
  };

  const totalProducts = inventory.length;
  const totalUnits = inventory.reduce((acc, p) => acc + p.quantity, 0);

  return (
    <div className="flex h-screen p-4 md:p-8 gap-6 max-w-7xl mx-auto font-sans">
      {/* Zona Izquierda - Chat */}
      <div className="flex-1 flex flex-col bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden p-6">
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-slate-400 tracking-wider">ASISTENTE DE INVENTARIO</h2>
          <h1 className="text-3xl font-bold text-white mt-1">Stock Atelier</h1>
          <p className="text-slate-400 mt-2 text-sm">Todo se gestiona por chat: altas, bajas, consultas y creación de productos.</p>
          
          <div className="flex gap-2 mt-4">
            <select 
              value={model} 
              onChange={e => setModel(e.target.value)}
              className="bg-slate-700 text-xs text-white px-3 py-1.5 rounded-full border border-slate-600 outline-none"
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
           {messages.length === 0 && (
             <div className="text-slate-500 text-center mt-10 text-sm">Escribe un mensaje para empezar.</div>
           )}
           {messages.map((m, i) => (
             <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${m.role === 'user' ? 'bg-indigo-600' : 'bg-slate-700 text-slate-200'}`}>
                 {m.text}
               </div>
             </div>
           ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col gap-2">
          <div className="flex gap-2 mb-2">
             {['+4 ordenadores', 'stock ratones'].map(action => (
                <button 
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-full text-slate-300 transition-colors"
                >
                  {action}
                </button>
             ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Escribe tu orden o pregunta..."
              className="flex-1 bg-slate-700 text-white rounded-full px-4 py-2 border border-slate-600 focus:border-indigo-500 outline-none"
            />
            <button 
              onClick={() => sendMessage()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-6 py-2 font-medium transition-colors"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Zona Derecha - Dashboard */}
      <div className="w-[350px] flex flex-col gap-6">
        {/* Resumen */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wider mb-4">RESUMEN</h3>
          <div className="flex gap-4">
            <div className="flex-1 bg-slate-700 rounded-xl p-4 border border-slate-600">
              <div className="text-xs text-slate-400">PRODUCTOS</div>
              <div className="text-3xl font-bold mt-1">{totalProducts}</div>
            </div>
            <div className="flex-1 bg-slate-700 rounded-xl p-4 border border-slate-600">
              <div className="text-xs text-slate-400">UNIDADES</div>
              <div className="text-3xl font-bold mt-1">{totalUnits}</div>
            </div>
          </div>
        </div>

        {/* Live Inventory */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wider mb-4">INVENTARIO LIVE</h3>
          <div className="space-y-4">
            {inventory.length === 0 && <p className="text-sm text-slate-500">No hay productos en stock.</p>}
            {inventory.map(item => {
              const max = 100; // max arbitrary representation
              const percent = Math.min((item.quantity / max) * 100, 100);
              return (
                <div key={item._id} className="relative">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-slate-300">{item.quantity}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Guia */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wider mb-2">GUÍA RÁPIDA</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Ejemplos: <br/> "suma 8 ratones"<br/> "resta 3 monitores"<br/> "¿cuántos teclados hay?"<br/> "crea 12 webcams"
          </p>
        </div>
      </div>
    </div>
  );
}
