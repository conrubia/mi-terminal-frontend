import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import EconomicCalendar from "./EconomicCalendar";
import FearAndGreed from "./FearAndGreed";

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  const noticiasRef = useRef({}); // Referencia blindada para los clics
  
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  const [selectedNews, setSelectedNews] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  // ⚠️ CAMBIA ESTO POR TU URL DE RENDER (Sin la barra al final)
  const RENDER_URL = "https://mi-terminal-backend.onrender.com"; 

  const manejarBusqueda = (e) => {
    e.preventDefault();
    if (searchInput.trim()) { 
        setTicker(searchInput.toUpperCase()); 
        setSearchInput(''); 
        setSelectedNews(null); // Cerramos noticia abierta al buscar
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;
    let isMounted = true;
    setIsLoading(true);
    setSelectedNews(null);
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      crosshair: { mode: 0 }
    });
    chartInstance.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    const cargarTodo = async () => {
      try {
        // 1. Cargar Precios
        const resP = await fetch(`${RENDER_URL}/api/precios/${ticker}?timeframe=${timeframe.toLowerCase()}`);
        let candleData = await resP.json();
        
        if (!isMounted || candleData.error || !Array.isArray(candleData)) {
            setIsLoading(false);
            return;
        }
        
        candleData.sort((a, b) => new Date(a.time) - new Date(b.time));
        candlestickSeries.setData(candleData);

        // 2. Cargar Noticias y Enlazar
        const resN = await fetch(`${RENDER_URL}/api/analisis/${ticker}`);
        const noticiasData = await resN.json();

        if (noticiasData && isMounted) {
            const marcadores = [];
            const mapaTemporal = {};

            Object.keys(noticiasData).forEach(fecha => {
                const noticia = noticiasData[fecha];
                // Comprobamos si el día de la noticia existe en el gráfico
                const diaEnGrafico = candleData.find(d => d.time === fecha);
                if (diaEnGrafico) {
                    mapaTemporal[fecha] = noticia;
                    marcadores.push({ 
                        time: fecha, 
                        position: 'aboveBar', 
                        color: noticia.color, 
                        shape: 'circle', 
                        text: 'N',
                        size: 2
                    });
                }
            });
            
            // Guardamos el mapa en el useRef para que el evento click pueda leerlo
            noticiasRef.current = mapaTemporal; 
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

    // 3. Lógica robusta del clic
    chart.subscribeClick((param) => {
        if (!param.time) {
            setSelectedNews(null);
            return;
        }
        
        // Lightweight charts a veces devuelve un objeto {year, month, day}, lo formateamos
        const dateStr = typeof param.time === 'object' 
            ? `${param.time.year}-${String(param.time.month).padStart(2, '0')}-${String(param.time.day).padStart(2, '0')}`
            : param.time;

        const noticiaEncontrada = noticiasRef.current[dateStr];
        
        if (noticiaEncontrada) {
            setSelectedNews({ ...noticiaEncontrada, date: dateStr });
        } else {
            setSelectedNews(null);
        }
    });
    
    const handleResize = () => { 
        if(chartContainerRef.current) {
            chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight }); 
        }
    };
    window.addEventListener('resize', handleResize);
    
    return () => { isMounted = false; window.removeEventListener('resize', handleResize); chart.remove(); };
  }, [ticker, timeframe]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      
      {/* Animación CSS incrustada */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner { border: 4px solid rgba(38, 166, 154, 0.2); border-top-color: #26a69a; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto', alignItems: 'stretch' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px' }}>Terminal Pro</span></h2>
            <form onSubmit={manejarBusqueda}>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Ej: TSLA, MSFT..." style={{ padding: '10px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white' }} />
            </form>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {['1M', '6M', '1Y', '5Y', 'MAX'].map(t => (
              <button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#26a69a' : '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t}</button>
            ))}
          </div>

          {/* CONTENEDOR DEL GRÁFICO Y OVERLAYS */}
          <div style={{ position: 'relative', border: '1px solid #2B2B43', borderRadius: '8px', overflow: 'hidden', flexGrow: 1, minHeight: '600px', backgroundColor: '#131722' }}>
            <div ref={chartContainerRef} style={{ height: '100%', width: '100%' }} />
            
            {/* OVERLAY DE CARGA (ANIMACIÓN) */}
            {isLoading && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(19, 23, 34, 0.7)', backdropFilter: 'blur(2px)' }}>
                <div className="spinner"></div>
                <div style={{ marginTop: '15px', color: '#26a69a', fontWeight: 'bold', letterSpacing: '1px' }}>SINCRONIZANDO MERCADO...</div>
              </div>
            )}
            
            {/* PANEL DE NOTICIA (MODAL) */}
            {selectedNews && !isLoading && (
               <div style={{ position: 'absolute', top: '20px', left: '20px', width: '320px', backgroundColor: '#1E222D', borderLeft: `4px solid ${selectedNews.color}`, borderRadius: '4px', padding: '15px', zIndex: 100, boxShadow: '0 8px 16px rgba(0,0,0,0.6)' }}>
                  <div style={{ fontSize: '11px', color: '#787B86', display: 'flex', justifyContent: 'space-between', marginBottom: '10px', textTransform: 'uppercase' }}>
                    <span>{selectedNews.publisher} • {selectedNews.date}</span>
                    <span style={{ cursor: 'pointer', fontSize: '14px', padding: '0 5px' }} onClick={() => setSelectedNews(null)}>✕</span>
                  </div>
                  <div style={{ fontWeight: 'bold', margin: '5px 0 15px 0', lineHeight: '1.4', fontSize: '14px' }}>{selectedNews.title}</div>
                  <a href={selectedNews.url} target="_blank" rel="noreferrer" style={{ color: '#26a69a', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>LEER NOTICIA COMPLETA ↗</a>
                </div>
            )}
          </div>
        </div>

        {/* PANELES LATERALES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
          <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px' }}>
            <EconomicCalendar />
          </div>
          <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px' }}>
            <FearAndGreed />
          </div>
        </div>

      </div>
    </div>
  );
}
export default App;