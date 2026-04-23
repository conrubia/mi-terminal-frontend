import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import EconomicCalendar from "./EconomicCalendar";
import FearAndGreed from "./FearAndGreed";

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  // Ahora el mapa guardará noticias y eventos
  const interactiveMapRef = useRef({}); 
  
  const [ticker, setTicker] = useState('AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  
  // Estado para el popup que se abre al hacer clic (puede ser una noticia o un evento)
  const [selectedItem, setSelectedItem] = useState(null); 
  
  const [isLoading, setIsLoading] = useState(true);
  const [chartError, setChartError] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  // ⚠️ PON TU URL DE RENDER AQUÍ (Sin barra al final)
  const RENDER_URL = "https://mi-terminal-backend.onrender.com"; 

  const manejarBusqueda = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
        setTicker(searchInput.toUpperCase().trim());
        setSearchInput('');
        setSelectedItem(null);
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
        // 1. Descargar Precios
        const resP = await fetch(`${RENDER_URL}/api/precios/${ticker}?timeframe=${timeframe.toLowerCase()}`);
        const candleData = await resP.json();
        
        if (candleData.error) { if (isMounted) setChartError(candleData.error); return; }
        if (!isMounted || !Array.isArray(candleData) || candleData.length === 0) { if (isMounted) setChartError("Sin datos."); return; }
        candleSeries.setData(candleData);

        // 2. Descargar Noticias (IA) y Eventos Macro
        const [resN, resE] = await fetch(`${RENDER_URL}/api/analisis/${ticker}`).then(r => r.json()),
              eventsData = await fetch(`${RENDER_URL}/api/eventos_macro`).then(r => r.json());

        if (isMounted) {
            const markers = [];
            const localInteractiveMap = {};

            // FUNCIÓN DE AYUDA: Encuentra la vela más cercana a una fecha
            const encontrarVelaCercana = (fechaObjetivo) => {
                return candleData.reduce((prev, curr) => {
                    return (Math.abs(new Date(curr.time) - new Date(fechaObjetivo)) < Math.abs(new Date(prev.time) - new Date(fechaObjetivo)) ? curr : prev);
                });
            };

            // --- A) Procesar Eventos Macro (3 Toros) con Lógica de Aproximación ---
            if (Array.isArray(eventsData)) {
                eventsData.forEach(evento => {
                    // BUSCAMOS LA VELA MÁS CERCANA (Incluso si el evento fue en fin de semana)
                    const velaMatch = encontrarVelaCercana(evento.fecha);
                    
                    if (velaMatch) {
                        localInteractiveMap[velaMatch.time] = { ...evento, fechaReal: evento.fecha };
                        markers.push({ 
                            time: velaMatch.time, 
                            position: 'belowBar', 
                            color: evento.color, 
                            shape: 'square', 
                            text: 'E',
                            size: 2
                        });
                    }
                });
            }

            // --- B) Procesar Noticias (IA) ---
            if (Array.isArray(resN)) {
                resN.forEach(news => {
                    const velaMatch = encontrarVelaCercana(news.fecha);
                    // Solo ponemos noticia si ese día no tiene ya un evento macro (prioridad al evento)
                    if (velaMatch && !localInteractiveMap[velaMatch.time]) {
                        localInteractiveMap[velaMatch.time] = news;
                        markers.push({ 
                            time: velaMatch.time, 
                            position: 'aboveBar', 
                            color: news.color, 
                            shape: 'circle', 
                            text: 'N'
                        });
                    }
                });
            }

            interactiveMapRef.current = localInteractiveMap;
            createSeriesMarkers(candleSeries, markers);
        }
        chart.timeScale().fitContent();
      } catch (e) { 
        if (isMounted) setChartError("Error de sincronización.");
      } finally { 
        if (isMounted) setIsLoading(false); 
      }
    };

    fetchData();
    
    // El "escuchador" de clics en el gráfico
    chart.subscribeClick((p) => {
        const d = p.time ? (typeof p.time === 'string' ? p.time : `${p.time.year}-${String(p.time.month).padStart(2, '0')}-${String(p.time.day).padStart(2, '0')}`) : null;
        setSelectedItem(interactiveMapRef.current[d] || null);
    });

    return () => { isMounted = false; chart.remove(); };
  }, [ticker, timeframe]);

  // --- COMPONENTES AUXILIARES PARA LOS POPUPS ---
  const PopupNoticia = ({ data, onClose }) => (
    <div style={{ position: 'absolute', top: '20px', left: '20px', width: '300px', backgroundColor: '#1E222D', borderLeft: `4px solid ${data.color}`, padding: '15px', zIndex: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
      <div style={{ fontSize: '11px', color: '#787B86', display: 'flex', justifyContent: 'space-between' }}>
        <span>📰 {data.fuente}</span>
        <span style={{ cursor: 'pointer', padding: '0 5px' }} onClick={onClose}>✕</span>
      </div>
      <p style={{ fontWeight: 'bold', fontSize: '14px', margin: '10px 0', lineHeight: '1.4' }}>{data.titulo}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', borderTop: '1px solid #2B2B43', paddingTop: '10px' }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: data.color, backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>Impacto: {data.impacto}</span>
        <a href={data.url} target="_blank" rel="noreferrer" style={{ color: '#d1d4dc', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold' }}>Leer ↗</a>
      </div>
    </div>
  );

  const PopupEventoMacro = ({ data, onClose }) => (
    <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '280px', backgroundColor: '#2a1a1a', border: `1px solid ${data.color}`, borderRadius: '6px', padding: '15px', zIndex: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
      <div style={{ fontSize: '11px', color: '#FF9800', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
        <span>⚠️ EVENTO MACROECONÓMICO (3 TOROS)</span>
        <span style={{ cursor: 'pointer', padding: '0 5px', color: '#d1d4dc' }} onClick={onClose}>✕</span>
      </div>
      <p style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 15px 0', color: 'white' }}>{data.titulo}</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px' }}>
        <div>
          <div style={{ fontSize: '10px', color: '#787B86', textTransform: 'uppercase' }}>Actual</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>{data.actual}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#787B86', textTransform: 'uppercase' }}>Prev</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#d1d4dc' }}>{data.prev}</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: '#787B86', textTransform: 'uppercase' }}>Anterior</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#787B86' }}>{data.ant}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .loader { border: 4px solid #1e222d; border-top: 4px solid #26a69a; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 15px; }`}</style>

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
            <div ref={chartContainerRef} style={{ height: '100%', width: '100%' }} />
            
            {isLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(19, 23, 34, 0.85)', zIndex: 10 }}>
                <div className="loader"></div>
                <h3 style={{ color: '#26a69a', margin: 0, letterSpacing: '2px' }}>DESCARGANDO DATOS...</h3>
              </div>
            )}

            {chartError && !isLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 83, 80, 0.1)', zIndex: 10, padding: '20px', textAlign: 'center' }}>
                <span style={{ fontSize: '40px', marginBottom: '10px' }}>⚠️</span><h3 style={{ color: '#ef5350', margin: 0 }}>Error</h3><p style={{ color: '#d1d4dc' }}>{chartError}</p>
              </div>
            )}

            {/* RENDERIZADO DINÁMICO DEL POPUP SEGÚN EL TIPO DE ITEM CLICKADO */}
            {selectedItem && !isLoading && !chartError && (
              selectedItem.tipo === "noticia" 
                ? <PopupNoticia data={selectedItem} onClose={() => setSelectedItem(null)} />
                : <PopupEventoMacro data={selectedItem} onClose={() => setSelectedItem(null)} />
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