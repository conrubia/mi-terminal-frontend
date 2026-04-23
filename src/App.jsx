import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import EconomicCalendar from "./EconomicCalendar";
import FearAndGreed from "./FearAndGreed";

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  const newsMapRef = useRef({}); 
  
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  const [selectedNews, setSelectedNews] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartError, setChartError] = useState(null); // NUEVO: Chivato de errores
  const [searchInput, setSearchInput] = useState('');

  // ⚠️ PON TU URL DE RENDER AQUÍ (Sin barra al final)
  const RENDER_URL = "https://mi-terminal-backend.onrender.com"; 

  const manejarBusqueda = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
        setTicker(searchInput.toUpperCase().trim());
        setSearchInput('');
        setSelectedNews(null);
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    let isMounted = true;
    setIsLoading(true);
    setChartError(null);
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      width: chartContainerRef.current.clientWidth,
      height: 600,
      crosshair: { mode: 0 }
    });
    chartInstance.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    const fetchData = async () => {
      try {
        const resP = await fetch(`${RENDER_URL}/api/precios/${ticker}?timeframe=${timeframe.toLowerCase()}`);
        const candleData = await resP.json();
        
        // CHIVATO DE ERRORES: Si el backend manda error, lo mostramos en pantalla
        if (candleData.error) {
            if (isMounted) setChartError(candleData.error);
            return;
        }

        if (!isMounted || !Array.isArray(candleData) || candleData.length === 0) {
            if (isMounted) setChartError("No se recibieron datos válidos.");
            return;
        }

        candleSeries.setData(candleData);

        const resN = await fetch(`${RENDER_URL}/api/analisis/${ticker}`);
        const newsData = await resN.json();

        if (Array.isArray(newsData) && isMounted) {
            const markers = [];
            const localNewsMap = {};

            newsData.forEach(news => {
                const match = candleData.reduce((prev, curr) => {
                    return (Math.abs(new Date(curr.time) - new Date(news.fecha)) < Math.abs(new Date(prev.time) - new Date(news.fecha)) ? curr : prev);
                });

                if (match) {
                    localNewsMap[match.time] = news;
                    markers.push({ time: match.time, position: 'aboveBar', color: '#2962FF', shape: 'circle', text: 'N' });
                }
            });
            newsMapRef.current = localNewsMap;
            createSeriesMarkers(candleSeries, markers);
        }
        chart.timeScale().fitContent();
      } catch (e) { 
        console.error(e); 
        if (isMounted) setChartError("Fallo de conexión con el servidor.");
      } finally { 
        if (isMounted) setIsLoading(false); 
      }
    };

    fetchData();
    
    chart.subscribeClick((p) => {
        const d = p.time ? (typeof p.time === 'string' ? p.time : `${p.time.year}-${String(p.time.month).padStart(2, '0')}-${String(p.time.day).padStart(2, '0')}`) : null;
        setSelectedNews(newsMapRef.current[d] || null);
    });

    return () => { isMounted = false; chart.remove(); };
  }, [ticker, timeframe]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .loader { border: 4px solid #1e222d; border-top: 4px solid #26a69a; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 15px; }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto', alignItems: 'stretch' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px' }}>Terminal</span></h2>
            <form onSubmit={manejarBusqueda}>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Ticker (Ej: AAPL)..." style={{ padding: '10px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white' }} />
            </form>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {['1M', '6M', '1Y', 'MAX'].map(t => (
              <button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#26a69a' : '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t}</button>
            ))}
          </div>

          <div style={{ position: 'relative', border: '1px solid #2B2B43', borderRadius: '8px', overflow: 'hidden', flexGrow: 1, minHeight: '600px', backgroundColor: '#131722' }}>
            {/* EL LIENZO DEL GRÁFICO */}
            <div ref={chartContainerRef} style={{ height: '100%', width: '100%' }} />
            
            {/* PANTALLA DE CARGA VISIBLE */}
            {isLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(19, 23, 34, 0.85)', zIndex: 10 }}>
                <div className="loader"></div>
                <h3 style={{ color: '#26a69a', margin: 0, letterSpacing: '2px' }}>DESCARGANDO DATOS...</h3>
              </div>
            )}

            {/* PANTALLA DE ERROR VISIBLE (El Chivato) */}
            {chartError && !isLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 83, 80, 0.1)', zIndex: 10, padding: '20px', textAlign: 'center' }}>
                <span style={{ fontSize: '40px', marginBottom: '10px' }}>⚠️</span>
                <h3 style={{ color: '#ef5350', margin: 0 }}>Error al cargar gráfico</h3>
                <p style={{ color: '#d1d4dc' }}>{chartError}</p>
                <p style={{ color: '#787B86', fontSize: '12px' }}>Intenta buscar otro Ticker válido (Ej: MSFT, TSLA)</p>
              </div>
            )}

            {/* POP-UP DE NOTICIAS */}
            {selectedNews && !isLoading && !chartError && (
               <div style={{ position: 'absolute', top: '20px', left: '20px', width: '300px', backgroundColor: '#1E222D', borderLeft: '4px solid #2962FF', padding: '15px', zIndex: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: '11px', color: '#787B86', display: 'flex', justifyContent: 'space-between' }}><span>{selectedNews.fuente}</span><span style={{ cursor: 'pointer' }} onClick={() => setSelectedNews(null)}>✕</span></div>
                  <p style={{ fontWeight: 'bold', fontSize: '14px', margin: '10px 0', lineHeight: '1.4' }}>{selectedNews.titulo}</p>
                  <a href={selectedNews.url} target="_blank" rel="noreferrer" style={{ color: '#26a69a', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold' }}>Leer original ↗</a>
                </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ flex: 1, backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px', overflow: 'hidden' }}><EconomicCalendar /></div>
          <div style={{ flex: 1, backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px', overflow: 'hidden' }}><FearAndGreed /></div>
        </div>
      </div>
    </div>
  );
}
export default App;