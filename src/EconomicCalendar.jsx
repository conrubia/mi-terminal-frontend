import { useEffect, useRef, memo } from 'react';

const EconomicCalendar = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    // Evitamos inyectar el script más de una vez si React se recarga
    if (containerRef.current && containerRef.current.children.length === 0) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        colorTheme: 'dark',
        isTransparent: true,
        width: '100%',
        height: '100%',
        locale: 'es',
        importanceFilter: '-1,0,1', // Muestra todas las importancias (baja, media, alta)
        currencyFilter: 'USD,EUR,GBP,JPY,AUD,CAD,CHF,CNY' // Principales divisas mundiales
      });
      containerRef.current.appendChild(script);
    }
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#d1d4dc', borderBottom: '1px solid #2B2B43', paddingBottom: '10px' }}>
        📅 Calendario Macroeconómico
      </h3>
      <div 
        ref={containerRef} 
        style={{ flexGrow: 1, width: '100%', overflow: 'hidden', borderRadius: '8px' }} 
      />
    </div>
  );
};

// Usamos memo para que este panel no se recargue innecesariamente cuando busques un Ticker nuevo
export default memo(EconomicCalendar);