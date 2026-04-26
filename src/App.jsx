import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import EconomicCalendar from "./EconomicCalendar";
import FearAndGreed from "./FearAndGreed";

function App() {
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null); 
  const interactiveMapRef = useRef({}); 
  const dataRef = useRef({ candle: [], news: [], events: [], tweets: [] });
  const seriesRef = useRef({ candle: null, volume: null });
  
  const [ticker, setTicker] = useState(() => new URLSearchParams(window.location.search).get('ticker') || 'AAPL');
  const [timeframe, setTimeframe] = useState('1Y');
  
  const [selectedItem, setSelectedItem] = useState({ noticia: null, evento: null, tweet: null }); 
  const [isLoading, setIsLoading] = useState(true);
  const [chartError, setChartError] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const [marketData, setMarketData] = useState([]);
  const [tickerInfo, setTickerInfo] = useState(null);
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('terminal_favs')) || ['AAPL', 'MSFT', 'TSLA', 'BTC-USD']);
  const [newsFilter, setNewsFilter] = useState('ALL');
  const [crosshairData, setCrosshairData] = useState(null);

  // ⚠️ PON TU URL DE RENDER AQUÍ
  const RENDER_URL = "https://mi-terminal-backend.onrender.com"; 

  useEffect(() => {
    fetch(`${RENDER_URL}/api/mercado`).then(r => r.json()).then(d => setMarketData(d)).catch(() => {});
  }, []);

  useEffect(() => {
    window.history.replaceState(null, '', `?ticker=${ticker}`);
  }, [ticker]);

  const toggleFavorite = () => {
    let favs = [...favorites];
    if (favs.includes(ticker)) favs = favs.filter(t => t !== ticker);
    else favs.push(ticker);
    setFavorites(favs);
    localStorage.setItem('terminal_favs', JSON.stringify(favs));
  };

  const manejarBusqueda = async (e) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (query) {
        setIsLoading(true);
        try {
            const res = await fetch(`${RENDER_URL}/api/buscar/${query}`);
            const data = await res.json();
            setTicker(data.ticker);
        } catch {
            setTicker(query.toUpperCase());
        }
        setSearchInput('');
        setSelectedItem({ noticia: null, evento: null, tweet: null });
    }
  };

  const aplicarMarcadores = (filtro) => {
    const { candle, news, events, tweets } = dataRef.current;
    if (!seriesRef.current.candle || !seriesRef.current.volume || !candle.length) return;

    const candleMarkers = [];
    const volumeMarkers = [];
    const localMap = {};

    const encontrarVela = (f) => candle.reduce((p, c) => (Math.abs(new Date(c.time) - new Date(f)) < Math.abs(new Date(p.time) - new Date(f)) ? c : p));

    // EVENTOS MACRO (Abajo)
    if (Array.isArray(events)) {
        events.forEach(e => {
            const v = encontrarVela(e.fecha);
            if (v) {
                if (!localMap[v.time]) localMap[v.time] = { noticia: null, evento: null, tweet: null };
                localMap[v.time].evento = e;
                volumeMarkers.push({ time: v.time, position: 'belowBar', color: e.color || '#FF9800', shape: 'square', text: 'E', size: 1 });
            }
        });
    }

    // TWEETS SOCIALES (Arriba)
    if (Array.isArray(tweets)) {
        tweets.forEach(t => {
            if (filtro === 'ALCISTA' && t.impacto !== 'Alcista') return;
            if (filtro === 'BAJISTA' && t.impacto !== 'Bajista') return;
            if (filtro === 'NEUTRAL' && t.impacto !== 'Neutral') return;
            const v = encontrarVela(t.fecha);
            if (v) {
                if (!localMap[v.time]) localMap[v.time] = { noticia: null, evento: null, tweet: null };
                if (!localMap[v.time].tweet) {
                    localMap[v.time].tweet = t;
                    candleMarkers.push({ time: v.time, position: 'aboveBar', color: t.color, shape: 'circle', text: 'T', size: 1 });
                }
            }
        });
    }

    // NOTICIAS (Arriba)
    if (Array.isArray(news)) {
        news.forEach(n => {
            if (filtro === 'ALCISTA' && n.impacto !== 'Alcista') return;
            if (filtro === 'BAJISTA' && n.impacto !== 'Bajista') return;
            if (filtro === 'NEUTRAL' && n.impacto !== 'Neutral') return;
            const v = encontrarVela(n.fecha);
            if (v) {
                if (!localMap[v.time]) localMap[v.time] = { noticia: null, evento: null, tweet: null };
                if (!localMap[v.time].noticia) {
                    localMap[v.time].noticia = n;
                    candleMarkers.push({ time: v.time, position: 'aboveBar', color: n.color, shape: 'circle', text: 'N', size: 1 });
                }
            }
        });
    }

    // MAX Y MIN
    let max = -Infinity, min = Infinity, maxTime, minTime;
    candle.forEach(d => {
        if (d.high > max) { max = d.high; maxTime = d.time; }
        if (d.low < min) { min = d.low; minTime = d.time; }
    });
    if (maxTime) candleMarkers.push({ time: maxTime, position: 'aboveBar', color: '#787B86', shape: 'arrowDown', text: `Máx ${max.toFixed(2)}`, size: 1 });
    if (minTime) candleMarkers.push({ time: minTime, position: 'belowBar', color: '#787B86', shape: 'arrowUp', text: `Mín ${min.toFixed(2)}`, size: 1 });

    interactiveMapRef.current = localMap;
    candleMarkers.sort((a, b) => new Date(a.time) - new Date(b.time));
    volumeMarkers.sort((a, b) => new Date(a.time) - new Date(b.time));
    createSeriesMarkers(seriesRef.current.candle, candleMarkers);
    createSeriesMarkers(seriesRef.current.volume, volumeMarkers);
  };

  useEffect(() => { aplicarMarcadores(newsFilter); }, [newsFilter]);

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
      crosshair: { mode: 0 },
      watermark: { visible: true, fontSize: 120, horzAlign: 'center', vertAlign: 'center', color: 'rgba(255, 255, 255, 0.03)', text: ticker },
    });
    chartInstance.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, { upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
    candleSeries.applyOptions({ lastValueVisible: true, priceLineVisible: true });

    const volumeSeries = chart.addSeries(HistogramSeries, { color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    seriesRef.current = { candle: candleSeries, volume: volumeSeries };

    const fetchData = async () => {
      try {
        const resP = await fetch(`${RENDER_URL}/api/precios/${ticker}?timeframe=${timeframe.toLowerCase()}`);
        const candleData = await resP.json();
        
        if (candleData.error) { if (isMounted) setChartError(candleData.error); return; }
        if (!isMounted || !Array.isArray(candleData) || candleData.length === 0) { if (isMounted) setChartError("Sin datos."); return; }
        
        candleSeries.setData(candleData);
        volumeSeries.setData(candleData.map(d => ({ time: d.time, value: d.value || 0, color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)' })));

        // Carga cuádruple: Noticias, Eventos, Info y TWEETS SOCIALES
        const [resN, resE, resInfo, resT] = await Promise.all([
          fetch(`${RENDER_URL}/api/analisis/${ticker}`).then(r => r.json()),
          fetch(`${RENDER_URL}/api/eventos_macro`).then(r => r.json()),
          fetch(`${RENDER_URL}/api/info/${ticker}`).then(r => r.json()),
          fetch(`${RENDER_URL}/api/social/${ticker}`).then(r => r.json())
        ]);

        if (isMounted) {
            dataRef.current = { candle: candleData, news: resN, events: resE, tweets: resT };
            setTickerInfo(resInfo);
            aplicarMarcadores(newsFilter);
        }
        chart.timeScale().fitContent();
      } catch (e) { 
        if (isMounted) setChartError("Fallo de conexión."); 
      } finally { 
        if (isMounted) setIsLoading(false); 
      }
    };

    fetchData();
    
    chart.subscribeClick((p) => {
        const d = p.time ? (typeof p.time === 'string' ? p.time : `${p.time.year}-${String(p.time.month).padStart(2, '0')}-${String(p.time.day).padStart(2, '0')}`) : null;
        if (d && interactiveMapRef.current[d]) setSelectedItem(interactiveMapRef.current[d]);
        else setSelectedItem({ noticia: null, evento: null, tweet: null });
    });

    chart.subscribeCrosshairMove((param) => {
        if (param.time && param.seriesData.get(seriesRef.current.candle)) setCrosshairData(param.seriesData.get(seriesRef.current.candle));
        else setCrosshairData(null);
    });

    return () => { isMounted = false; chart.remove(); };
  }, [ticker, timeframe]);

  // Componentes de Tarjetas
  const PopupNoticia = ({ data, onClose }) => (
    <div style={{ position: 'absolute', top: '50px', left: '20px', width: '300px', backgroundColor: '#1E222D', borderLeft: `4px solid ${data.color}`, padding: '15px', zIndex: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}><div style={{ fontSize: '11px', color: '#787B86', display: 'flex', justifyContent: 'space-between' }}><span>📰 {data.fuente}</span><span style={{ cursor: 'pointer', padding: '0 5px' }} onClick={onClose}>✕</span></div><p style={{ fontWeight: 'bold', fontSize: '14px', margin: '10px 0', lineHeight: '1.4' }}>{data.titulo}</p><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px', borderTop: '1px solid #2B2B43', paddingTop: '10px' }}><span style={{ fontSize: '12px', fontWeight: 'bold', color: data.color, backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>Impacto: {data.impacto}</span><a href={data.url} target="_blank" rel="noreferrer" style={{ color: '#d1d4dc', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold' }}>Leer ↗</a></div></div>
  );
  
  const PopupEventoMacro = ({ data, onClose }) => (
    <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '280px', backgroundColor: '#2a1a1a', border: `1px solid ${data.color}`, borderRadius: '6px', padding: '15px', zIndex: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}><div style={{ fontSize: '11px', color: '#FF9800', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}><span>⚠️ EVENTO MACRO (3 TOROS)</span><span style={{ cursor: 'pointer', padding: '0 5px', color: '#d1d4dc' }} onClick={onClose}>✕</span></div><p style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 15px 0', color: 'white' }}>{data.titulo}</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px' }}><div><div style={{ fontSize: '10px', color: '#787B86', textTransform: 'uppercase' }}>Actual</div><div style={{ fontSize: '14px', fontWeight: 'bold', color: 'white' }}>{data.actual}</div></div><div><div style={{ fontSize: '10px', color: '#787B86', textTransform: 'uppercase' }}>Prev</div><div style={{ fontSize: '14px', fontWeight: 'bold', color: '#d1d4dc' }}>{data.prev}</div></div><div><div style={{ fontSize: '10px', color: '#787B86', textTransform: 'uppercase' }}>Anterior</div><div style={{ fontSize: '14px', fontWeight: 'bold', color: '#787B86' }}>{data.ant}</div></div></div></div>
  );

  const PopupTweet = ({ data, onClose }) => (
    <div style={{ position: 'absolute', top: '50px', right: '20px', width: '280px', backgroundColor: '#15202B', borderLeft: `4px solid ${data.color}`, borderRadius: '8px', padding: '15px', zIndex: 25, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ color: '#1DA1F2', fontWeight: 'bold', fontSize: '13px' }}>💬 {data.usuario}</span>
        <span style={{ cursor: 'pointer', color: '#787B86' }} onClick={onClose}>✕</span>
      </div>
      <p style={{ fontSize: '14px', color: 'white', lineHeight: '1.4', margin: '0 0 15px 0' }}>{data.texto}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #38444d', paddingTop: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: data.color }}>SENTIMIENTO: {data.impacto.toUpperCase()}</span>
        <a href={data.url} target="_blank" rel="noreferrer" style={{ color: '#1DA1F2', textDecoration: 'none', fontSize: '12px', fontWeight: 'bold' }}>Ver ↗</a>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#0c0d10', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif', paddingBottom: '20px' }}>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } 
        .loader { border: 4px solid #1e222d; border-top: 4px solid #26a69a; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 15px; }
        .ticker-tape { overflow: hidden; background: #1E222D; padding: 10px 0; border-bottom: 1px solid #2B2B43; font-size: 13px; font-weight: bold; margin-bottom: 20px;}
        .ticker-tape-content { display: inline-block; white-space: nowrap; animation: scroll 25s linear infinite; padding-left: 100%; }
        .ticker-item { display: inline-block; margin-right: 50px; }
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        @keyframes pulse { 0% {opacity: 0.5;} 50% {opacity: 1;} 100% {opacity: 0.5;} }
        .skeleton { animation: pulse 1.5s infinite; background: #1E222D; border-radius: 8px; width: 100%; height: 100%; min-height: 200px; border: 1px solid #2B2B43;}
      `}</style>

      {marketData.length > 0 && (
        <div className="ticker-tape">
          <div className="ticker-tape-content">
            {marketData.map((m, i) => (
              <span key={i} className="ticker-item" style={{ color: m.cambio_pct >= 0 ? '#26a69a' : '#ef5350' }}>
                {m.nombre}: ${m.precio.toFixed(2)} ({m.cambio_pct > 0 ? '+' : ''}{m.cambio_pct.toFixed(2)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', maxWidth: '1400px', margin: '0 auto', alignItems: 'stretch', padding: '0 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
            <div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '28px' }}>
                {ticker} 
                <span style={{ cursor: 'pointer', color: favorites.includes(ticker) ? '#FFD700' : '#787B86', fontSize: '22px' }} onClick={toggleFavorite}>
                  {favorites.includes(ticker) ? '★' : '☆'}
                </span>
              </h2>
              {tickerInfo && (
                <div style={{ marginTop: '5px', fontSize: '13px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '18px', marginRight: '10px' }}>${tickerInfo.precio.toFixed(2)}</span>
                  <span style={{ color: tickerInfo.cambio_pct >= 0 ? '#26a69a' : '#ef5350', fontWeight: 'bold', marginRight: '15px' }}>
                    {tickerInfo.cambio_pct >= 0 ? '▲' : '▼'} {tickerInfo.cambio_pct.toFixed(2)}%
                  </span>
                  <span style={{ color: '#787B86' }}>{tickerInfo.sector} • {tickerInfo.industria}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
              <form onSubmit={manejarBusqueda}>
                <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Ej: Santander, Inditex..." style={{ padding: '10px', borderRadius: '6px', border: '1px solid #2B2B43', backgroundColor: '#1E222D', color: 'white', width: '200px' }} />
              </form>
              <div style={{ display: 'flex', gap: '5px' }}>
                {favorites.map(f => (
                  <span key={f} onClick={() => setTicker(f)} style={{ cursor: 'pointer', padding: '3px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '11px', color: '#d1d4dc', border: '1px solid #2B2B43' }}>{f}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', backgroundColor: '#1E222D', padding: '10px', borderRadius: '8px', border: '1px solid #2B2B43' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['1M', '6M', '1Y', 'MAX'].map(t => (
                <button key={t} onClick={() => setTimeframe(t)} style={{ padding: '6px 12px', backgroundColor: timeframe === t ? '#26a69a' : 'transparent', color: timeframe === t ? 'white' : '#d1d4dc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{t}</button>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '5px', fontSize: '12px' }}>
              <span style={{ color: '#787B86', alignSelf: 'center', marginRight: '5px', fontWeight: 'bold' }}>FILTRO IA:</span>
              {['ALL', 'ALCISTA', 'BAJISTA', 'NEUTRAL'].map(f => (
                <button key={f} onClick={() => setNewsFilter(f)} style={{ padding: '4px 10px', backgroundColor: newsFilter === f ? '#2962FF' : 'rgba(255,255,255,0.05)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{f}</button>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', border: '1px solid #2B2B43', borderRadius: '8px', overflow: 'hidden', flexGrow: 1, minHeight: '600px', backgroundColor: '#131722' }}>
            
            {crosshairData && (
              <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, display: 'flex', gap: '15px', fontSize: '12px', color: '#787B86', backgroundColor: 'rgba(19, 23, 34, 0.7)', padding: '5px 10px', borderRadius: '4px' }}>
                <span>O <b style={{color: 'white'}}>{crosshairData.open.toFixed(2)}</b></span>
                <span>H <b style={{color: 'white'}}>{crosshairData.high.toFixed(2)}</b></span>
                <span>L <b style={{color: 'white'}}>{crosshairData.low.toFixed(2)}</b></span>
                <span>C <b style={{color: 'white'}}>{crosshairData.close.toFixed(2)}</b></span>
              </div>
            )}

            <div ref={chartContainerRef} style={{ height: '100%', width: '100%' }} />
            
            {isLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(19, 23, 34, 0.85)', zIndex: 10 }}>
                <div className="loader"></div><h3 style={{ color: '#26a69a', margin: 0, letterSpacing: '2px' }}>Sincronizando...</h3>
              </div>
            )}

            {chartError && !isLoading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 83, 80, 0.1)', zIndex: 10, padding: '20px', textAlign: 'center' }}>
                <span style={{ fontSize: '40px', marginBottom: '10px' }}>⚠️</span><h3 style={{ color: '#ef5350', margin: 0 }}>Error</h3><p style={{ color: '#d1d4dc' }}>{chartError}</p>
              </div>
            )}

            {selectedItem?.noticia && <PopupNoticia data={selectedItem.noticia} onClose={() => setSelectedItem(prev => ({ ...prev, noticia: null }))} />}
            {selectedItem?.tweet && <PopupTweet data={selectedItem.tweet} onClose={() => setSelectedItem(prev => ({ ...prev, tweet: null }))} />}
            {selectedItem?.evento && <PopupEventoMacro data={selectedItem.evento} onClose={() => setSelectedItem(prev => ({ ...prev, evento: null }))} />}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {isLoading ? <div className="skeleton" style={{ flex: 1 }}></div> : <div style={{ flex: 1, backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px', overflow: 'hidden' }}><EconomicCalendar /></div>}
          {isLoading ? <div className="skeleton" style={{ flex: 1 }}></div> : <div style={{ flex: 1, backgroundColor: '#131722', borderRadius: '8px', border: '1px solid #2B2B43', padding: '15px', overflow: 'hidden' }}><FearAndGreed /></div>}
        </div>
      </div>
    </div>
  );
}
export default App;