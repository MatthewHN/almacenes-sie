"use client";

import { useState, useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface Product {
  _id: string;
  name: string;
  quantity: number;
}

interface Supplier {
  _id: string;
  name: string;
}

interface Order {
  _id: string;
  supplierName: string;
  productName: string;
  quantity: number;
  date: string;
}

interface Waste {
  _id: string;
  productName: string;
  quantity: number;
  reason: string;
  date: string;
}

interface StatsData {
  products: Product[];
  suppliers: Supplier[];
  orders: Order[];
  wastes: Waste[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  
  // Selector real de modelos TOP tier (propios de cada vendor)
  const models = [
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini (OpenAI)' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5 (Anthropic)' },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (Google)' }
  ];
  const [model, setModel] = useState(models[0].id);

  const [stats, setStats] = useState<StatsData>({ products: [], suppliers: [], orders: [], wastes: [] });
  const [loading, setLoading] = useState(false);
  const [showChartsModal, setShowChartsModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const sendMessage = async (presetInput?: string) => {
    const textToSend = presetInput || input;
    if (!textToSend.trim()) return;

    const userMessage = { role: "user" as const, text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend, model }),
      });

      const data = await res.json();
      
      let replyText = data.reply || data.error || "Error de conexión";
      
      // Ocultar el bloque JSON a la vista del usuario
      const jsonMatch = replyText.match(/\`\`\`json\n([\s\S]*?)\n\`\`\`/);
      if (jsonMatch) {
        replyText = replyText.replace(/\`\`\`json\n([\s\S]*?)\n\`\`\`/, "").trim();
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: replyText },
      ]);

      if (data.updated) {
        fetchStats();
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Error de red" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const totalProducts = stats.products.length;
  const totalUnits = stats.products.reduce((acc, p) => acc + p.quantity, 0);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: '#94a3b8' } },
    },
    scales: {
      x: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } },
      y: { ticks: { color: '#cbd5e1' }, grid: { color: '#334155' } }
    }
  };

  const barData = {
    labels: stats.products.map(p => p.name),
    datasets: [
      {
        label: 'Stock Actual',
        data: stats.products.map(p => p.quantity),
        backgroundColor: 'rgba(99, 102, 241, 0.8)', // indigo-500
      },
    ],
  };

  // Pie chart with dark mode label colors
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: '#94a3b8' } },
    }
  };

  const pieData = {
    labels: [...new Set(stats.wastes.map(w => w.reason))],
    datasets: [
      {
        label: 'Motivos de Desecho',
        data: [...new Set(stats.wastes.map(w => w.reason))].map(reason => 
          stats.wastes.filter(w => w.reason === reason).reduce((acc, curr) => acc + curr.quantity, 0)
        ),
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)', // red-500
          'rgba(249, 115, 22, 0.8)', // orange-500
          'rgba(234, 179, 8, 0.8)', // yellow-500
        ],
        borderColor: '#1e293b', // slate-800
        borderWidth: 2,
      },
    ],
  };

  const suppliersPieData = {
    labels: [...new Set(stats.orders.map(o => o.supplierName))],
    datasets: [
      {
        label: 'Pedidos por Proveedor',
        data: [...new Set(stats.orders.map(o => o.supplierName))].map(supplierName => 
          stats.orders.filter(o => o.supplierName === supplierName).reduce((acc, curr) => acc + curr.quantity, 0)
        ),
        backgroundColor: [
          'rgba(56, 189, 248, 0.8)', // sky-400
          'rgba(167, 139, 250, 0.8)', // purple-400
          'rgba(251, 113, 133, 0.8)', // rose-400
          'rgba(52, 211, 153, 0.8)', // emerald-400
        ],
        borderColor: '#1e293b', // slate-800
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[100dvh] md:h-screen p-2 md:p-8 gap-4 md:gap-6 max-w-[1400px] mx-auto font-sans bg-slate-900 md:overflow-hidden">
      {/* Zona Izquierda - Chat */}
      <div className="w-full md:flex-1 flex flex-col h-[90dvh] md:h-auto bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden p-4 md:p-6 mb-4 md:mb-0">
        <div className="mb-4 md:mb-6 shrink-0">
          <h2 className="text-xs font-semibold text-slate-400 tracking-wider">ASISTENTE DE INVENTARIO</h2>
          <h1 className="text-3xl font-bold text-white mt-1">Stock Atelier</h1>
          <p className="text-slate-400 mt-2 text-sm">Todo se gestiona por chat: pedidos, mermas, consultas y proveedores.</p>
          
          <div className="flex gap-2 mt-4">
            <select 
              value={model} 
              onChange={e => setModel(e.target.value)}
              className="bg-slate-700 text-xs text-white px-3 py-1.5 rounded-full border border-slate-600 outline-none hover:border-indigo-500 transition-colors"
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
           {messages.length === 0 && (
             <div className="text-slate-500 text-center mt-10 text-sm">Empieza pidiendo un material a un proveedor...</div>
           )}
           {messages.map((m, i) => (
             <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
               <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                 {m.text}
               </div>
             </div>
           ))}
           {loading && (
             <div className="flex justify-start">
               <div className="px-4 py-2 rounded-2xl bg-slate-700 text-slate-400 animate-pulse">
                 Pensando...
               </div>
             </div>
           )}
           <div ref={messagesEndRef} />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2 mb-2">
             {[
                'Pedido 10 de ratones a Logitech', 
                'Tira 2 monitores por rotura',
                'Nos han llegado 5 teclados de Corsair',
                '¿Cuántos ratones nos quedan en stock?'
              ].map(action => (
                <button 
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="bg-slate-700 hover:bg-slate-600 text-[11px] px-3 py-1.5 rounded-full text-slate-300 transition-colors"
                  disabled={loading}
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
              disabled={loading}
            />
            <button 
              onClick={() => sendMessage()}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-full px-6 py-2 font-medium transition-colors"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* Zona Derecha - Dashboard Simplificado */}
      <div className="w-full md:w-[350px] flex flex-col gap-4">
        {/* Resumen */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl shrink-0">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wider mb-4">RESUMEN GLOBAL</h3>
          <div className="flex gap-4">
            <div className="flex-1 bg-slate-700 rounded-xl p-4 border border-slate-600">
              <div className="text-xs text-slate-400">PRODUCTOS</div>
              <div className="text-3xl font-bold mt-1 text-white">{totalProducts}</div>
            </div>
            <div className="flex-1 bg-slate-700 rounded-xl p-4 border border-slate-600">
              <div className="text-xs text-slate-400">UNIDADES</div>
              <div className="text-3xl font-bold mt-1 text-white">{totalUnits}</div>
            </div>
          </div>
        </div>

        {/* Botón para abrir Gráficos */}
        <button 
          onClick={() => setShowChartsModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl p-3 text-sm font-semibold shadow-xl border border-indigo-500 transition-colors shrink-0"
        >
          📊 Ver Gráficos Extendidos
        </button>

        {/* GUÍA RÁPIDA */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 shadow-xl shrink-0">
          <h3 className="text-[11px] font-bold text-slate-400 tracking-widest mb-2 uppercase">Guía Rápida</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Ejemplos: "suma 6 ratones", "resta 3 monitores", "¿cuántos teclados hay?" o "crea 12 webcams".
          </p>
        </div>

        {/* Últimos Pedidos */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 shadow-xl flex-1 flex flex-col min-h-0">
           <h3 className="text-[11px] font-bold text-slate-400 tracking-widest mb-3 shrink-0 uppercase">Últimas Entradas</h3>
           <div className="overflow-y-auto pr-2 flex-1">
             <ul className="text-[11px] space-y-2">
              {stats.orders.slice(-5).reverse().map(o => (
                <li key={o._id} className="text-slate-300 border-b border-slate-700/50 pb-2 flex justify-between">
                  <span><span className="font-bold text-indigo-400">+{o.quantity}</span> {o.productName}</span>
                  <span className="text-slate-500">{o.supplierName}</span>
                </li>
              ))}
              {stats.orders.length === 0 && <li className="text-slate-500">Ningún pedido al proveedor</li>}
             </ul>
           </div>
           
           <h3 className="text-[11px] font-bold text-slate-400 tracking-widest mt-4 mb-2 shrink-0 uppercase border-t border-slate-700 pt-4">Proveedores Activos</h3>
           <div className="overflow-y-auto pr-2 flex-1">
             <div className="flex flex-wrap gap-2 text-[10px]">
               {stats.suppliers.map(s => (
                 <span key={s._id} className="bg-slate-700 px-2 py-1 rounded text-slate-300 border border-slate-600">
                   {s.name}
                 </span>
               ))}
               {stats.suppliers.length === 0 && <p className="text-slate-500">Aún no hay proveedores</p>}
             </div>
           </div>
        </div>
      </div>

      {/* MODAL / POPUP PARA GRÁFICOS */}
      {showChartsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-800 rounded-2xl border border-slate-600 shadow-2xl w-full max-w-4xl p-6 relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setShowChartsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-full w-8 h-8 flex items-center justify-center font-bold"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold text-white mb-6">Gráficos y Estadísticas de Inventario</h2>
            
            <div className="flex flex-col md:flex-row gap-6 overflow-y-auto pb-4">
              {/* Nuevo Gráfico Horizontal (Inventario Live) */}
              <div className="flex-1 bg-slate-700 rounded-2xl border border-slate-600 p-4 shadow-inner flex flex-col">
                <h3 className="text-sm font-semibold text-slate-300 tracking-wider mb-4">NIVELES DE STOCK ACTUAL</h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {stats.products.map(p => {
                     const maxQuantity = Math.max(...stats.products.map(x => x.quantity), 1);
                     const percentage = Math.min((p.quantity / maxQuantity) * 100, 100);
                     return (
                       <div key={p._id}>
                         <div className="flex justify-between text-xs font-bold text-white mb-1">
                           <span>{p.name}</span>
                           <span>{p.quantity}</span>
                         </div>
                         <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                           <div className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-2 rounded-full transition-all duration-500" style={{ width: `${percentage}%` }}></div>
                         </div>
                       </div>
                     );
                  })}
                  {stats.products.length === 0 && <p className="text-sm text-slate-500 text-center mt-10">Sin stock</p>}
                </div>
              </div>

              {/* Contenedor Pie Charts */}
              <div className="flex-1 flex flex-col gap-6">
                {/* Gráfico Tarta Mermas */}
                <div className="flex-1 bg-slate-700 rounded-2xl border border-slate-600 p-4 shadow-inner">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-300 tracking-wider">MOTIVOS DE MERMA</h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">Las mermas son reducciones de stock por problemas como caducidad o pérdidas.</p>
                  </div>
                  <div className="h-48 flex items-center justify-center">
                    {stats.wastes.length > 0 ? (
                        <Pie data={pieData} options={pieChartOptions} />
                    ) : (
                        <p className="text-sm text-slate-500">Sin registros de mermas</p>
                    )}
                  </div>
                </div>

                {/* Gráfico Tarta Proveedores */}
                <div className="flex-1 bg-slate-700 rounded-2xl border border-slate-600 p-4 shadow-inner">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-300 tracking-wider">PEDIDOS POR PROVEEDOR</h3>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">Distribución de cantidad de pedidos realizados a cada proveedor.</p>
                  </div>
                  <div className="h-48 flex items-center justify-center">
                    {stats.orders.length > 0 ? (
                        <Pie data={suppliersPieData} options={pieChartOptions} />
                    ) : (
                        <p className="text-sm text-slate-500">Sin registros de pedidos</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Listado de Caducados */}
            <div className="mt-6 bg-slate-700 rounded-2xl border border-slate-600 p-4 shadow-inner">
                <div className="mb-4 border-b border-slate-600 pb-2">
                  <h3 className="text-sm font-semibold text-slate-300 tracking-wider text-rose-400">🚨 PRODUCTOS CADUCADOS O MERMADOS</h3>
                  <p className="text-[10px] text-slate-400 mt-1 leading-tight">Historial de productos notificados como desechos.</p>
                </div>
                <div className="max-h-32 overflow-y-auto pr-2">
                  <ul className="text-sm space-y-2">
                    {stats.wastes.reverse().map(w => (
                      <li key={w._id} className="text-slate-300 flex justify-between border-b border-slate-600/50 pb-2 last:border-0">
                        <span><span className="font-bold text-rose-400">-{w.quantity}</span> {w.productName}</span>
                        <span className="text-slate-500 text-xs">{w.reason} - {new Date(w.date).toLocaleDateString()}</span>
                      </li>
                    ))}
                    {stats.wastes.length === 0 && <li className="text-slate-500 text-sm">No hay productos mermados.</li>}
                  </ul>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
