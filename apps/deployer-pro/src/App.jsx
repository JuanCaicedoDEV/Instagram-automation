import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Database,
  Server,
  Code,
  CheckCircle2,
  Loader2,
  Rocket,
  Zap,
  Terminal,
  Layers,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = "http://localhost:8001";

function App() {
  const [loading, setLoading] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [formData, setFormData] = useState({
    supabase_url: '',
    supabase_key: '',
    database_url: '',
    railway_token: '',
    railway_service_id: '',
    vercel_token: '',
    vercel_project_id: '',
    gemini_api_key: '',
    upload_post_api_key: '',
    backend_url: ''
  });

  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/logs`);
          const data = await res.json();
          setLogs(data.logs);
          setProgress(data.progress);
          if (!data.is_running && data.progress === 100) {
            setLoading(false);
            setDeployed(true);
            clearInterval(interval);
          } else if (!data.is_running && data.progress === -1) {
            setLoading(false);
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Log fetch failed", e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStartDeploy = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLogs([]);
    setProgress(0);
    try {
      const res = await fetch(`${API_BASE}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error("Deploy start failed");
    } catch (err) {
      setLoading(false);
      alert("Error starting deployment: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/20">

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Rocket className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cloud Deployer Pro</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Gateway Active
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="relative w-48 h-48 mb-10">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200" />
                <circle cx="96" cy="96" r="88" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={552} strokeDashoffset={552 - (552 * Math.max(0, progress)) / 100} className="text-blue-600 transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold text-slate-800">{Math.max(0, progress)}%</span>
                <Loader2 size={24} className="mt-2 text-blue-600 animate-spin" />
              </div>
            </div>

            <div className="w-full max-w-3xl bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
                <Terminal size={16} className="text-slate-400" />
                <span className="text-sm font-mono text-slate-300">deployment_logs.sh</span>
              </div>
              <div className="p-5 h-64 overflow-y-auto font-mono text-sm space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-4 ${log.level === 'ERROR' ? 'text-red-400' : log.level === 'SUCCESS' ? 'text-green-400' : 'text-slate-300'}`}>
                    <span className="text-slate-500 shrink-0">[{new Date(log.timestamp * 1000).toLocaleTimeString()}]</span>
                    <span className="leading-relaxed">{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : deployed ? (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-100/50">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">¡Despliegue Exitoso!</h2>
            <p className="text-slate-600 text-lg mb-10 leading-relaxed">
              Toda la infraestructura cloud ha sido provisionada. Las variables de entorno han sido inyectadas en tu backend y frontend de forma segura.
            </p>
            <button onClick={() => setDeployed(false)} className="px-8 py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-all shadow-md active:scale-95">
              Volver al panel
            </button>
          </motion.div>
        ) : (
          <form onSubmit={handleStartDeploy} className="flex flex-col lg:flex-row gap-8 items-start">

            {/* Left Column: Form Sections */}
            <div className="w-full lg:w-2/3 space-y-6">

              <div className="mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Configuración de Despliegue</h2>
                <p className="text-slate-500 mt-2 text-lg">Proporciona las credenciales de tus proveedores cloud para orquestar la infraestructura.</p>
              </div>

              {/* Section 1: Database */}
              <SectionCard title="1. Base de Datos & Storage" icon={<Database className="text-blue-500" />} subtitle="Supabase">
                <div className="space-y-4">
                  <Input label="Project URL" name="supabase_url" value={formData.supabase_url} onChange={handleInputChange} placeholder="https://xxx.supabase.co" description="Settings > API > Project URL" required />
                  <Input label="Service Role Key" name="supabase_key" value={formData.supabase_key} onChange={handleInputChange} type="password" placeholder="eyJh..." description="Settings > API > Service Role Secret" required />
                  <Input label="Database URI" name="database_url" value={formData.database_url} onChange={handleInputChange} placeholder="postgres://..." description="Settings > Database > Connection URL (URI format)" required />
                </div>
              </SectionCard>

              {/* Section 2: External APIs */}
              <SectionCard title="2. APIs Externas" icon={<Code className="text-purple-500" />} subtitle="IA & Redes Sociales">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Gemini API Key" name="gemini_api_key" value={formData.gemini_api_key} onChange={handleInputChange} type="password" placeholder="AI Studio Key" description="aistudio.google.com/app/apikey" required />
                  <Input label="Upload-Post API Key" name="upload_post_api_key" value={formData.upload_post_api_key} onChange={handleInputChange} type="password" placeholder="Social Publisher Key" description="app.upload-post.com/welcome" required />
                </div>
              </SectionCard>

              {/* Section 3: Backend */}
              <SectionCard title="3. Backend Hosting" icon={<Server className="text-emerald-500" />} subtitle="Railway">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Railway API Token" name="railway_token" value={formData.railway_token} onChange={handleInputChange} type="password" placeholder="Personal Access Token" description="Account Settings > Tokens" required />
                  <Input label="Railway Service ID" name="railway_service_id" value={formData.railway_service_id} onChange={handleInputChange} placeholder="xxxxxxxx-xxxx-..." description="Project > Service Settings > Service ID" required />
                </div>
              </SectionCard>

              {/* Section 4: Frontend */}
              <SectionCard title="4. Frontend Hosting" icon={<Cloud className="text-sky-500" />} subtitle="Vercel">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <Input label="Vercel Token" name="vercel_token" value={formData.vercel_token} onChange={handleInputChange} type="password" placeholder="Personal Token" description="Account Settings > Tokens" required />
                  <Input label="Vercel Project ID" name="vercel_project_id" value={formData.vercel_project_id} onChange={handleInputChange} placeholder="prj_..." description="Project Settings > General > Project ID" required />
                </div>
                <Input label="Target Backend URL" name="backend_url" value={formData.backend_url} onChange={handleInputChange} placeholder="https://api.up.railway.app" description="La URL pública autogenerada por Railway." required />
              </SectionCard>

            </div>

            {/* Right Column: Sticky Summary & Action */}
            <div className="w-full lg:w-1/3 lg:sticky lg:top-24">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/40 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Layers size={20} className="text-blue-600" /> Resumen de Componentes
                </h3>

                <ul className="space-y-4 mb-8">
                  <SummaryItem checked={!!formData.supabase_url && !!formData.supabase_key && !!formData.database_url} label="Supabase Configurado" />
                  <SummaryItem checked={!!formData.gemini_api_key && !!formData.upload_post_api_key} label="APIs Externas Listas" />
                  <SummaryItem checked={!!formData.railway_token && !!formData.railway_service_id} label="Entorno Railway Localizado" />
                  <SummaryItem checked={!!formData.vercel_token && !!formData.vercel_project_id && !!formData.backend_url} label="Entorno Vercel Localizado" />
                </ul>

                <div className="bg-blue-50/50 rounded-xl p-4 mb-6 border border-blue-100 flex gap-3 text-blue-800 text-sm">
                  <ShieldAlert size={20} className="shrink-0 text-blue-500 mt-0.5" />
                  <p>Las credenciales viajan encriptadas de forma segura y no se almacenan en los servidores. Se envían directamente a los proveedores.</p>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Zap size={20} className="fill-white" /> Orquestar Despliegue
                </button>
              </div>
            </div>

          </form>
        )}
      </main>
    </div>
  );
}

function SectionCard({ title, subtitle, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm">{icon}</div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="text-sm font-medium text-slate-500">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function Input({ label, description, ...props }) {
  return (
    <div className="space-y-2 w-full">
      <label className="block text-sm font-bold text-slate-700">{label}</label>
      <input
        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 shadow-sm"
        {...props}
      />
      {description && <p className="text-xs text-slate-500 font-medium px-1 leading-relaxed">{description}</p>}
    </div>
  );
}

function SummaryItem({ checked, label }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      {checked ? (
        <CheckCircle2 size={20} className="text-green-500 shrink-0 fill-green-50" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
      )}
      <span className={checked ? "text-slate-900 font-bold" : "text-slate-500 font-medium"}>{label}</span>
    </li>
  );
}

export default App;
