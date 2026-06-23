import { useEffect, useState } from 'react';
import axios from 'axios';
import { ShieldAlert, AlertTriangle, AlertCircle, Info, CheckCircle, X, Bell, Zap, Clock, TrendingUp } from 'lucide-react';

interface Hotspot {
  spatial_cell: string;
  cis: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

const POLICIES = [
  {
    zone: 'Zone A',
    condition: 'CIS < 25',
    maxCIS: 25,
    minCIS: 0,
    policy: '120 min parking',
    fee: 'Base fee',
    enforcement: 'Low enforcement',
    icon: Info,
    color: 'bg-emerald-50 text-emerald-700',
    borderColor: 'border-emerald-200',
    accentColor: 'bg-emerald-500',
    editMsg: 'Policy rules for Zone A updated. Enforcement officers will receive updated 120-min limit notices in the next patrol cycle.',
  },
  {
    zone: 'Zone B',
    condition: 'CIS 25–50',
    maxCIS: 50,
    minCIS: 25,
    policy: '60 min parking',
    fee: '1.5× fee',
    enforcement: 'Warning tickets',
    icon: AlertCircle,
    color: 'bg-yellow-50 text-yellow-700',
    borderColor: 'border-yellow-200',
    accentColor: 'bg-yellow-400',
    editMsg: 'Policy rules for Zone B updated. Warning ticket threshold and 60-min limits will apply from next shift.',
  },
  {
    zone: 'Zone C',
    condition: 'CIS 50–75',
    maxCIS: 75,
    minCIS: 50,
    policy: '30 min parking',
    fee: '2× surge fee',
    enforcement: 'Frequent patrols',
    icon: AlertTriangle,
    color: 'bg-orange-50 text-orange-700',
    borderColor: 'border-orange-200',
    accentColor: 'bg-orange-500',
    editMsg: 'Zone C patrol frequency updated. Officers assigned to high-density corridors. Surge pricing activated.',
  },
  {
    zone: 'Zone D',
    condition: 'CIS 75+',
    maxCIS: 999,
    minCIS: 75,
    policy: 'Tow-ready',
    fee: 'Dynamic premium fee',
    enforcement: 'Immediate intervention',
    icon: ShieldAlert,
    color: 'bg-red-50 text-red-700',
    borderColor: 'border-red-200',
    accentColor: 'bg-red-600',
    editMsg: '',
  },
];

let toastCounter = 0;

export default function DynamicPolicyEngine() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pricingMultiplier, setPricingMultiplier] = useState(1.8);
  const [dispatchThreshold, setDispatchThreshold] = useState(75);
  const [autoTow, setAutoTow] = useState(true);
  const [peakSurge, setPeakSurge] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get('/api/hotspots');
        setHotspots(res.data);
      } catch (err) {
        console.error('Failed to load hotspots', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const addToast = (message: string, type: Toast['type']) => {
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  };

  const dismissToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const handleEditPolicy = (zone: string, msg: string) => {
    addToast(`✅ ${msg}`, 'success');
  };

  const handleDispatch = () => {
    const zoneDCells = hotspots.filter((h) => h.cis >= 75).length;
    addToast(
      `🚨 Tow units dispatched to ${zoneDCells} Zone D cells (CIS ≥ 75). Incident tracking activated. ETA: 8–12 min.`,
      'error'
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const getZoneCount = (min: number, max: number) =>
    hotspots.filter((h) => h.cis >= min && h.cis < max).length;

  const toastIconMap: Record<Toast['type'], string> = {
    success: '✅',
    warning: '⚠️',
    error: '🚨',
    info: 'ℹ️',
  };
  const toastBgMap: Record<Toast['type'], string> = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    warning: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    error: 'bg-red-50 border-red-400 text-red-900',
    info: 'bg-blue-50 border-blue-300 text-blue-900',
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 max-w-6xl mx-auto relative">

      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-50 space-y-3 w-96">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg text-sm font-medium animate-in slide-in-from-right duration-300 ${toastBgMap[t.type]}`}
          >
            <span className="text-base flex-shrink-0">{toastIconMap[t.type]}</span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="flex-shrink-0 opacity-50 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Dynamic Policy Engine</h2>
          <p className="text-slate-500 mt-2 text-base max-w-2xl">
            Automatically assigns and enforces zone-specific parking rules to every spatial cell based on its live
            <strong> Congestion Impact Score (CIS)</strong>. As a cell's congestion worsens, it escalates through
            Zone A → D, triggering stricter time limits, surge pricing, and enforcement actions — without any manual input.
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-semibold border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Engine Active
        </div>
      </div>

      {/* How it works strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp, label: 'CIS Computed', desc: 'Every cell gets a live Congestion Impact Score from violation density, propagation & enforcement failure.' },
          { icon: Zap, label: 'Zone Assigned', desc: 'CIS threshold maps each cell to a policy zone (A–D) in real time — no manual tagging.' },
          { icon: Bell, label: 'Rules Applied', desc: 'Officers receive time limits, pricing tiers and enforcement posture automatically per zone.' },
          { icon: Clock, label: 'Continuous Loop', desc: 'Zones recalculate every patrol cycle, escalating or de-escalating cells based on compliance.' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Icon className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 mb-1">{label}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Control Panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Policy Simulation &amp; Control Panel</h3>
            <p className="text-xs text-slate-500 mt-1">
              Adjust thresholds and toggle automated responders. Changes are applied to the next patrol cycle simulation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Sliders */}
          <div className="space-y-5 md:col-span-2">
            <div>
              <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                <span>Dynamic Pricing Sensitivity (Multiplier)</span>
                <span className="text-indigo-600 tabular-nums">{pricingMultiplier.toFixed(1)}×</span>
              </div>
              <input
                type="range" min="1.0" max="3.0" step="0.1"
                value={pricingMultiplier}
                onChange={(e) => setPricingMultiplier(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-xs text-slate-400 mt-1">Controls how aggressively Zone B/C/D fees escalate above base rate.</p>
            </div>

            <div>
              <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                <span>Response Dispatch Priority Threshold (CIS)</span>
                <span className="text-indigo-600 tabular-nums">{dispatchThreshold}</span>
              </div>
              <input
                type="range" min="50" max="90" step="1"
                value={dispatchThreshold}
                onChange={(e) => setDispatchThreshold(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-xs text-slate-400 mt-1">Cells above this CIS trigger immediate tow-unit dispatch eligibility.</p>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <button
              onClick={() => { setAutoTow(!autoTow); addToast(`Auto-Tow ${!autoTow ? 'enabled' : 'disabled'}.`, !autoTow ? 'success' : 'warning'); }}
              className={`flex flex-col justify-between p-3 rounded-lg border shadow-sm text-left transition-all ${autoTow ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
            >
              <span className="text-xs text-slate-500 font-medium">Auto-Tow</span>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${autoTow ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                <span className="text-xs font-bold text-slate-700">{autoTow ? 'ENABLED' : 'DISABLED'}</span>
              </div>
            </button>
            <button
              onClick={() => { setPeakSurge(!peakSurge); addToast(`Peak Surge pricing ${!peakSurge ? 'activated' : 'deactivated'}.`, !peakSurge ? 'success' : 'info'); }}
              className={`flex flex-col justify-between p-3 rounded-lg border shadow-sm text-left transition-all ${peakSurge ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}
            >
              <span className="text-xs text-slate-500 font-medium">Peak Surge</span>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${peakSurge ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                <span className="text-xs font-bold text-slate-700">{peakSurge ? 'AUTO-SURGE' : 'OFF'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Zone Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {POLICIES.map((p, i) => {
          const activeCells = getZoneCount(p.minCIS, p.maxCIS);
          return (
            <div key={i} className={`bg-white rounded-xl shadow-sm border ${p.borderColor} overflow-hidden hover:shadow-md transition-shadow`}>
              <div className={`${p.color} p-4 flex items-center justify-between`}>
                <div>
                  <h3 className="font-bold text-lg">{p.zone}</h3>
                  <p className="text-sm opacity-90">{p.condition}</p>
                </div>
                <p.icon className="w-8 h-8 opacity-70" />
              </div>

              <div className="p-5 space-y-4">
                <div className="text-center py-4 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-3xl font-black text-slate-800">{activeCells}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">Active Cells in Zone</p>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Max Duration', val: p.policy },
                    { label: 'Pricing Tier', val: p.fee },
                    { label: 'Enforcement', val: p.enforcement },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                      <p className="font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded border border-slate-100 text-sm">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                {p.zone === 'Zone D' ? (
                  <button
                    onClick={handleDispatch}
                    className="w-full py-2 rounded-lg font-semibold transition-all bg-red-600 hover:bg-red-700 active:scale-95 text-white border border-red-600 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Dispatch Tow Units
                  </button>
                ) : (
                  <button
                    onClick={() => handleEditPolicy(p.zone, p.editMsg)}
                    className="w-full py-2 rounded-lg font-medium transition-all bg-white hover:bg-indigo-50 active:scale-95 text-slate-700 hover:text-indigo-700 border border-slate-300 hover:border-indigo-300 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Apply Policy Rules
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
