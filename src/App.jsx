import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import EconomicCalendar from "./EconomicCalendar";
import FearAndGreed from "./FearAndGreed";

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  const [ticker, setTicker] = useState('AAPL');
  const [selectedNews, setSelectedNews] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  // ⚠️ TU URL DE RENDER AQUÍ (Sin la barra / al final)
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
    chartContainerRef.current.innerHTML = ''; // Limpiar gráfica anterior

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

    let noticiasEnMapa = {};

    const cargarDatosFull = async () => {
      try {
        // 1. Obtener Precios desde el Backend
        const resP = await fetch(RENDER_URL + "/api/precios/" + ticker);
        const candleData = await resP.json();
        
        if (!isMounted || candleData.error) return;
        candlestickSeries.setData(candleData);

        // 2. Obtener Noticias desde el Backend
        const resN = await fetch(RENDER_URL + "/api/analisis/" + ticker);
        const noticiasData = await resN.json();

        if (noticiasData && isMounted) {
            const marcadores = [];
            Object.keys(noticiasData).forEach(fecha => {
                const n = noticiasData[fecha];
                // Buscamos si la fecha de la noticia existe en el gráfico
                if (candleData.some(d => d.time === fecha)) {
                    noticiasEnMapa[fecha] = n;
                    marcadores.push({
                        time: fecha,
                        position: 'aboveBar',
                        color: n.color,
                        shape: 'circle',
                        text: 'N'
                    });
                }
            });
            createSeriesMarkers(candlestickSeries, marcadores);
        }
        chart.timeScale().fitContent();
      } catch (e) {
        console.error("Fallo de conexión:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    cargarDatosFull();

    // Evento de clic para mostrar la noticia enlazada
    chart.subscribeClick((p) => {
      if (p.time && noticiasEnMapa[p.time]) {
        setSelectedNews(noticiasEnMapa[p.time]);
      } else {
        setSelectedNews(null);
      }
    });

    return () => { isMounted = false; chart.remove(); };
  }, [ticker]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* LADO IZQUIERDO: BUSCADOR Y GRÁFICA */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px' }}>Terminal Pro</span></h2>
            <form onSubmit={manejarBusqueda}>
              <input 
                value={searchInput} 
                onChange={e => setSearchInput(e.target.value)} 
                placeholder="Ej: BTC-USD, SAN.MC..." 
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white', width: '200px' }}
              />
            </form>
          </div>

          <div style={{ position: 'relative', border: '1px solid #2B2B43', borderRadius: '8px', overflow: 'hidden', height: '600px', backgroundColor: '#131722' }}>
            <div ref={chartContainerRef} style={{ height: '100%' }} />
            
            {isLoading && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.8)', padding: '20px', borderRadius: '10px' }}>
                Sincronizando con Servidor...
              </div>
            )}

            {selectedNews && (
               <div style={{ position: 'absolute', top: '20px', right: '20px', width: '280px', backgroundColor: '#1E222D', border: `1px solid ${selectedNews.color}`, borderRadius: '8px', padding: '15px', zIndex: 100, boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
                  <div style={{ fontSize: '11px', color: '#787B86', display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span>NOTICIA VINCULADA</span>
                    <span style={{ cursor: 'pointer' }} onClick={() => setSelectedNews(null)}>✕</span>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px' }}>{selectedNews.titulo}</div>
                  <div style={{ fontSize: '12px', color: '#787B86' }}>Fuente: {selectedNews.publisher}</div>
                  <a href={selectedNews.url} target="_blank" rel="noreferrer" style={{ color: '#2962FF', display: 'block', marginTop: '10px', textDecoration: 'none', fontSize: '13px' }}>Leer más →</a>
                </div>
            )}
          </div>
        </div>

        {/* LADO DERECHO: PANELES LATERALES */}
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