import { useEffect, useState, memo } from 'react';

const FearAndGreed = () => {
  // ⚠️ PON TU URL DE RENDER AQUÍ (Sin barra al final)
  const RENDER_URL = "https://mi-terminal-backend.onrender.com"; 
  
  const [cryptoData, setCryptoData] = useState({ value: 50, label: 'Cargando...' });
  const [stockData, setStockData] = useState({ value: 50, label: 'Cargando...' });

  useEffect(() => {
    const fetchCrypto = async () => {
      try {
        const res = await fetch('https://api.alternative.me/fng/');
        const json = await res.json();
        if (json && json.data && json.data[0]) {
          setCryptoData({ value: parseInt(json.data[0].value), label: json.data[0].value_classification });
        }
      } catch (error) {
        console.error("Error Crypto:", error);
      }
    };

    const fetchStock = async () => {
      try {
        const res = await fetch(`${RENDER_URL}/api/feargreed`);
        const json = await res.json();
        if (json && json.value) {
          setStockData({ value: json.value, label: json.label });
        }
      } catch (error) {
        setStockData({ value: 50, label: 'Neutral (Error)' });
      }
    };

    fetchCrypto();
    fetchStock();
  }, [RENDER_URL]);

  const getLabelEs = (label) => {
    const map = { 'Extreme Fear': 'Miedo Extremo', 'Fear': 'Miedo', 'Neutral': 'Neutral', 'Greed': 'Codicia', 'Extreme Greed': 'Codicia Extrema' };
    return map[label] || label;
  };

  const GaugeBar = ({ title, data }) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d1d4dc' }}>{title}</span>
        <span style={{ fontSize: '13px', color: '#787B86', fontWeight: 'bold' }}>{data.value}/100</span>
      </div>
      <div style={{ position: 'relative', height: '10px', borderRadius: '5px', background: 'linear-gradient(to right, #ef5350, #ff9800, #FFD700, #8bc34a, #26a69a)', marginBottom: '8px' }}>
        <div style={{ position: 'absolute', top: '-4px', left: `calc(${data.value}% - 2px)`, width: '4px', height: '18px', backgroundColor: '#ffffff', borderRadius: '2px', boxShadow: '0 0 5px rgba(0,0,0,0.8)', transition: 'left 1.5s ease-in-out' }} />
      </div>
      <div style={{ textAlign: 'center', fontSize: '11px', color: '#D1D4DC', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {getLabelEs(data.label)}
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#d1d4dc', borderBottom: '1px solid #2B2B43', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🧭</span> Índice Fear & Greed
      </h3>
      <GaugeBar title="S&P 500 (Bolsa USA)" data={stockData} />
      <GaugeBar title="Mercado Cripto" data={cryptoData} />
    </div>
  );
};

export default memo(FearAndGreed);