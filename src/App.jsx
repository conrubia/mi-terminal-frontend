import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
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
  const [lang, setLang] = useState('es');

  // --- BUSCADOR INTELIGENTE ---
  const ejecutarBusquedaInteligente = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setIsLoading(true);
    try {
        const queryUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${searchInput}`;
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(queryUrl)}`);
        const json = await res.json();
        const data = JSON.parse(json.contents);
        if (data.quotes && data.quotes.length > 0) {
            setTicker(data.quotes[0].symbol);
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

    let noticiasAsignadas = {};

    const fetchData = async () => {
      try {
        let range = timeframe === '1M' ? '1mo' : timeframe === '6M' ? '6mo' : timeframe === '1Y' ? '1y' : timeframe === '5Y' ? '5y' : 'max';
        
        // 1. FETCH DE DATOS CON PROXY ROBUSTO
        const urlYahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(urlYahoo)}`);
        const wrapper = await res.json();
        const json = JSON.parse(wrapper.contents);
        
        if (!isMounted || !json.chart.result) return;
        const result = json.chart.result[0];
        const candleData = result.timestamp.map((t, i) => ({
          time: new Date(t * 1000).toISOString().split('T')[0],
          open: result.indicators.quote[0].open[i],
          high: result.indicators.quote[0].high[i],
          low: result.indicators.quote[0].low[i],
          close: result.indicators.quote[0].close[i]
        })).filter(d => d.open !== null);

        candlestickSeries.setData(candleData);

        // 2. FETCH DE NOTICIAS (RENDER)
        // ⚠️ CAMBIA ESTA URL POR LA TUYA DE RENDER ⚠️
        const urlRender = `https://mi-terminal-backend.onrender.com//api/analisis/${ticker}`; 
        
        const resNews = await fetch(urlRender);
        const noticiasIA = await resNews.json();

        if (noticiasIA && !noticiasIA.error && isMounted) {
            const marcadores = [];
            Object.keys(noticiasIA).forEach(fecha => {
                const noticia = noticiasIA[fecha];
                let fechaFinal = null;
                for (let i = candleData.length - 1; i >= 0; i--) {
                  if (candleData[i].time <= fecha) { fechaFinal = candleData[i].time; break; }
                }
                if (fechaFinal && !noticiasAsignadas[fechaFinal]) {
                    noticiasAsignadas[fechaFinal] = { ...noticia, date: fecha };
                    marcadores.push({
                        time: fechaFinal, 
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
      } catch (e) { 
        console.error("Error:", e); 
      } finally { 
        if (isMounted) setIsLoading(false); 
      }
    };

    fetchData();
    chart.subscribeClick((p) => { if (p.time && noticiasAsignadas[p.time]) setSelectedNews(noticiasAsignadas[p.time]); else setSelectedNews(null); });
    
    return () => { 
      isMounted = false; 
      chart.remove();
    };
  }, [ticker, timeframe]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>{ticker} <span style={{ color: '#787B86', fontSize: '14px' }}>Terminal</span></h2>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')} style={{ padding: '5px 10px', backgroundColor: '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{lang.toUpperCase()}</button>
              <form onSubmit={ejecutarBusquedaInteligente}><input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Buscar activo..." style={{ padding: '8px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white' }} /></form>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
            {['1M', '6M', '1Y', '5Y', 'MAX'].map(t => <button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#2962FF' : '#1E222D', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{t}</button>)}
          </div>
          <div style={{ position: 'relative', height: '600px' }}>
            <div ref={chartContainerRef} style={{ height: '100%', borderRadius: '8px', border: '1px solid #2B2B43', overflow: 'hidden' }} />
            {isLoading && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#26a69a' }}>Cargando mercados...</div>}
            {selectedNews && (
               <div style={{ position: 'absolute', top: '20px', right: '20px', width: '300px', backgroundColor: 'rgba(30, 34, 45, 0.98)', border: `1px solid ${selectedNews.color}`, borderRadius: '8px', padding: '15px', zIndex: 100 }}>
                  <div style={{ fontSize: '11px', color: '#787B86', display: 'flex', justifyContent: 'space-between' }}><span>{selectedNews.date}</span><span style={{ cursor: 'pointer' }} onClick={() => setSelectedNews(null)}>✕</span></div>
                  <div style={{ fontWeight: 'bold', margin: '10px 0' }}>{selectedNews[lang].title}</div>
                  <div style={{ fontSize: '13px', color: '#D1D4DC' }}>{selectedNews[lang].body}</div>
                  <a href={selectedNews.url} target="_blank" rel="noreferrer" style={{ color: '#2962FF', display: 'block', marginTop: '10px', textDecoration: 'none', fontSize: '12px' }}>Leer original →</a>
                </div>
            )}
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