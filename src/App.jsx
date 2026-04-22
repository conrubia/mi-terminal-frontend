import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import EconomicCalendar from "./assets/EconomicCalendar";
import FearAndGreed from "./FearAndGreed";

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  const [selectedNews, setSelectedNews] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  // ⚠️ CAMBIA ESTO: URL de tu Render (Ej: https://mi-api.onrender.com)
  const RENDER_URL = "https://mi-terminal-backend.onrender.com"; 

  const manejarBusqueda = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setTicker(searchInput.toUpperCase());
      setSearchInput('');
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    let isMounted = true;
    setIsLoading(true);

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      width: chartContainerRef.current.clientWidth,
      height: 600,
    });
    chartInstance.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    const cargarDatos = async () => {
      try {
        // 1. Carga de precios a través del Backend
        const resP = await fetch(RENDER_URL + "/api/precios/" + ticker + "?timeframe=" + timeframe.toLowerCase());
        const candleData = await resP.json();
        
        if (!isMounted || candleData.error) return;
        candlestickSeries.setData(candleData);

        // 2. Carga de noticias
        const resN = await fetch(RENDER_URL + "/api/analisis/" + ticker);
        const noticias = await resN.json();

        if (noticias && isMounted) {
            const marcadores = [];
            Object.keys(noticias).forEach(fecha => {
                const n = noticias[fecha];
                if (candleData.some(d => d.time === fecha)) {
                    marcadores.push({
                        time: fecha, position: 'aboveBar', color: n.color, shape: 'circle', text: 'N'
                    });
                }
            });
            createSeriesMarkers(candlestickSeries, marcadores);
        }
        chart.timeScale().fitContent();
      } catch (e) {
        console.error("Error de conexión:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    cargarDatos();
    return () => { isMounted = false; chart.remove(); };
  }, [ticker, timeframe]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* PANEL IZQUIERDO: GRÁFICO */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px' }}>Terminal Financiera</span></h2>
            <form onSubmit={manejarBusqueda}>
              <input 
                value={searchInput} 
                onChange={e => setSearchInput(e.target.value)} 
                placeholder="Ej: BTC-USD, SAN.MC..." 
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white' }}
              />
            </form>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {['1M', '1Y', '5Y', 'MAX'].map(t => (
              <button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#2962FF' : '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t}</button>
            ))}
          </div>

          <div style={{ position: 'relative', border: '1px solid #2B2B43', borderRadius: '8px', overflow: 'hidden', height: '600px' }}>
            <div ref={chartContainerRef} style={{ height: '100%' }} />
            {isLoading && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '10px' }}>
                Sincronizando con Backend...
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: WIDGETS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px' }}>
            <EconomicCalendar />
          </div>
          <div style={{ backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px' }}>
            <FearAndGreed />
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;