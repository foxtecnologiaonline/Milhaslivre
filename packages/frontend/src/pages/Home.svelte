<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import QuotationForm from '../components/QuotationForm.svelte';

  const dispatch = createEventDispatcher();

  function handleGetQuote() {
    dispatch('navigate', 'quotation');
  }

  function handleStartSelling() {
    dispatch('navigate', 'register');
  }
</script>

<div class="hero">
  <div class="container">
    <h1>Compre e Venda Pontos e Milhas</h1>
    <p>A plataforma mais segura e rápida para intermediar suas pontuações aéreas</p>
    <div class="cta-buttons">
      <button class="btn-primary" on:click={handleStartSelling}>Começar a Vender</button>
      <button class="btn-secondary" on:click={handleGetQuote}>Solicitar Cotação</button>
    </div>
  </div>
</div>

<div class="features">
  <div class="container">
    <h2>Por que escolher Milhas Livre?</h2>
    <div class="features-grid">
      <div class="feature">
        <div class="icon">⚡</div>
        <h3>Rápido</h3>
        <p>Cotação em minutos, operação confirmada em horas</p>
      </div>
      <div class="feature">
        <div class="icon">🔒</div>
        <h3>Seguro</h3>
        <p>Contratos digitais e garantia de transferência</p>
      </div>
      <div class="feature">
        <div class="icon">💰</div>
        <h3>Melhores Preços</h3>
        <p>Sem intermediários, com melhor tabela de mercado</p>
      </div>
      <div class="feature">
        <div class="icon">📱</div>
        <h3>WhatsApp</h3>
        <p>Suporte 24h via WhatsApp para tirar dúvidas</p>
      </div>
    </div>
  </div>
</div>

<div class="stats">
  <div class="container">
    <h2>Estatísticas</h2>
    <div class="stats-grid">
      <div class="stat">
        <div class="stat-value">1000+</div>
        <div class="stat-label">Operações Realizadas</div>
      </div>
      <div class="stat">
        <div class="stat-value">500M+</div>
        <div class="stat-label">Pontos Intermediados</div>
      </div>
      <div class="stat">
        <div class="stat-value">R$ 2.5M+</div>
        <div class="stat-label">Volume Movimentado</div>
      </div>
    </div>
  </div>
</div>

<style>
  .hero {
    background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
    color: white;
    padding: 80px 20px;
    text-align: center;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .hero h1 {
    font-size: 48px;
    margin-bottom: 20px;
    font-weight: bold;
  }

  .hero p {
    font-size: 18px;
    margin-bottom: 40px;
    opacity: 0.9;
  }

  .cta-buttons {
    display: flex;
    gap: 20px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn-primary {
    background-color: #4caf50;
    color: white;
    padding: 16px 40px;
    font-size: 16px;
    border-radius: 8px;
    font-weight: bold;
  }

  .btn-primary:hover {
    background-color: #45a049;
  }

  .btn-secondary {
    background-color: rgba(255, 255, 255, 0.2);
    color: white;
    padding: 16px 40px;
    font-size: 16px;
    border-radius: 8px;
    border: 2px solid white;
  }

  .btn-secondary:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }

  .features {
    padding: 80px 20px;
    background-color: #f5f5f5;
  }

  .features h2 {
    text-align: center;
    font-size: 36px;
    margin-bottom: 50px;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 30px;
  }

  .feature {
    background: white;
    padding: 30px;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .feature .icon {
    font-size: 48px;
    margin-bottom: 15px;
  }

  .feature h3 {
    margin-bottom: 10px;
    font-size: 18px;
  }

  .feature p {
    color: #666;
    line-height: 1.6;
  }

  .stats {
    padding: 80px 20px;
  }

  .stats h2 {
    text-align: center;
    font-size: 36px;
    margin-bottom: 50px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 30px;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    font-size: 36px;
    font-weight: bold;
    color: #1976d2;
    margin-bottom: 10px;
  }

  .stat-label {
    color: #666;
    font-size: 14px;
  }

  @media (max-width: 768px) {
    .hero h1 {
      font-size: 32px;
    }

    .features-grid,
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
