import { useEffect, useState, memo } from 'react';

const FearAndGreed = () => {
  const [cryptoData, setCryptoData] = useState({ value: 50, label: 'Cargando...' });
  const [stockData, setStockData] = useState({ value: 50, label: 'Cargando...' });

  useEffect(() => {
    // 1. Obtener datos del Mercado Crypto (API nativa y libre)
    const fetchCrypto = async () => {
      try {
        const res = await fetch('https://api.alternative.me/fng/');
        const json = await res.json();
        if (json && json.data && json.data[0]) {
          setCryptoData({
            value: parseInt(json.data[0].value),
            label: json.data[0].value_classification
          });
        }
      } catch (error) {
        console.error("Error Crypto F&G:", error);
      }
    };

    // 2. Obtener datos de la Bolsa USA (CNN a través de proxy)
    const fetchStock = async () => {
      try {
        const res = await fetch('https://corsproxy.io/?https://production.dataviz.cnn.io/index/fearandgreed/graphdata');
        const json = await res.json();
        if (json && json.fear_and_greed) {
          setStockData({
            value: Math.round(json.fear_and_greed.score),
            label: json.fear_and_greed.rating
          });
        }
      } catch (error) {
        console.error("Error Stock F&G:", error);
        // Fallback por si CNN cambia su seguridad temporalmente
        setStockData({ value: 50, label: 'Neutral (Estimado)' });
      }
    };

    fetchCrypto();
    fetchStock();
  }, []);

  // Traductor interno de etiquetas
  const getLabelEs = (label) => {
    const map = {
      'Extreme Fear': 'Miedo Extremo',
      'Fear': 'Miedo',
      'Neutral': 'Neutral',
      'Greed': 'Codicia',
      'Extreme Greed': 'Codicia Extrema'
    };
    return map[label] || label;
  };

  // Sub-componente visual de la barra de medición
  const GaugeBar = ({ title, data }) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#d1d4dc' }}>{title}</span>
        <span style={{ fontSize: '13px', color: '#787B86', fontWeight: 'bold' }}>{data.value}/100</span>
      </div>
      
      {/* Barra de Gradiente de Colores */}
      <div style={{ 
        position: 'relative', 
        height: '10px', 
        borderRadius: '5px', 
        background: 'linear-gradient(to right, #ef5350, #ff9800, #FFD700, #8bc34a, #26a69a)', 
        marginBottom: '8px' 
      }}>
        {/* Aguja / Marcador */}
        <div style={{
          position: 'absolute',
          top: '-4px',
          left: `calc(${data.value}% - 2px)`,
          width: '4px',
          height: '18px',
          backgroundColor: '#ffffff',
          borderRadius: '2px',
          boxShadow: '0 0 5px rgba(0,0,0,0.8)',
          transition: 'left 1.5s ease-in-out' // Animación suave al cargar
        }} />
      </div>
      <div style={{ textAlign: 'center', fontSize: '11px', color: '#D1D4DC', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {getLabelEs(data.label)}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '15px', backgroundColor: '#1E222D', borderRadius: '8px', border: '1px solid #2B2B43', marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#d1d4dc', borderBottom: '1px solid #2B2B43', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🧭</span> Índice Fear & Greed
      </h3>
      <GaugeBar title="S&P 500 (Bolsa USA)" data={stockData} />
      <GaugeBar title="Mercado Cripto" data={cryptoData} />
    </div>
  );
};

export default memo(FearAndGreed);