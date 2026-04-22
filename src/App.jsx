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
  
  // === CONFIGURACIÓN ===
  const URL_RENDER = "hhttps://mi-terminal-backend.onrender.com"; // <--- CAMBIA ESTO

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

    const fetchData = async () => {
      try {
        // 1. OBTENER PRECIOS DESDE TU PROPIO BACKEND (ADIÓS CORS)
        const resPrecios = await fetch(URL_RENDER + "/api/precios/" + ticker + "?range=" + timeframe.toLowerCase());
        const candleData = await resPrecios.json();
        
        if (!isMounted || candleData.error) return;
        candlestickSeries.setData(candleData);

        // 2. OBTENER NOTICIAS
        const resNews = await fetch(URL_RENDER + "/api/analisis/" + ticker);
        const noticiasIA = await resNews.json();

        if (noticiasIA && isMounted) {
            const marcadores = [];
            Object.keys(noticiasIA).forEach(fecha => {
                const noticia = noticiasIA[fecha];
                const fechaCercana = candleData.find(d => d.time <= fecha)?.time;
                if (fechaCercana) {
                    marcadores.push({
                        time: fechaCercana, 
                        position: noticia.impact === 'Alcista' ? 'belowBar' : 'aboveBar',
                        color: noticia.color, 
                        shape: noticia.impact === 'Alcista' ? 'arrowUp' : 'arrowDown',
                        text: 'N', size: 2
                    });
                }
            });
            createSeriesMarkers(candlestickSeries, marcadores);
        }
        chart.timeScale().fitContent();
      } catch (e) { console.error(e); } finally { if (isMounted) setIsLoading(false); }
    };

    fetchData();
    return () => { isMounted = false; chart.remove(); };
  }, [ticker, timeframe]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px' }}>Terminal</span></h2>
            <form onSubmit={manejarBusqueda}><input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Ticker (Ej: SAN.MC, AAPL)..." style={{ padding: '8px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white' }} /></form>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {['1M', '1Y', '5Y'].map(t => <button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#2962FF' : '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t}</button>)}
          </div>
          <div style={{ position: 'relative', height: '600px' }}>
            <div ref={chartContainerRef} style={{ height: '100%', borderRadius: '8px', border: '1px solid #2B2B43', overflow: 'hidden' }} />
            {isLoading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#26a69a' }}>Conectando con Backend...</div>}
          </div>
        </div>
        <div style={{ backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px' }}>
           <EconomicCalendar />
           <FearAndGreed />
        </div>
      </div>
    </div>
  );
}
export default App;