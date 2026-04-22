import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
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
  const [lang, setLang] = useState('es');

  const ejecutarBusquedaInteligente = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setIsLoading(true);
    try {
        const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchInput)}`);
        const data = await res.json();

        if (data.quotes && data.quotes.length > 0) {
            setTicker(data.quotes[0].symbol);
        } else {
            alert("No se encontró ninguna empresa o activo con ese nombre.");
            setIsLoading(false);
        }
    } catch (error) {
        setTicker(searchInput.toUpperCase());
    }
    setSearchInput('');
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
      height: chartContainerRef.current.clientHeight || 600,
      crosshair: { mode: 0 }
    });
    
    chartInstance.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });

    chart.priceScale('').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    let noticiasAsignadas = {};

    const fetchData = async () => {
      try {
        let range = '1y';
        if (timeframe === '1M') range = '1mo';
        else if (timeframe === '6M') range = '6mo';
        else if (timeframe === '1Y') range = '1y';
        else if (timeframe === '5Y') range = '5y';
        else if (timeframe === 'MAX') range = 'max';

        const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d');
        const json = await res.json();
        
        if (!isMounted) return; 

        if (!json.chart || !json.chart.result) {
            alert(`Símbolo no válido o sin datos: ${ticker}`);
            setIsLoading(false);
            return;
        }

        const result = json.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        const candleData = [];
        const volumeData = [];

        timestamps.forEach((t, i) => {
          if (quotes.open[i] !== null) {
            const date = new Date(t * 1000).toISOString().split('T')[0];
            candleData.push({ time: date, open: quotes.open[i], high: quotes.high[i], low: quotes.low[i], close: quotes.close[i] });
            volumeData.push({ time: date, value: quotes.volume[i], color: quotes.close[i] >= quotes.open[i] ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)' });
          }
        });

        // BLINDAJE ANTICAÍDAS: Validar que la gráfica existe antes de dibujar
        try {
            if (chartInstance.current) {
                candlestickSeries.setData(candleData);
                volumeSeries.setData(volumeData);
            }
        } catch (err) {
            console.warn("Se ignoró un render porque la gráfica cambió rápidamente.");
            return;
        }

        const resNews = await fetch(`https://mi-terminal-backend.onrender.com`);
        const noticiasIA = await resNews.json();

        if (!isMounted || !chartInstance.current) return;

        if (noticiasIA && !noticiasIA.error) {
            const marcadores = [];
            Object.keys(noticiasIA).forEach(fecha => {
                const noticia = noticiasIA[fecha];
                let fechaFinal = null;
                for (let i = candleData.length - 1; i >= 0; i--) {
                    if (candleData[i].time <= fecha) {
                        fechaFinal = candleData[i].time;
                        break;
                    }
                }

                if (fechaFinal && !noticiasAsignadas[fechaFinal]) {
                    noticiasAsignadas[fechaFinal] = { ...noticia, date: fecha };
                    marcadores.push({
                        time: fechaFinal,
                        position: noticia.impact === 'Alcista' ? 'belowBar' : 'aboveBar',
                        color: noticia.color,
                        shape: noticia.impact === 'Alcista' ? 'arrowUp' : (noticia.impact === 'Bajista' ? 'arrowDown' : 'circle'),
                        text: 'N',
                        size: 2
                    });
                }
            });
            
            try {
                marcadores.sort((a,b) => new Date(a.time) - new Date(b.time));
                createSeriesMarkers(candlestickSeries, marcadores);
                chart.timeScale().fitContent();
            } catch (e) {
                console.warn("Marcadores ignorados por limpieza de gráfica.");
            }
        }

      } catch (e) {
        console.error("Error cargando datos:", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    chart.subscribeClick((param) => {
        if (param.time && noticiasAsignadas[param.time]) {
            setSelectedNews(noticiasAsignadas[param.time]);
        } else {
            setSelectedNews(null);
        }
    });

    const handleResize = () => {
        if (chartInstance.current && chartContainerRef.current) {
            chartInstance.current.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
        }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
        isMounted = false; 
        window.removeEventListener('resize', handleResize);
        if (chartInstance.current) {
            chartInstance.current.remove();
            chartInstance.current = null;
        }
    };
  }, [ticker, timeframe]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto', height: 'calc(100vh - 40px)' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px', fontWeight: 'normal' }}>Terminal Inteligente</span></h2>
            
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div style={{ display: 'flex', backgroundColor: '#1E222D', borderRadius: '6px', padding: '2px' }}>
                  <button onClick={() => setLang('es')} style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', backgroundColor: lang === 'es' ? '#2962FF' : 'transparent', color: 'white', transition: '0.3s' }}>ES</button>
                  <button onClick={() => setLang('en')} style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', backgroundColor: lang === 'en' ? '#2962FF' : 'transparent', color: 'white', transition: '0.3s' }}>EN</button>
              </div>

              <form onSubmit={ejecutarBusquedaInteligente}>
                  <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Empresa o Símbolo..." style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white', outline: 'none' }} />
              </form>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {['1M', '6M', '1Y', '5Y', 'MAX'].map(t => (
                <button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#2962FF' : '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{t}</button>
            ))}
          </div>

          <div style={{ position: 'relative', flexGrow: 1 }}>
            <div ref={chartContainerRef} style={{ height: '100%', borderRadius: '8px', border: '1px solid #2B2B43', overflow: 'hidden' }} />
            
            {isLoading && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#26a69a', backgroundColor: 'rgba(19, 23, 34, 0.8)', padding: '20px', borderRadius: '10px', zIndex: 5 }}>Analizando mercado...</div>
            )}

            {selectedNews && (
               <div style={{ position: 'absolute', top: '20px', right: '20px', width: '300px', backgroundColor: 'rgba(30, 34, 45, 0.98)', border: `1px solid ${selectedNews.color}`, borderRadius: '8px', padding: '15px', zIndex: 100, backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.8)'}}>
                  <div style={{ fontSize: '11px', color: '#787B86', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{selectedNews.date} | {selectedNews.source}</span>
                    <span style={{ cursor: 'pointer', fontSize: '16px' }} onClick={() => setSelectedNews(null)}>✕</span>
                  </div>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '15px', lineHeight: '1.3' }}>{selectedNews[lang].title}</div>
                  <div style={{ fontSize: '13px', color: '#D1D4DC', marginBottom: '15px', lineHeight: '1.4' }}>{selectedNews[lang].body}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2B2B43', paddingTop: '10px' }}>
                    <div style={{ fontSize: '11px', color: selectedNews.color, fontWeight: 'bold' }}>{lang === 'es' ? 'SENTIMIENTO:' : 'SENTIMENT:'} {selectedNews.impact}</div>
                    {selectedNews.url && (<a href={selectedNews.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2962FF', fontSize: '12px', textDecoration: 'none', fontWeight: 'bold' }}>{lang === 'es' ? 'Ver original →' : 'View original →'}</a>)}
                  </div>
                </div>
            )}
          </div>
        </div>

        <div style={{ backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px', height: '100%', display: 'flex', flexDirection: 'column' }}>
           <div style={{ flexGrow: 1, minHeight: '400px' }}>
              <EconomicCalendar />
           </div>
           <FearAndGreed />
        </div>

      </div>
    </div>
  );
}

export default App;