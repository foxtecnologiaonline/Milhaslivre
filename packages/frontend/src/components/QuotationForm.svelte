<script lang="ts">
  let program = 'smiles';
  let amount = '';
  let quotation: any = null;
  let loading = false;
  let error = '';

  async function getQuotation() {
    error = '';
    loading = true;

    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program,
          amount: parseInt(amount),
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao gerar cotação');
      }

      quotation = await res.json();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="quotation-form">
  <h2>Cotação de Pontos/Milhas</h2>

  <div class="form-group">
    <label for="program">Programa</label>
    <select id="program" bind:value={program} disabled={loading}>
      <option value="smiles">Smiles (Gol)</option>
      <option value="latampass">Latam Pass</option>
      <option value="azulconnect">Azul Connect</option>
      <option value="viceversa">Vice Versa (Avianca)</option>
    </select>
  </div>

  <div class="form-group">
    <label for="amount">Quantidade de Pontos</label>
    <input
      id="amount"
      type="number"
      bind:value={amount}
      placeholder="10000"
      min="1000"
      disabled={loading}
    />
  </div>

  <button on:click={getQuotation} disabled={loading || !amount}>
    {loading ? 'Gerando...' : 'Gerar Cotação'}
  </button>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if quotation}
    <div class="quotation-result">
      <h3>Sua Cotação</h3>
      <div class="result-row">
        <span>Programa:</span>
        <strong>{program.toUpperCase()}</strong>
      </div>
      <div class="result-row">
        <span>Quantidade:</span>
        <strong>{parseInt(quotation.amount).toLocaleString('pt-BR')} pontos</strong>
      </div>
      <div class="result-row">
        <span>Preço/mil:</span>
        <strong>R$ {parseFloat(quotation.price_per_thousand).toFixed(2)}</strong>
      </div>
      <div class="result-row highlight">
        <span>Valor Total:</span>
        <strong>
          R$ {((parseInt(quotation.amount) / 1000) * parseFloat(quotation.price_per_thousand)).toFixed(2)}
        </strong>
      </div>
      <p class="quotation-expires">Válido por 15 minutos</p>
    </div>
  {/if}
</div>

<style>
  .quotation-form {
    background: white;
    padding: 30px;
    border-radius: 8px;
    max-width: 400px;
  }

  h2 {
    margin-bottom: 20px;
    color: #1976d2;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  button {
    width: 100%;
    padding: 12px;
    background-color: #1976d2;
    color: white;
    border-radius: 4px;
    font-weight: bold;
  }

  button:hover:not(:disabled) {
    background-color: #1565c0;
  }

  .error {
    background-color: #ffebee;
    color: #c62828;
    padding: 12px;
    border-radius: 4px;
    margin-top: 15px;
  }

  .quotation-result {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 4px;
    margin-top: 20px;
  }

  .quotation-result h3 {
    margin-bottom: 15px;
    color: #333;
  }

  .result-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #e0e0e0;
  }

  .result-row.highlight {
    background-color: #e3f2fd;
    padding: 12px;
    border-radius: 4px;
    border-bottom: none;
    margin-top: 10px;
  }

  .quotation-expires {
    font-size: 12px;
    color: #999;
    margin-top: 10px;
  }
</style>
