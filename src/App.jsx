import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  const [ticker, setTicker] = useState('AAPL');
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  
  // ⚠️ CAMBIA ESTO: Pon la URL de tu servicio en Render (sin la barra / al final)
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

    // Creamos la gráfica
    const chart = createChart(chartContainerRef.current, {
      layout: { background: { type: 'solid', color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });
    chartInstance.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    const cargarTodo = async () => {
      try {
        // 1. Cargamos Precios desde nuestro Backend
        const resPrecios = await fetch(RENDER_URL + "/api/precios/" + ticker);
        const candleData = await resPrecios.json();
        
        if (!isMounted || candleData.error) {
            console.error("Error en precios:", candleData.error);
            return;
        }
        candlestickSeries.setData(candleData);

        // 2. Cargamos Noticias desde nuestro Backend
        const resNews = await fetch(RENDER_URL + "/api/analisis/" + ticker);
        const noticiasIA = await resNews.json();

        if (noticiasIA && isMounted) {
            const marcadores = [];
            Object.keys(noticiasIA).forEach(fecha => {
                const n = noticiasIA[fecha];
                // Buscamos si existe esa fecha en los datos del gráfico
                const existeFecha = candleData.some(d => d.time === fecha);
                if (existeFecha) {
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
      } catch (err) {
        console.error("Error de conexión:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    cargarTodo();

    return () => { 
      isMounted = false; 
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
    };
  }, [ticker]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Terminal: {ticker}</h2>
          <form onSubmit={manejarBusqueda}>
            <input 
              value={searchInput} 
              onChange={e => setSearchInput(e.target.value)} 
              placeholder="Ej: SAN.MC, BTC-USD..." 
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white', width: '200px' }}
            />
          </form>
        </div>

        <div style={{ position: 'relative', border: '1px solid #2B2B43', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#131722' }}>
          <div ref={chartContainerRef} />
          {isLoading && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'rgba(0,0,0,0.7)', padding: '20px', borderRadius: '10px' }}>
              Solicitando datos a Render...
            </div>
          )}
        </div>
        <p style={{ color: '#787B86', fontSize: '12px', marginTop: '10px' }}>
          Tip: Si el gráfico no carga, espera 30s a que el servidor de Render "despierte".
        </p>
      </div>
    </div>
  );
}

export default App;