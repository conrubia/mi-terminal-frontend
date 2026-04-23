import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import EconomicCalendar from "./EconomicCalendar";
import FearAndGreed from "./FearAndGreed";

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  const interactiveMapRef = useRef({}); 
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  const [selectedItem, setSelectedItem] = useState({ noticia: null, evento: null }); 
  const [isLoading, setIsLoading] = useState(true);
  const [chartError, setChartError] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const RENDER_URL = "https://mi-terminal-backend.onrender.com"; 

  useEffect(() => {
    if (!chartContainerRef.current) return;
    let isMounted = true;
    setIsLoading(true);
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      width: chartContainerRef.current.clientWidth,
      height: 600,
    });
    chartInstance.current = chart;

    // 1. Serie de Velas
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    // 2. Serie de Volumen (Panel inferior)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Esto crea el overlay
    });
    
    // Configuramos el volumen para que solo ocupe el 20% inferior
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const fetchData = async () => {
      try {
        const resP = await fetch(`${RENDER_URL}/api/precios/${ticker}?timeframe=${timeframe.toLowerCase()}`);
        const candleData = await resP.json();
        if (candleData.error) { if (isMounted) setChartError(candleData.error); return; }
        
        candleSeries.setData(candleData);
        
        // Mapear datos para el volumen (color según si el día fue verde o rojo)
        const volumeData = candleData.map(d => ({
          time: d.time,
          value: d.value,
          color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        }));
        volumeSeries.setData(volumeData);

        const [newsData, eventsData] = await Promise.all([
          fetch(`${RENDER_URL}/api/analisis/${ticker}`).then(r => r.json()),
          fetch(`${RENDER_URL}/api/eventos_macro`).then(r => r.json())
        ]);

        if (isMounted) {
            const markers = [];
            const localMap = {};
            const encontrarVela = (f) => candleData.reduce((p, c) => (Math.abs(new Date(c.time) - new Date(f)) < Math.abs(new Date(p.time) - new Date(f)) ? c : p));

            if (Array.isArray(eventsData)) {
                eventsData.forEach(e => {
                    const v = encontrarVela(e.fecha);
                    if (!localMap[v.time]) localMap[v.time] = { noticia: null, evento: null };
                    localMap[v.time].evento = e;
                    markers.push({ time: v.time, position: 'atTheBottom', color: e.color, shape: 'square', text: 'E' });
                });
            }

            if (Array.isArray(newsData)) {
                newsData.forEach(n => {
                    const v = encontrarVela(n.fecha);
                    if (!localMap[v.time]) localMap[v.time] = { noticia: null, evento: null };
                    localMap[v.time].noticia = n;
                    markers.push({ time: v.time, position: 'aboveBar', color: n.color, shape: 'circle', text: 'N' });
                });
            }
            interactiveMapRef.current = localMap;
            markers.sort((a, b) => new Date(a.time) - new Date(b.time));
            createSeriesMarkers(candleSeries, markers);
        }
        chart.timeScale().fitContent();
      } catch (e) { if (isMounted) setChartError("Fallo de conexión."); } finally { if (isMounted) setIsLoading(false); }
    };

    fetchData();
    chart.subscribeClick((p) => {
        const d = p.time ? (typeof p.time === 'string' ? p.time : `${p.time.year}-${String(p.time.month).padStart(2, '0')}-${String(p.time.day).padStart(2, '0')}`) : null;
        setSelectedItem(interactiveMapRef.current[d] || { noticia: null, evento: null });
    });
    return () => { isMounted = false; chart.remove(); };
  }, [ticker, timeframe]);

  // (Mantenemos los Popups y el Return del JSX igual que el anterior, solo actualizamos el contenedor del gráfico)
  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .loader { border: 4px solid #1e222d; border-top: 4px solid #26a69a; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 15px; }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px' }}>Terminal</span></h2>
            <form onSubmit={(e) => { e.preventDefault(); setTicker(searchInput.toUpperCase()); setSearchInput(''); }}><input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Ticker..." style={{ padding: '10px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white' }} /></form>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>{['1M', '6M', '1Y', 'MAX'].map(t => (<button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#26a69a' : '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t}</button>))}</div>
          <div style={{ position: 'relative', border: '1px solid #2B2B43', borderRadius: '8px', overflow: 'hidden', flexGrow: 1, minHeight: '600px', backgroundColor: '#131722' }}>
            <div ref={chartContainerRef} style={{ height: '100%' }} />
            {isLoading && <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(19, 23, 34, 0.85)', zIndex: 10 }}><div className="loader"></div><p>Sincronizando...</p></div>}
            {selectedItem?.noticia && <div style={{ position: 'absolute', top: '20px', left: '20px', width: '300px', backgroundColor: '#1E222D', borderLeft: `4px solid ${selectedItem.noticia.color}`, padding: '15px', zIndex: 20 }}>{selectedItem.noticia.titulo} <br/><a href={selectedItem.noticia.url} target="_blank" style={{ color: '#26a69a' }}>Leer ↗</a></div>}
            {selectedItem?.evento && <div style={{ position: 'absolute', bottom: '100px', right: '20px', width: '250px', backgroundColor: '#2a1a1a', border: '1px solid #FF9800', padding: '15px', zIndex: 20 }}><b>{selectedItem.evento.titulo}</b><br/>Prev: {selectedItem.evento.prev} | Act: {selectedItem.evento.actual}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}><div style={{ flex: 1, backgroundColor: '#131722', borderRadius: '8px', padding: '15px' }}><EconomicCalendar /></div><div style={{ flex: 1, backgroundColor: '#131722', borderRadius: '8px', padding: '15px' }}><FearAndGreed /></div></div>
      </div>
    </div>
  );
}
export default App;