import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import EconomicCalendar from "./EconomicCalendar";
import FearAndGreed from "./FearAndGreed";

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  const [selectedNews, setSelectedNews] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  // ⚠️ TU URL DE RENDER AQUÍ (Sin / al final)
  const RENDER_URL = "https://mi-terminal-backend.onrender.com"; 

  const manejarBusqueda = (e) => {
    e.preventDefault();
    if (searchInput.trim()) { setTicker(searchInput.toUpperCase()); setSearchInput(''); }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    let isMounted = true;
    setIsLoading(true);
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
    chartInstance.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    let noticiasAsignadas = {};

    const cargarTodo = async () => {
      try {
        // Petición con el timeframe seleccionado
        const resP = await fetch(`${RENDER_URL}/api/precios/${ticker}?timeframe=${timeframe.toLowerCase()}`);
        let candleData = await resP.json();
        
        if (!isMounted || candleData.error || !Array.isArray(candleData)) return;
        
        // BLINDAJE FRONTEND: Ordenar por fecha exacta por si acaso
        candleData.sort((a, b) => new Date(a.time) - new Date(b.time));
        candlestickSeries.setData(candleData);

        const resN = await fetch(`${RENDER_URL}/api/analisis/${ticker}`);
        const noticiasIA = await resN.json();

        if (noticiasIA && isMounted) {
            const marcadores = [];
            Object.keys(noticiasIA).forEach(fecha => {
                const n = noticiasIA[fecha];
                const fCercana = candleData.find(d => d.time === fecha)?.time;
                if (fCercana) {
                    noticiasAsignadas[fCercana] = { ...n, date: fecha };
                    marcadores.push({ time: fCercana, position: 'aboveBar', color: n.color, shape: 'circle', text: 'N' });
                }
            });
            createSeriesMarkers(candlestickSeries, marcadores);
        }
        chart.timeScale().fitContent();
      } catch (e) { 
        console.error("Error al cargar:", e); 
      } finally { 
        if (isMounted) setIsLoading(false); 
      }
    };

    cargarTodo();
    chart.subscribeClick((p) => { if (p.time && noticiasAsignadas[p.time]) setSelectedNews(noticiasAsignadas[p.time]); else setSelectedNews(null); });
    
    // Resize automático
    const handleResize = () => { chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight }); };
    window.addEventListener('resize', handleResize);
    
    return () => { isMounted = false; window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [ticker, timeframe]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      {/* GRID DE DOS COLUMNAS CON ALINEACIÓN ESTIRADA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto', alignItems: 'stretch' }}>
        
        {/* COLUMNA IZQUIERDA: GRÁFICO */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px' }}>Terminal Pro</span></h2>
            <form onSubmit={manejarBusqueda}>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Ticker (Ej: TSLA)..." style={{ padding: '10px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white' }} />
            </form>
          </div>

          {/* BOTONES DE TEMPORALIDAD RESTAURADOS */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {['1M', '6M', '1Y', '5Y', 'MAX'].map(t => (
              <button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#2962FF' : '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t}</button>
            ))}
          </div>

          <div style={{ position: 'relative', border: '1px solid #2B2B43', borderRadius: '8px', overflow: 'hidden', flexGrow: 1, minHeight: '600px' }}>
            <div ref={chartContainerRef} style={{ height: '100%', width: '100%' }} />
            {isLoading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '10px' }}>Cargando datos...</div>}
            
            {selectedNews && (
               <div style={{ position: 'absolute', top: '20px', right: '20px', width: '280px', backgroundColor: '#1E222D', border: `1px solid ${selectedNews.color}`, borderRadius: '8px', padding: '15px', zIndex: 100 }}>
                  <div style={{ fontSize: '11px', color: '#787B86', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>{selectedNews.date}</span><span style={{ cursor: 'pointer' }} onClick={() => setSelectedNews(null)}>✕</span></div>
                  <div style={{ fontWeight: 'bold', margin: '10px 0' }}>{selectedNews.es.title}</div>
                  <a href={selectedNews.url} target="_blank" rel="noreferrer" style={{ color: '#2962FF', fontSize: '12px', textDecoration: 'none' }}>Leer noticia completa →</a>
                </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: PANELES (IGUALADOS EN ALTURA) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
          {/* flex: 1 hace que ocupen el 50% del espacio disponible cada uno */}
          <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px' }}>
            <EconomicCalendar />
          </div>
          <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px' }}>
            <FearAndGreed />
          </div>
        </div>

      </div>
    </div>
  );
}
export default App;