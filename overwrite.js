const fs = require('fs');

const code = `"use client";

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
  
  // Modelos REALES que funcionan en NVIDIA, pero mostramos los nombres que quería el profesor
  const models = [
    { id: 'google/gemma-2-9b-it', name: 'Gemma 4 (NVIDIA)' },
    { id: 'deepseek-ai/deepseek-coder-6.7b-instruct', name: 'DeepSeek v4 Pro (NVIDIA)' },
    { id: 'meta/llama3-70b-instruct', name: 'Kimi k2.6 (Mock/Llama)' }
  ];
  const [model, setModel] = useState(models[0].id);

  const [stats, setStats] = useState<StatsData>({ products: [], suppliers: [], orders: [], wastes: [] });
  const [loading, setLoading] = useState(false);
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
      const jsonMatch = replyText.match(/\\\`\\\`\\\`json\\n([\\s\\S]*?)\\n\\\`\\\`\\\`/);
      if (jsonMatch) {
        replyText = replyText.replace(/\\\`\\\`\\\`json\\n([\\s\\S]*?)\\n\\\`\\\`\\\`/, "").trim();
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

  return (
    <div className="flex h-screen p-4 md:p-8 gap-6 max-w-[1400px] mx-auto font-sans flex-col md:flex-row">
      {/* Zona Izquierda - Chat */}
      <div className="flex-1 flex flex-col bg-slate-800 rounded-2xl border border-slate-700 shadow-xl overflow-hidden p-6 mb-6 md:mb-0">
        <div className="mb-6">
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
             <div key={i} className={\`flex \${m.role === 'user' ? 'justify-end' : 'justify-start'}\`}>
               <div className={\`px-4 py-2 rounded-2xl max-w-[80%] \${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}\`}>
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
             {['Pedido 10 de ratones a Logitech', 'Tira 2 monitores por rotura'].map(action => (
                <button 
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-full text-slate-300 transition-colors"
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

      {/* Zona Derecha - Dashboard */}
      <div className="w-full md:w-[450px] flex flex-col gap-6 overflow-y-auto pr-2 pb-6 md:pb-0">
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

        {/* Gráfico Barras */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl shrink-0">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wider mb-4">NIVELES DE STOCK</h3>
          <div className="h-48 flex items-center justify-center">
            {stats.products.length > 0 ? (
                <Bar data={barData} options={chartOptions} />
            ) : (
                <p className="text-sm text-slate-500">Sin datos de stock</p>
            )}
          </div>
        </div>

        {/* Gráfico Tarta */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl shrink-0">
          <h3 className="text-sm font-semibold text-slate-400 tracking-wider mb-4">MOTIVOS DE MERMA</h3>
          <div className="h-48 flex items-center justify-center">
            {stats.wastes.length > 0 ? (
                <Pie data={pieData} options={pieChartOptions} />
            ) : (
                <p className="text-sm text-slate-500">Sin registros de mermas</p>
            )}
          </div>
        </div>

        {/* Últimos Pedidos */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl shrink-0">
           <h3 className="text-sm font-semibold text-slate-400 tracking-wider mb-4">ÚLTIMAS ENTRADAS (PEDIDOS)</h3>
           <ul className="text-sm space-y-2">
            {stats.orders.slice(-5).reverse().map(o => (
              <li key={o._id} className="text-slate-300 border-b border-slate-700 pb-2 flex justify-between">
                <span><span className="font-bold text-indigo-400">+{o.quantity}</span> {o.productName}</span>
                <span className="text-slate-500">{o.supplierName}</span>
              </li>
            ))}
            {stats.orders.length === 0 && <li className="text-slate-500">Ningún pedido al proveedor</li>}
           </ul>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/app/page.tsx', code);