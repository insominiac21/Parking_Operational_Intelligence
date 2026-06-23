import { useEffect, useState, useMemo } from 'react';
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

let toastCounter = 0;

export default function DynamicPolicyEngine() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // === LIVE CONTROLS ===
  const [pricingMultiplier, setPricingMultiplier] = useState(1.8);
  const [dispatchThreshold, setDispatchThreshold] = useState(75);
  const [autoTow, setAutoTow] = useState(true);
  const [peakSurge, setPeakSurge] = useState(true);

  useEffect(() => {
    axios.get('/api/hotspots').then(res => setHotspots(res.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const addToast = (message: string, type: Toast['type']) => {
    const id = ++toastCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // === DERIVED ZONE DEFINITIONS (all driven by slider state) ===
  const zones = useMemo(() => {
    // Fee multipliers scale with pricingMultiplier
    const feeB = (pricingMultiplier * 0.55).toFixed(1);   // ~half the max
    const feeC = (pricingMultiplier * 0.80).toFixed(1);   // ~three-quarters
    const feeD = pricingMultiplier.toFixed(1);             // maximum

    // Zone C upper boundary is the dispatch threshold, Zone D starts there
    const thresholdC = dispatchThreshold;

    // Parking time limits tighten as pricing goes up
    const timeB = pricingMultiplier < 2.0 ? '60 min' : pricingMultiplier < 2.5 ? '45 min' : '30 min';
    const timeC = pricingMultiplier < 2.0 ? '30 min' : pricingMultiplier < 2.5 ? '20 min' : '15 min';

    // Enforcement posture escalates at high thresholds
    const enfC = dispatchThreshold <= 60
      ? 'Active patrols + warnings'
      : dispatchThreshold <= 70
      ? 'Frequent patrols'
      : 'Scheduled patrols';
    const enfD = autoTow ? 'Immediate tow + intervention' : 'Immediate intervention';

    return [
      {
        zone: 'Zone A',
        condition: 'CIS < 25',
        minCIS: 0,
        maxCIS: 25,
        policy: '120 min parking',
        fee: 'Base rate (1.0×)',
        enforcement: 'Low enforcement',
        icon: Info,
        color: 'bg-emerald-50 text-emerald-700',
        borderColor: 'border-emerald-200',
        accentColor: 'bg-emerald-500',
        editMsg: 'Zone A rules applied. 120-min limit stays in effect for compliant areas.',
        changed: false,
      },
      {
        zone: 'Zone B',
        condition: 'CIS 25–50',
        minCIS: 25,
        maxCIS: 50,
        policy: `${timeB} parking`,
        fee: `${feeB}× surge fee`,
        enforcement: 'Warning tickets',
        icon: AlertCircle,
        color: 'bg-yellow-50 text-yellow-700',
        borderColor: pricingMultiplier !== 1.8 ? 'border-yellow-400' : 'border-yellow-200',
        accentColor: 'bg-yellow-400',
        editMsg: `Zone B updated — ${timeB} limit, ${feeB}× fee. Officers notified.`,
        changed: pricingMultiplier !== 1.8,
      },
      {
        zone: 'Zone C',
        condition: `CIS 50–${thresholdC}`,
        minCIS: 50,
        maxCIS: thresholdC,
        policy: `${timeC} parking`,
        fee: `${feeC}× surge fee`,
        enforcement: enfC,
        icon: AlertTriangle,
        color: 'bg-orange-50 text-orange-700',
        borderColor: (pricingMultiplier !== 1.8 || dispatchThreshold !== 75) ? 'border-orange-400' : 'border-orange-200',
        accentColor: 'bg-orange-500',
        editMsg: `Zone C updated — ${timeC} limit, ${feeC}× pricing, ${enfC}. Patrol schedule pushed.`,
        changed: pricingMultiplier !== 1.8 || dispatchThreshold !== 75,
      },
      {
        zone: 'Zone D',
        condition: `CIS ${thresholdC}+`,
        minCIS: thresholdC,
        maxCIS: 999,
        policy: 'Tow-ready',
        fee: `${feeD}× dynamic premium`,
        enforcement: enfD,
        icon: ShieldAlert,
        color: 'bg-red-50 text-red-700',
        borderColor: dispatchThreshold !== 75 ? 'border-red-400' : 'border-red-200',
        accentColor: 'bg-red-600',
        editMsg: '',
        changed: dispatchThreshold !== 75 || autoTow,
      },
    ];
  }, [pricingMultiplier, dispatchThreshold, autoTow]);

  const getZoneCount = (min: number, max: number) =>
    hotspots.filter(h => h.cis >= min && h.cis < max).length;

  const toastBgMap: Record<Toast['type'], string> = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    warning: 'bg-yellow-50 border-yellow-300 text-yellow-900',
    error: 'bg-red-50 border-red-400 text-red-900',
    info: 'bg-blue-50 border-blue-300 text-blue-900',
  };
  const toastIconMap: Record<Toast['type'], string> = {
    success: '✅', warning: '⚠️', error: '🚨', info: 'ℹ️',
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );

  const totalCells = hotspots.length;
  const zoneDCount = getZoneCount(dispatchThreshold, 999);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 max-w-6xl mx-auto relative">

      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-50 space-y-3 w-96 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg text-sm font-medium animate-in slide-in-from-right duration-300 ${toastBgMap[t.type]}`}>
            <span className="text-base flex-shrink-0">{toastIconMap[t.type]}</span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="flex-shrink-0 opacity-50 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Dynamic Policy Engine</h2>
          <p className="text-slate-500 mt-2 text-base max-w-2xl">
            Assigns zone-specific parking rules to every spatial cell based on its live{' '}
            <strong>Congestion Impact Score (CIS)</strong>. Adjust the sliders — zone boundaries,
            fees, and enforcement postures update instantly below.
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-semibold border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Engine Active
        </div>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: TrendingUp, label: 'Live CIS Score', desc: 'Every hotspot cell gets a Congestion Impact Score from violation density, propagation, and enforcement failure.' },
          { icon: Zap, label: 'Auto Zone Assignment', desc: 'CIS thresholds (set by you via sliders) map each cell to a Zone A–D policy band in real time.' },
          { icon: Bell, label: 'Rules Broadcast', desc: 'Time limits, pricing tiers, and enforcement posture are automatically applied per zone per patrol cycle.' },
          { icon: Clock, label: 'Continuous Loop', desc: 'Zones re-evaluate each cycle — cells escalate or de-escalate as their CIS changes.' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Icon className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700 mb-0.5">{label}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ===== CONTROL PANEL ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Policy Simulation &amp; Control Panel</h3>
            <p className="text-xs text-slate-500 mt-1">
              Move the sliders — zone cards below update instantly. No API calls needed.
            </p>
          </div>
          <div className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
            {totalCells} hotspot cells loaded
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-5 md:col-span-2">
            {/* Pricing slider */}
            <div>
              <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                <span>Dynamic Pricing Sensitivity</span>
                <span className="text-indigo-600 tabular-nums font-bold">{pricingMultiplier.toFixed(1)}×</span>
              </div>
              <input
                type="range" min="1.0" max="3.0" step="0.1"
                value={pricingMultiplier}
                onChange={e => setPricingMultiplier(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1.0× (base)</span>
                <span className="text-indigo-500 font-medium">→ Zone B: {(pricingMultiplier * 0.55).toFixed(1)}× · Zone C: {(pricingMultiplier * 0.80).toFixed(1)}× · Zone D: {pricingMultiplier.toFixed(1)}×</span>
                <span>3.0×</span>
              </div>
            </div>

            {/* CIS threshold slider */}
            <div>
              <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                <span>Dispatch Priority Threshold (Zone D starts at CIS ≥)</span>
                <span className="text-red-600 tabular-nums font-bold">{dispatchThreshold}</span>
              </div>
              <input
                type="range" min="50" max="90" step="1"
                value={dispatchThreshold}
                onChange={e => setDispatchThreshold(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>50 (aggressive)</span>
                <span className="text-red-500 font-medium">
                  Zone C: 50–{dispatchThreshold} · Zone D: {dispatchThreshold}+ → <strong>{getZoneCount(dispatchThreshold, 999)} cells at tow risk</strong>
                </span>
                <span>90 (lenient)</span>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <button
              onClick={() => { setAutoTow(!autoTow); addToast(`Auto-Tow ${!autoTow ? 'enabled' : 'disabled'}.`, !autoTow ? 'success' : 'warning'); }}
              className={`flex flex-col justify-between p-3 rounded-lg border shadow-sm text-left transition-all cursor-pointer ${autoTow ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}
            >
              <span className="text-xs text-slate-500 font-medium">Auto-Tow</span>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${autoTow ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className="text-xs font-bold text-slate-700">{autoTow ? 'ENABLED' : 'OFF'}</span>
              </div>
            </button>
            <button
              onClick={() => { setPeakSurge(!peakSurge); addToast(`Peak Surge ${!peakSurge ? 'activated' : 'deactivated'}.`, !peakSurge ? 'success' : 'info'); }}
              className={`flex flex-col justify-between p-3 rounded-lg border shadow-sm text-left transition-all cursor-pointer ${peakSurge ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}
            >
              <span className="text-xs text-slate-500 font-medium">Peak Surge</span>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2.5 h-2.5 rounded-full ${peakSurge ? 'bg-amber-500' : 'bg-slate-300'}`} />
                <span className="text-xs font-bold text-slate-700">{peakSurge ? 'AUTO' : 'OFF'}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ===== ZONE CARDS — fully driven by slider state ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {zones.map((p, i) => {
          const count = getZoneCount(p.minCIS, p.maxCIS);
          const pct = totalCells > 0 ? ((count / totalCells) * 100).toFixed(1) : '0';
          return (
            <div
              key={i}
              className={`bg-white rounded-xl shadow-sm border-2 ${p.borderColor} overflow-hidden transition-all duration-300 hover:shadow-md ${p.changed ? 'ring-2 ring-indigo-300/50' : ''}`}
            >
              {/* Zone header */}
              <div className={`${p.color} p-4 flex items-center justify-between`}>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">{p.zone}</h3>
                    {p.changed && (
                      <span className="text-xs px-1.5 py-0.5 bg-white/60 rounded font-semibold">LIVE</span>
                    )}
                  </div>
                  <p className="text-sm opacity-90 font-mono">{p.condition}</p>
                </div>
                <p.icon className="w-8 h-8 opacity-70" />
              </div>

              <div className="p-5 space-y-4">
                {/* Cell count with bar */}
                <div className="text-center py-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-3xl font-black text-slate-800">{count}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">Cells in Zone</p>
                  <div className="mt-2 mx-4 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.accentColor} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{pct}% of all cells</p>
                </div>

                {/* Policy details — driven by slider */}
                <div className="space-y-2">
                  {[
                    { label: 'Max Duration', val: p.policy },
                    { label: 'Pricing Tier', val: p.fee },
                    { label: 'Enforcement', val: p.enforcement },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                      <p className="font-medium text-slate-700 bg-slate-50 px-3 py-1.5 rounded border border-slate-100 text-sm transition-all duration-300">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action button */}
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                {p.zone === 'Zone D' ? (
                  <button
                    onClick={() => addToast(`🚨 Tow units dispatched to ${count} Zone D cells (CIS ≥ ${dispatchThreshold}). ETA 8–12 min.`, 'error')}
                    className="w-full py-2 rounded-lg font-semibold transition-all bg-red-600 hover:bg-red-700 active:scale-95 text-white border border-red-600 flex items-center justify-center gap-2 shadow-sm"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Dispatch Tow Units ({count})
                  </button>
                ) : (
                  <button
                    onClick={() => addToast(`✅ ${p.editMsg}`, 'success')}
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
